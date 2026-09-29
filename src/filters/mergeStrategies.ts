import { TableRow } from "../types";
import { DistributeConfig } from "./mergeTypes";
import { cellOf, hasCell, setCell } from "../cells";

export type CellValue = string | number | null;

export const DEFAULT_SEPARATOR = "; ";

export function presentValues(
    rows: TableRow[],
    column: string,
): (string | number)[] {
    return rows
        .map((row) => cellOf(row, column))
        .filter(
            (v): v is string | number =>
                v !== null && v !== undefined && v !== "",
        );
}

export function mergeOverwrite(group: TableRow[], column: string): CellValue {
    let result: CellValue =
        (group[0] ? cellOf(group[0], column) : null) ?? null;
    for (const row of group) {
        const value = cellOf(row, column);
        if (value !== null && value !== undefined) {
            result = value;
        }
    }
    return result;
}

export function mergeConcat(
    group: TableRow[],
    column: string,
    separator: string,
): string {
    const values = presentValues(group, column).map(String);

    return Array.from(new Set(values)).join(separator);
}

export function mergeConcatDistributed(
    group: TableRow[],
    column: string,
    merged: TableRow,
    distribute: DistributeConfig,
    separator: string,
): void {
    const { columns, overflowInto, sources = [] } = distribute;
    const sourceColumns = [column, ...sources];

    const uniqueValues = Array.from(
        new Set(
            group.flatMap((row) =>
                sourceColumns.flatMap((source) =>
                    presentValues([row], source).map(String),
                ),
            ),
        ),
    );

    for (const destination of columns) {
        if (hasCell(merged, destination)) setCell(merged, destination, null);
    }

    uniqueValues.forEach((value, index) => {
        if (index < columns.length) {
            setCell(merged, columns[index]!, value);
        }
    });

    const overflowValues = uniqueValues.slice(columns.length);
    if (overflowValues.length > 0) {
        const overflowColumn =
            overflowInto ?? findFreeOverflowColumnName(column, merged);
        setCell(merged, overflowColumn, overflowValues.join(separator));
    }

    for (const source of sourceColumns) {
        if (!columns.includes(source)) delete merged[source];
    }
}

export function findFreeOverflowColumnName(
    column: string,
    merged: TableRow,
): string {
    const base = `${column}_overflow`;
    if (!hasCell(merged, base)) return base;

    let suffix = 2;
    while (hasCell(merged, `${base}_${suffix}`)) {
        suffix++;
    }
    return `${base}_${suffix}`;
}

export function mergeExtraColumns(
    group: TableRow[],
    column: string,
    merged: TableRow,
    target: string = column,
): void {
    const values = presentValues(group, column);

    setCell(merged, target, values[0] ?? null);

    for (let i = 1; i < values.length; i++) {
        setCell(merged, `${target}_${i + 1}`, values[i] ?? null);
    }
}
