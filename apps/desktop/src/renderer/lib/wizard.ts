import type { RawConfig } from "../../shared/api";

export type SourceKind =
    "excel" | "csv" | "xml" | "sqlite" | "sheets" | "database";
export type DatabaseKind = "mysql" | "postgres" | "sqlserver";

export const DEFAULT_PORTS: Record<DatabaseKind, string> = {
    mysql: "3306",
    postgres: "5432",
    sqlserver: "1433",
};
export type DestinationKind =
    "excel" | "csv" | "xml" | "sqlite" | "sheets" | "database";

export type FileSideKind = "excel" | "csv" | "xml" | "sqlite";

export function usesFile(
    kind: SourceKind | DestinationKind | null,
): kind is FileSideKind {
    return (
        kind === "excel" ||
        kind === "csv" ||
        kind === "xml" ||
        kind === "sqlite"
    );
}

export interface WizardDraft {
    source: SourceKind | null;
    databaseKind: DatabaseKind;
    destination: DestinationKind | null;
    sourcePath: string;
    sourceSheet: string;
    allSheets: boolean;
    sourceRecords: string;
    sourceLink: string;
    destinationPath: string;
    destinationLink: string;
    destinationSheet: string;
    destinationTable: string;
    sameServer: boolean;
    destinationDatabaseKind: DatabaseKind;
    destinationHost: string;
    destinationPort: string;
    destinationUser: string;
    destinationPassword: string;
    destinationDatabase: string;
    credentialsPath: string;
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
    table: string;
}

export const EMPTY_DRAFT: WizardDraft = {
    source: null,
    databaseKind: "mysql",
    destination: null,
    sourcePath: "",
    sourceSheet: "",
    allSheets: false,
    sourceRecords: "",
    sourceLink: "",
    destinationPath: "",
    destinationLink: "",
    destinationSheet: "",
    destinationTable: "",
    sameServer: true,
    destinationDatabaseKind: "mysql",
    destinationHost: "localhost",
    destinationPort: "3306",
    destinationUser: "",
    destinationPassword: "",
    destinationDatabase: "",
    credentialsPath: "",
    host: "localhost",
    port: "3306",
    user: "",
    password: "",
    database: "",
    table: "",
};

export function spreadsheetIdFrom(link: string): string {
    const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? link.trim();
}

export function usesGoogle(draft: WizardDraft): boolean {
    return draft.source === "sheets" || draft.destination === "sheets";
}

export function usesSameServer(draft: WizardDraft): boolean {
    return (
        draft.source === "database" &&
        draft.destination === "database" &&
        draft.sameServer
    );
}

