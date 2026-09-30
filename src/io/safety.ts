import fs from "fs";
import path from "path";
import { EtlConfig } from "../config";
import { DEFAULT_PENDING_SHEET } from "../filters/validate";
import {
    checkTableName,
    nameRoom,
    NEW_SUFFIX,
    OLD_SUFFIX,
    OWNED_TABLES,
    SqlDialect,
} from "./sql/writer";
import { SQLITE_DIALECT } from "./sqlite/sqliteSink";
import { MYSQL_DIALECT } from "./mysql/mysqlSink";
import { POSTGRES_DIALECT } from "./postgres/postgresSink";
import { SQLSERVER_DIALECT } from "./sqlserver/sqlServerSink";
import { pendingTableOf } from "./sql/target";
import { serverOf } from "./servers";

function sameName(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function filePath(side: object): string | undefined {
    return "path" in side && typeof side.path === "string"
        ? side.path
        : undefined;
}

function assertSheetsAreSafe(config: EtlConfig): void {
    const source = config.source;
    const destination = config.destination ?? { type: "sheets" as const };
    if (source?.type !== "sheets" || destination.type !== "sheets") return;

    const destinationId = destination.spreadsheetId ?? config.spreadsheetId;
    if (source.spreadsheetId !== destinationId) return;

    if (source.allSheets) {
        throw new Error(
            "A fonte lê todas as abas, então o resultado precisa ir pra outra planilha. Senão ele leria também a aba do resultado.",
        );
    }
    if (source.sheet === undefined) {
        throw new Error(
            'A fonte e o destino são a mesma planilha. Coloque "sheet" na fonte com o nome da aba dos dados originais, senão ele pode ler e apagar a mesma aba.',
        );
    }
    if (destination.sheet === undefined) {
        throw new Error(
            'A fonte e o destino são a mesma planilha. Coloque "sheet" no destino com o nome da aba do resultado, senão ele grava na primeira aba, que pode ser a dos dados originais.',
        );
    }

    const pendingSheet = config.validation
        ? (config.validation.pendingSheet ?? DEFAULT_PENDING_SHEET)
        : undefined;
    for (const target of [destination.sheet, pendingSheet]) {
        if (target !== undefined && sameName(target, source.sheet)) {
            throw new Error(
                `A aba "${source.sheet}" é de onde o Datera lê, então ele não pode gravar nela. Escolha outro nome pra aba do resultado ou das pendências.`,
            );
        }
    }
}

function comparablePath(file: string): string {
    const resolved = path.resolve(file);
    let real = resolved;
    try {
        real = fs.realpathSync.native(resolved);
    } catch {
        try {
            real = path.join(
                fs.realpathSync.native(path.dirname(resolved)),
                path.basename(resolved),
            );
        } catch {
            real = resolved;
        }
    }
    return process.platform === "win32" || process.platform === "darwin"
        ? real.toLowerCase()
        : real;
}

export function isSameFile(a: string, b: string): boolean {
    return comparablePath(a) === comparablePath(b);
}

function assertFilesAreSafe(config: EtlConfig): void {
    if (
        config.source?.type === "sqlite" &&
        config.destination?.type === "sqlite"
    )
        return;
    const sourcePath = config.source ? filePath(config.source) : undefined;
    const destinationPath = config.destination
        ? filePath(config.destination)
        : undefined;
    if (sourcePath === undefined || destinationPath === undefined) return;

    if (isSameFile(sourcePath, destinationPath)) {
        throw new Error(
            `A fonte e o destino são o mesmo arquivo (${sourcePath}). O destino é apagado antes de gravar, então escolha outro arquivo pra saída.`,
        );
    }
}

function destinationTable(config: EtlConfig): string | undefined {
    const destination = config.destination;
    switch (destination?.type) {
        case "sqlite":
        case "mysql":
        case "postgres":
        case "sqlserver":
            return destination.table?.trim() || undefined;
        default:
            return undefined;
    }
}

function sameDatabase(config: EtlConfig): boolean {
    const { source, destination } = config;
    if (source?.type === "sqlite" && destination?.type === "sqlite") {
        return isSameFile(source.path, destination.path);
    }
    const from = serverOf(config, "source");
    const to = serverOf(config, "destination");
    if (!from || !to || from.type !== to.type) return false;
    return (
        sameName(from.host ?? "", to.host ?? "") &&
        from.port === to.port &&
        sameName(from.database ?? "", to.database ?? "")
    );
}

function sourceTable(config: EtlConfig): string | undefined {
    const source = config.source;
    if (source?.type === "sqlite") return source.table;
    return serverOf(config, "source")?.table;
}

const DIALECTS: Record<string, SqlDialect> = {
    sqlite: SQLITE_DIALECT,
    mysql: MYSQL_DIALECT,
    postgres: POSTGRES_DIALECT,
    sqlserver: SQLSERVER_DIALECT,
};

function nameProblem(type: string, targets: string[]): string | null {
    const dialect = DIALECTS[type];
    if (!dialect) return null;
    for (const target of targets) {
        try {
            checkTableName(dialect, target, nameRoom(dialect));
        } catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    }
    return null;
}

export function tableProblem(config: EtlConfig): string | null {
    const table = destinationTable(config);
    const destination = config.destination;
    if (table === undefined || destination === undefined) return null;

    const pending = config.validation
        ? pendingTableOf({
              table,
              pendingTable:
                  "pendingTable" in destination
                      ? destination.pendingTable
                      : undefined,
          })
        : undefined;
    const targets = pending === undefined ? [table] : [table, pending];

    const names = nameProblem(destination.type, targets);
    if (names !== null) return names;
    const lastPart = (target: string) =>
        target.split(".").pop()?.trim().toLowerCase() ?? "";
    if (
        targets.some((target) => {
            const last = lastPart(target);
            return (
                last === OWNED_TABLES ||
                last.endsWith(NEW_SUFFIX) ||
                last.endsWith(OLD_SUFFIX)
            );
        })
    ) {
        return `"${OWNED_TABLES}" e os nomes terminados em ${NEW_SUFFIX} ou ${OLD_SUFFIX} são usados pelo próprio Datera. Escolha outro nome.`;
    }
    if (pending !== undefined && sameName(pending, table)) {
        return `A tabela das pendências precisa ter um nome diferente da tabela do resultado ("${table}").`;
    }
    const from = sourceTable(config);
    if (from !== undefined && sameDatabase(config)) {
        if (targets.some((target) => sameName(target, from))) {
            return `A tabela "${from}" é de onde o Datera lê, então ele não pode gravar nela. Escolha outro nome pra tabela do resultado ou das pendências.`;
        }
    }
    return null;
}

function assertTablesAreSafe(config: EtlConfig): void {
    const problem = tableProblem(config);
    if (problem !== null) throw new Error(problem);
}

export function assertSourceIsSafe(config: EtlConfig): void {
    assertSheetsAreSafe(config);
    assertFilesAreSafe(config);
    assertTablesAreSafe(config);
}
