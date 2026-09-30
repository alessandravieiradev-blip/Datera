import path from "path";
import { EtlConfig } from "../config";
import { DestinationConfig } from "../config/ioSchema";
import { createSink } from "../io/factory";
import { Sink } from "../io/types";
import { buildHeader } from "../io/header";
import { DEFAULT_SHEET, safeSheetName } from "../io/excel/excelSink";
import { slugify } from "../io/files";
import { pendingTableOf } from "../io/sql/target";
import { fileSafeName } from "../api/files";
import { DEFAULT_PENDING_SHEET } from "../filters/validate";
import { cellOf, hasCell, setCell } from "../cells";
import { columnKey } from "../filters/align";
import { Logger } from "../logger";
import { TableRow } from "../types";
import { summarize, summaryPlans } from "./summary";

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
        summary: undefined,
        compare: undefined,
    };
}

async function writeTabs(
    config: EtlConfig,
    destination: Extract<DestinationConfig, { type: "excel" | "sheets" }>,
    groups: RowGroup[],
    logger: Logger,
): Promise<string[]> {
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
    if (!first) return [];
    const sink = createSink(
        derived(config, { ...destination, sheet: names[0] }),
        logger,
    );
    await sink.write(first.rows);
    for (const [index, group] of rest.entries()) {
        await sink.write(group.rows, { name: names[index + 1] });
    }
    return names;
}

async function writeTables(
    config: EtlConfig,
    destination: Extract<
        DestinationConfig,
        { type: "mysql" | "postgres" | "sqlserver" | "sqlite" }
    >,
    groups: RowGroup[],
    logger: Logger,
): Promise<string[]> {
    const base = destination.table?.trim();
    if (!base) throw new Error("Faltou a tabela do destino.");
    const names = groups.map((group) => `${base}_${tableSuffix(group.value)}`);
    assertUnique(
        names,
        groups.map((group) => group.value),
        "tabelas",
    );
    if (config.validation) {
        const pending = pendingTableOf({
            table: base,
            pendingTable: destination.pendingTable,
        }).toLowerCase();
        const clash = names.find((name) => name.toLowerCase() === pending);
        if (clash !== undefined) {
            throw new Error(
                `A tabela "${clash}" ia se misturar com a tabela das pendências. Troque o nome da tabela das pendências (pendingTable).`,
            );
        }
    }
    for (const [index, group] of groups.entries()) {
        await createSink(
            derived(config, { ...destination, table: names[index]! }),
            logger,
        ).write(group.rows);
    }
    return names;
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
): Promise<string[]> {
    if (config.blocksBy) {
        await sink.write(blockRows(rows, config.blocksBy));
        return [];
    }
    const by = config.sheetBy ?? config.splitBy;
    if (by === undefined) {
        await sink.write(rows);
        return [];
    }
    const destination = config.destination;
    if (!destination) {
        throw new Error(
            'Pra separar o resultado, a config precisa de um "destination".',
        );
    }
    const groups = groupRows(rows, by);
    const kind = kindFor(destination, config.sheetBy !== undefined);
    let names: string[] = [];
    if (kind === "table" && "table" in destination) {
        names = await writeTables(config, destination, groups, logger);
    } else if (
        kind === "tab" &&
        (destination.type === "excel" || destination.type === "sheets")
    ) {
        names = await writeTabs(config, destination, groups, logger);
    } else if ("path" in destination) {
        await writeFiles(config, destination, groups, logger);
    }
    logger.info(
        `Resultado separado pela coluna "${by}" em ${groups.length} ${kind === "tab" ? "abas" : kind === "table" ? "tabelas" : "arquivos"}.`,
    );
    return names;
}

function isTableDestination(
    destination: DestinationConfig,
): destination is Extract<
    DestinationConfig,
    { type: "mysql" | "postgres" | "sqlserver" | "sqlite" }
> {
    return (
        destination.type === "mysql" ||
        destination.type === "postgres" ||
        destination.type === "sqlserver" ||
        destination.type === "sqlite"
    );
}

function summaryTable(
    destination: Extract<
        DestinationConfig,
        { type: "mysql" | "postgres" | "sqlserver" | "sqlite" }
    >,
    name: string,
): string {
    const base = destination.table?.trim();
    if (!base) throw new Error("Faltou a tabela do destino.");
    return `${base}_${tableSuffix(name)}`;
}

function slotOf(destination: DestinationConfig, name: string): string {
    if (isTableDestination(destination)) {
        return summaryTable(destination, name).toLowerCase();
    }
    if (destination.type === "excel") return safeSheetName(name).toLowerCase();
    if ("path" in destination) return slugify(name) || "extra";
    return name.trim().toLowerCase();
}

function takenSlots(config: EtlConfig, groupNames: string[]): string[] {
    const destination = config.destination ?? { type: "sheets" as const };
    const taken = groupNames.map((name) => name.toLowerCase());
    const grouped =
        config.sheetBy !== undefined || config.splitBy !== undefined;
    if (isTableDestination(destination)) {
        const table = destination.table?.trim();
        if (table && !grouped) taken.push(table.toLowerCase());
        if (table && config.validation) {
            taken.push(
                pendingTableOf({
                    table,
                    pendingTable: destination.pendingTable,
                }).toLowerCase(),
            );
        }
        return taken;
    }
    if (!grouped && destination.type === "excel") {
        taken.push(
            safeSheetName(destination.sheet ?? DEFAULT_SHEET).toLowerCase(),
        );
    }
    if (!grouped && destination.type === "sheets" && destination.sheet) {
        taken.push(destination.sheet.trim().toLowerCase());
    }
    if (config.validation) {
        taken.push(
            slotOf(
                destination,
                config.validation.pendingSheet ?? DEFAULT_PENDING_SHEET,
            ),
        );
    }
    return taken;
}

export function checkSummaries(
    config: EtlConfig,
    groupNames: string[] = [],
): void {
    const destination = config.destination ?? { type: "sheets" as const };
    const taken = new Set(takenSlots(config, groupNames));
    for (const plan of summaryPlans(config.summary)) {
        const slot = slotOf(destination, plan.name);
        if (taken.has(slot)) {
            throw new Error(
                `O resumo "${plan.name}" ia ficar com o mesmo nome de outra parte do resultado. Dê outro "name" pra ele.`,
            );
        }
        taken.add(slot);
    }
}

export async function writeSummaries(
    config: EtlConfig,
    rows: TableRow[],
    sink: Sink,
    logger: Logger,
    groupNames: string[] = [],
): Promise<void> {
    const plans = summaryPlans(config.summary);
    if (plans.length === 0) return;
    const destination = config.destination ?? { type: "sheets" as const };
    checkSummaries(config, groupNames);
    for (const plan of plans) {
        const summary = summarize(rows, plan.by);
        if (isTableDestination(destination)) {
            await createSink(
                derived(config, {
                    ...destination,
                    table: summaryTable(destination, plan.name),
                }),
                logger,
            ).write(summary);
        } else {
            await sink.write(summary, { name: plan.name });
        }
        logger.info(
            `Resumo "${plan.name}" gravado com ${summary.length} ${summary.length === 1 ? "linha" : "linhas"}.`,
        );
    }
}