function sameText(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function destinationTableProblem(draft: WizardDraft): string | null {
    if (draft.destination !== "database" && draft.destination !== "sqlite")
        return null;
    if (!draft.destinationTable.trim())
        return "Escreva o nome da tabela onde salvar o resultado.";
    if (
        draft.destination === "database" &&
        !usesSameServer(draft) &&
        (!draft.destinationHost ||
            !draft.destinationUser ||
            !draft.destinationDatabase)
    ) {
        return "Preencha servidor, usuário e banco de onde salvar.";
    }
    const sameTable = sameText(draft.table, draft.destinationTable);
    const sameFile =
        draft.source === "sqlite" &&
        draft.destination === "sqlite" &&
        sameText(draft.sourcePath, draft.destinationPath);
    if (sameTable && (usesSameServer(draft) || sameFile)) {
        return "A tabela do resultado precisa ser diferente da tabela de onde ele lê.";
    }
    return null;
}

export function detailsProblem(draft: WizardDraft): string | null {
    if (usesFile(draft.source)) {
        if (!draft.sourcePath) return "Escolha o arquivo de onde ler.";
    }
    if (draft.source === "sheets" && !draft.sourceLink.trim())
        return "Cole o link da planilha de onde ler.";
    if (draft.source === "database") {
        if (!draft.host || !draft.user || !draft.database || !draft.table) {
            return "Preencha servidor, usuário, banco e tabela.";
        }
    }
    if (draft.source === "sqlite" && !draft.table.trim())
        return "Escreva o nome da tabela.";
    if (usesFile(draft.destination) && !draft.destinationPath) {
        return "Escolha onde salvar o resultado.";
    }
    if (draft.destination === "sheets" && !draft.destinationLink.trim()) {
        return "Cole o link da planilha onde salvar.";
    }
    const tableProblem = destinationTableProblem(draft);
    if (tableProblem) return tableProblem;
    if (usesGoogle(draft) && !draft.credentialsPath)
        return "Escolha o arquivo de credenciais do Google.";
    if (
        draft.source === "sheets" &&
        draft.destination === "sheets" &&
        spreadsheetIdFrom(draft.sourceLink) ===
            spreadsheetIdFrom(draft.destinationLink)
    ) {
        if (draft.allSheets) {
            return "Para ler todas as abas, salve o resultado em outra planilha. Senão ele leria também a aba do resultado.";
        }
        if (!draft.sourceSheet.trim() || !draft.destinationSheet.trim()) {
            return "É a mesma planilha, então diga o nome da aba de onde ler e da aba do resultado.";
        }
        if (
            draft.sourceSheet.trim().toLowerCase() ===
            draft.destinationSheet.trim().toLowerCase()
        ) {
            return "A aba do resultado precisa ser diferente da aba de onde ele lê.";
        }
    }
    return null;
}

function optional(key: string, value: string): RawConfig {
    return value.trim() ? { [key]: value.trim() } : {};
}

function sourceOf(draft: WizardDraft): RawConfig {
    switch (draft.source) {
        case "excel":
            return {
                type: "excel",
                path: draft.sourcePath,
                ...(draft.allSheets
                    ? { allSheets: true }
                    : optional("sheet", draft.sourceSheet)),
            };
        case "csv":
            return { type: "csv", path: draft.sourcePath };
        case "xml":
            return {
                type: "xml",
                path: draft.sourcePath,
                ...optional("recordsPath", draft.sourceRecords),
            };
        case "sqlite":
            return {
                type: "sqlite",
                path: draft.sourcePath,
                table: draft.table.trim(),
            };
        case "sheets":
            return {
                type: "sheets",
                spreadsheetId: spreadsheetIdFrom(draft.sourceLink),
                ...(draft.allSheets
                    ? { allSheets: true }
                    : optional("sheet", draft.sourceSheet)),
            };
        default:
            return {
                type: draft.databaseKind,
                host: draft.host.trim(),
                port:
                    Number(draft.port) ||
                    Number(DEFAULT_PORTS[draft.databaseKind]),
                user: draft.user.trim(),
                ...optional("password", draft.password),
                database: draft.database.trim(),
                table: draft.table.trim(),
            };
    }
}

function destinationOf(draft: WizardDraft): RawConfig {
    switch (draft.destination) {
        case "excel":
            return { type: "excel", path: draft.destinationPath };
        case "csv":
            return { type: "csv", path: draft.destinationPath, delimiter: ";" };
        case "xml":
            return { type: "xml", path: draft.destinationPath };
        case "sqlite":
            return {
                type: "sqlite",
                path: draft.destinationPath,
                table: draft.destinationTable.trim(),
            };
        case "database":
            if (usesSameServer(draft)) {
                return {
                    type: draft.databaseKind,
                    table: draft.destinationTable.trim(),
                };
            }
            return {
                type: draft.destinationDatabaseKind,
                host: draft.destinationHost.trim(),
                port:
                    Number(draft.destinationPort) ||
                    Number(DEFAULT_PORTS[draft.destinationDatabaseKind]),
                user: draft.destinationUser.trim(),
                ...optional("password", draft.destinationPassword),
                database: draft.destinationDatabase.trim(),
                table: draft.destinationTable.trim(),
            };
        default:
            return {
                type: "sheets",
                spreadsheetId: spreadsheetIdFrom(draft.destinationLink),
                ...optional("sheet", draft.destinationSheet),
            };
    }
}

export function configFromDraft(draft: WizardDraft): RawConfig {
    return {
        source: sourceOf(draft),
        destination: destinationOf(draft),
        ...(usesGoogle(draft)
            ? { credentialsPath: draft.credentialsPath }
            : {}),
        mode: "raw",
    };
}
