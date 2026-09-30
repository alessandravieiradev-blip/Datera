import { cellOf, hasCell, setCell } from "../cells";
import { columnKey } from "../filters/align";
import { buildHeader } from "../io/header";
import { TableRow } from "../types";
import { EMPTY_GROUP, resolveColumn } from "./groups";
import { columnsOf } from "./summary";

export const STATUS_COLUMN = "situação";
export const CHANGES_COLUMN = "mudanças";

export type CompareStatus = "entrou" | "saiu" | "mudou" | "igual";

export interface CellChange {
    column: string;
    before: unknown;
    after: unknown;
}

export interface ChangedRow {
    key: string;
    before: TableRow;
    after: TableRow;
    changes: CellChange[];
}

export interface Comparison {
    key: string[];
    keyBefore: string[];
    added: TableRow[];
    removed: TableRow[];
    changed: ChangedRow[];
    unchanged: TableRow[];
    columnsOnlyBefore: string[];
    columnsOnlyAfter: string[];
    skippedBefore: number;
    skippedAfter: number;
}

export interface ComparisonCounts {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
}

export interface CompareRowsOptions {
    ignore?: string[] | undefined;
}

export interface ComparisonRowsOptions {
    keepUnchanged?: boolean | undefined;
}

function text(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    return String(value).trim();
}

const NUMBER = /^-?\d+(\.\d+)?$/;

function sameValue(a: unknown, b: unknown): boolean {
    const left = text(a);
    const right = text(b);
    if (left === right) return true;
    return (
        NUMBER.test(left) &&
        NUMBER.test(right) &&
        Number(left) === Number(right)
    );
}

function keyOf(row: TableRow, columns: string[]): string[] | undefined {
    const parts = columns.map((column) => text(cellOf(row, column)));
    return parts.some((part) => part === "") ? undefined : parts;
}

function index(
    rows: TableRow[],
    columns: string[],
    side: string,
): {
    rows: Map<string, TableRow>;
    labels: Map<string, string>;
    skipped: number;
} {
    const found = new Map<string, TableRow>();
    const labels = new Map<string, string>();
    let skipped = 0;
    for (const row of rows) {
        const parts = keyOf(row, columns);
        if (parts === undefined) {
            skipped += 1;
            continue;
        }
        const id = JSON.stringify(parts);
        const label = parts.join(" | ");
        if (found.has(id)) {
            throw new Error(
                `A chave "${label}" aparece mais de uma vez ${side}. Pra comparar, cada valor da chave precisa aparecer uma vez só. Tire as repetidas (datera dedupe) ou use mais de uma coluna na chave.`,
            );
        }
        found.set(id, row);
        labels.set(id, label);
    }
    return { rows: found, labels, skipped };
}

