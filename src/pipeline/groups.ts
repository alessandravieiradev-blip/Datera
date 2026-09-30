import path from "path";
import { EtlConfig } from "../config";
import { DestinationConfig } from "../config/ioSchema";
import { createSink } from "../io/factory";
import { Sink } from "../io/types";
import { buildHeader } from "../io/header";
import { safeSheetName } from "../io/excel/excelSink";
import { fileSafeName } from "../api/files";
import { DEFAULT_PENDING_SHEET } from "../filters/validate";
import { cellOf, hasCell, setCell } from "../cells";
import { columnKey } from "../filters/align";
import { Logger } from "../logger";
import { TableRow } from "../types";

export const MAX_GROUPS = 200;
export const EMPTY_GROUP = "(vazio)";

export interface RowGroup {
    value: string;
    rows: TableRow[];
}

function withoutColumn(row: TableRow, column: string): TableRow {
    const next: TableRow = {};
    for (const [name, value] of Object.entries(row)) {
        if (name !== column) setCell(next, name, value);
    }
    return next;
}

export function resolveColumn(rows: TableRow[], column: string): string {
    if (rows.length === 0 || rows.some((row) => hasCell(row, column))) {
        return column;
    }
    const key = columnKey(column);
    for (const row of rows) {
        const found = Object.keys(row).find((name) => columnKey(name) === key);
        if (found !== undefined) return found;
    }
    throw new Error(`A coluna "${column}" não existe no resultado.`);
}

export function groupRows(rows: TableRow[], wanted: string): RowGroup[] {
    const column = resolveColumn(rows, wanted);
    const groups = new Map<string, TableRow[]>();
    for (const row of rows) {
        const raw = cellOf(row, column);
        const value =
            raw === null || raw === undefined || String(raw).trim() === ""
                ? EMPTY_GROUP
                : String(raw).trim();
        groups.set(value, [...(groups.get(value) ?? []), row]);
    }
    if (groups.size > MAX_GROUPS) {
        throw new Error(
            `A coluna "${column}" tem ${groups.size} valores diferentes, e separar por ela criaria ${groups.size} partes. O limite é ${MAX_GROUPS}. Confira se é a coluna certa.`,
        );
    }
    return [...groups].map(([value, grouped]) => ({ value, rows: grouped }));
}

export function blockRows(rows: TableRow[], wanted: string): TableRow[] {
    const column = resolveColumn(rows, wanted);
    const groups = groupRows(rows, column);
    const inner = groups.flatMap((group) =>
        group.rows.map((row) => withoutColumn(row, column)),
    );
    const first = buildHeader(inner)[0];
    if (first === undefined) return rows;
    const blocked: TableRow[] = [];
    for (const group of groups) {
        const title: TableRow = {};
        setCell(title, first, group.value);
        blocked.push(title);
        for (const row of group.rows) blocked.push(withoutColumn(row, column));
    }
    return blocked;
}

function assertUnique(names: string[], values: string[], what: string): void {
    const seen = new Map<string, string>();
    names.forEach((name, index) => {
        const key = name.toLowerCase();
        const other = seen.get(key);
        if (other !== undefined) {
            throw new Error(
                `Os valores "${other}" e "${values[index]}" iam virar ${what} com o mesmo nome ("${name}"). Arrume esses valores antes de separar.`,
            );
        }
        seen.set(key, values[index]!);
    });
}

export function tableSuffix(value: string): string {
    const slug = value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return slug === "" ? "vazio" : slug;
}

type Kind = "tab" | "table" | "file";

function kindFor(destination: DestinationConfig, bySheet: boolean): Kind {
    switch (destination.type) {
        case "mysql":
        case "postgres":
        case "sqlserver":
        case "sqlite":
            return "table";
        case "sheets":
            return "tab";
        case "excel":
            return bySheet ? "tab" : "file";
        case "custom":
            throw new Error(
                "Separar o resultado ainda não funciona com um destino próprio (custom).",
            );
        default:
            if (bySheet) {
                throw new Error(
                    `Uma aba por valor ("sheetBy") só dá no Excel, no Google Sheets ou num banco. Pra ${destination.type.toUpperCase()}, use "splitBy", que grava um arquivo por valor.`,
                );
            }
            return "file";
    }
}

