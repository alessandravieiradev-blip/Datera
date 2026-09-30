import { SummaryConfig } from "../config";
import { cellOf, setCell } from "../cells";
import { columnKey } from "../filters/align";
import { TableRow } from "../types";
import { EMPTY_GROUP, resolveColumn } from "./groups";

export const COUNT_COLUMN = "quantidade";

export interface SummaryPlan {
    by: string[];
    name: string;
}

export function columnsOf(value: string | string[]): string[] {
    return (Array.isArray(value) ? value : [value])
        .map((column) => column.trim())
        .filter(Boolean);
}

export function summaryName(by: string[]): string {
    return `Por ${by.join(" e ")}`;
}

export function summaryPlans(
    summary: SummaryConfig | SummaryConfig[] | undefined,
): SummaryPlan[] {
    if (summary === undefined) return [];
    const items = Array.isArray(summary) ? summary : [summary];
    const plans = items.map((item) => {
        const by = columnsOf(item.by);
        return { by, name: item.name?.trim() || summaryName(by) };
    });
    const seen = new Set<string>();
    for (const plan of plans) {
        const key = plan.name.toLowerCase();
        if (seen.has(key)) {
            throw new Error(
                `Tem dois resumos com o nome "${plan.name}". Dê um "name" diferente pra cada um.`,
            );
        }
        seen.add(key);
    }
    return plans;
}

function valueOf(row: TableRow, column: string): string {
    const raw = cellOf(row, column);
    if (raw === null || raw === undefined) return EMPTY_GROUP;
    const text = String(raw).trim();
    return text === "" ? EMPTY_GROUP : text;
}

export function summarize(rows: TableRow[], by: string | string[]): TableRow[] {
    const wanted = columnsOf(by);
    if (wanted.length === 0) {
        throw new Error("Diga pelo menos uma coluna pra fazer o resumo.");
    }
    if (rows.length === 0) return [];
    const columns = wanted.map((column) => resolveColumn(rows, column));
    const countColumn = columns.some(
        (column) => columnKey(column) === columnKey(COUNT_COLUMN),
    )
        ? "total de linhas"
        : COUNT_COLUMN;

    const counts = new Map<string, { values: string[]; count: number }>();
    for (const row of rows) {
        const values = columns.map((column) => valueOf(row, column));
        const key = JSON.stringify(values);
        const found = counts.get(key);
        if (found) found.count += 1;
        else counts.set(key, { values, count: 1 });
    }

    const collator = new Intl.Collator("pt-BR", { numeric: true });
    return [...counts.values()]
        .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            for (let index = 0; index < a.values.length; index++) {
                const order = collator.compare(
                    a.values[index]!,
                    b.values[index]!,
                );
                if (order !== 0) return order;
            }
            return 0;
        })
        .map(({ values, count }) => {
            const row: TableRow = {};
            columns.forEach((column, index) =>
                setCell(row, column, values[index]!),
            );
            setCell(row, countColumn, count);
            return row;
        });
}