export function compareRows(
    before: TableRow[],
    after: TableRow[],
    key: string | string[],
    options: CompareRowsOptions = {},
): Comparison {
    const wanted = columnsOf(key);
    if (wanted.length === 0) {
        throw new Error("Diga a coluna que identifica cada linha (a chave).");
    }
    const keyBefore = wanted.map((column) => resolveColumn(before, column));
    const keyAfter = wanted.map((column) => resolveColumn(after, column));

    const ignored = new Set(
        [...wanted, ...(options.ignore ?? [])].map((column) =>
            columnKey(column),
        ),
    );
    const headerBefore = buildHeader(before);
    const headerAfter = buildHeader(after);
    const byKey = new Map(
        headerBefore.map((column) => [columnKey(column), column]),
    );
    const pairs: [string, string][] = [];
    const columnsOnlyAfter: string[] = [];
    const matched = new Set<string>();
    for (const column of headerAfter) {
        const id = columnKey(column);
        if (ignored.has(id)) continue;
        const other = byKey.get(id);
        if (other === undefined) {
            columnsOnlyAfter.push(column);
            continue;
        }
        matched.add(other);
        pairs.push([other, column]);
    }
    const columnsOnlyBefore = headerBefore.filter(
        (column) => !matched.has(column) && !ignored.has(columnKey(column)),
    );

    const old = index(before, keyBefore, "no arquivo de antes");
    const now = index(after, keyAfter, "no arquivo de depois");

    const added: TableRow[] = [];
    const changed: ChangedRow[] = [];
    const unchanged: TableRow[] = [];
    for (const [id, row] of now.rows) {
        const previous = old.rows.get(id);
        if (previous === undefined) {
            added.push(row);
            continue;
        }
        const changes = pairs
            .filter(
                ([from, to]) =>
                    !sameValue(cellOf(previous, from), cellOf(row, to)),
            )
            .map(([from, to]) => ({
                column: to,
                before: cellOf(previous, from),
                after: cellOf(row, to),
            }));
        if (changes.length === 0) unchanged.push(row);
        else {
            changed.push({
                key: now.labels.get(id)!,
                before: previous,
                after: row,
                changes,
            });
        }
    }
    const removed = [...old.rows]
        .filter(([id]) => !now.rows.has(id))
        .map(([, row]) => row);

    return {
        key: keyAfter,
        keyBefore,
        added,
        removed,
        changed,
        unchanged,
        columnsOnlyBefore,
        columnsOnlyAfter,
        skippedBefore: old.skipped,
        skippedAfter: now.skipped,
    };
}

export function countComparison(comparison: Comparison): ComparisonCounts {
    return {
        added: comparison.added.length,
        removed: comparison.removed.length,
        changed: comparison.changed.length,
        unchanged: comparison.unchanged.length,
    };
}

function shown(value: unknown): string {
    const clean = text(value);
    return clean === "" ? EMPTY_GROUP : clean;
}

export function describeChanges(changes: CellChange[]): string {
    return changes
        .map(
            (change) =>
                `${change.column}: ${shown(change.before)} → ${shown(change.after)}`,
        )
        .join("; ");
}

function line(
    status: CompareStatus,
    row: TableRow,
    changes: string | null,
): TableRow {
    for (const column of [STATUS_COLUMN, CHANGES_COLUMN]) {
        if (hasCell(row, column)) {
            throw new Error(
                `Os arquivos já têm uma coluna "${column}", que é o nome que a comparação usa. Renomeie essa coluna antes de comparar.`,
            );
        }
    }
    const result: TableRow = {};
    setCell(result, STATUS_COLUMN, status);
    for (const [column, value] of Object.entries(row)) {
        setCell(result, column, value);
    }
    setCell(result, CHANGES_COLUMN, changes);
    return result;
}

export function comparisonRows(
    comparison: Comparison,
    options: ComparisonRowsOptions = {},
): TableRow[] {
    return [
        ...comparison.added.map((row) => line("entrou", row, null)),
        ...comparison.removed.map((row) => line("saiu", row, null)),
        ...comparison.changed.map((item) =>
            line("mudou", item.after, describeChanges(item.changes)),
        ),
        ...(options.keepUnchanged
            ? comparison.unchanged.map((row) => line("igual", row, null))
            : []),
    ];
}

export function comparisonWarnings(comparison: Comparison): string[] {
    const warnings: string[] = [];
    const list = (columns: string[]) =>
        columns.map((column) => `"${column}"`).join(", ");
    if (comparison.columnsOnlyBefore.length > 0) {
        warnings.push(
            `Só no arquivo de antes: ${list(comparison.columnsOnlyBefore)}. Essas colunas ficaram fora da comparação.`,
        );
    }
    if (comparison.columnsOnlyAfter.length > 0) {
        warnings.push(
            `Só no arquivo de depois: ${list(comparison.columnsOnlyAfter)}. Essas colunas ficaram fora da comparação.`,
        );
    }
    const skipped = comparison.skippedBefore + comparison.skippedAfter;
    if (skipped > 0) {
        warnings.push(
            `${skipped} ${skipped === 1 ? "linha ficou" : "linhas ficaram"} de fora por estar com a chave vazia.`,
        );
    }
    return warnings;
}