function derived(config: EtlConfig, destination: DestinationConfig): EtlConfig {
    return {
        ...config,
        destination,
        splitBy: undefined,
        sheetBy: undefined,
        blocksBy: undefined,
    };
}

async function writeTabs(
    config: EtlConfig,
    destination: Extract<DestinationConfig, { type: "excel" | "sheets" }>,
    groups: RowGroup[],
    logger: Logger,
): Promise<void> {
    const names = groups.map((group) =>
        destination.type === "excel" ? safeSheetName(group.value) : group.value,
    );
    assertUnique(
        names,
        groups.map((group) => group.value),
        "abas",
    );
    const pending = config.validation
        ? (config.validation.pendingSheet ?? DEFAULT_PENDING_SHEET)
        : undefined;
    const clash = names.find(
        (name) =>
            pending !== undefined &&
            name.toLowerCase() === pending.toLowerCase(),
    );
    if (clash !== undefined) {
        throw new Error(
            `A aba "${clash}" ia se misturar com a aba das pendências. Troque o nome da aba das pendências (pendingSheet).`,
        );
    }
    const [first, ...rest] = groups;
    if (!first) return;
    const sink = createSink(
        derived(config, { ...destination, sheet: names[0] }),
        logger,
    );
    await sink.write(first.rows);
    for (const [index, group] of rest.entries()) {
        await sink.write(group.rows, { name: names[index + 1] });
    }
}

async function writeTables(
    config: EtlConfig,
    destination: Extract<
        DestinationConfig,
        { type: "mysql" | "postgres" | "sqlserver" | "sqlite" }
    >,
    groups: RowGroup[],
    logger: Logger,
): Promise<void> {
    const base = destination.table?.trim();
    if (!base) throw new Error("Faltou a tabela do destino.");
    const names = groups.map((group) => `${base}_${tableSuffix(group.value)}`);
    assertUnique(
        names,
        groups.map((group) => group.value),
        "tabelas",
    );
    for (const [index, group] of groups.entries()) {
        await createSink(
            derived(config, { ...destination, table: names[index]! }),
            logger,
        ).write(group.rows);
    }
}

async function writeFiles(
    config: EtlConfig,
    destination: Extract<DestinationConfig, { path: string }>,
    groups: RowGroup[],
    logger: Logger,
): Promise<void> {
    const extension = path.extname(destination.path);
    const base = destination.path.slice(
        0,
        destination.path.length - extension.length,
    );
    const names = groups.map(
        (group) => `${base}-${fileSafeName(group.value)}${extension}`,
    );
    assertUnique(
        names,
        groups.map((group) => group.value),
        "arquivos",
    );
    for (const [index, group] of groups.entries()) {
        await createSink(
            derived(config, { ...destination, path: names[index]! }),
            logger,
        ).write(group.rows);
    }
}

export async function writeResult(
    config: EtlConfig,
    rows: TableRow[],
    sink: Sink,
    logger: Logger,
): Promise<void> {
    if (config.blocksBy) {
        await sink.write(blockRows(rows, config.blocksBy));
        return;
    }
    const by = config.sheetBy ?? config.splitBy;
    if (by === undefined) {
        await sink.write(rows);
        return;
    }
    const destination = config.destination;
    if (!destination) {
        throw new Error(
            'Pra separar o resultado, a config precisa de um "destination".',
        );
    }
    const groups = groupRows(rows, by);
    const kind = kindFor(destination, config.sheetBy !== undefined);
    if (kind === "table" && "table" in destination) {
        await writeTables(config, destination, groups, logger);
    } else if (
        kind === "tab" &&
        (destination.type === "excel" || destination.type === "sheets")
    ) {
        await writeTabs(config, destination, groups, logger);
    } else if ("path" in destination) {
        await writeFiles(config, destination, groups, logger);
    }
    logger.info(
        `Resultado separado pela coluna "${by}" em ${groups.length} ${kind === "tab" ? "abas" : kind === "table" ? "tabelas" : "arquivos"}.`,
    );
}
