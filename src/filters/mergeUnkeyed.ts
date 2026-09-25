import { TableRow } from "../types";
import { MergeColumnConfig } from "./mergeTypes";
import { DEFAULT_SEPARATOR, presentValues } from "./mergeStrategies";

export function buildUnkeyedRows(
    rows: TableRow[],
    label: string,
    keyColumn: string,
    columns: MergeColumnConfig[],
): TableRow[] {
    if (rows.length === 0) return [];

    const collapsing = columns.filter(
        (c) => c.unkeyed?.strategy === "collapse-column",
    );
    if (collapsing.length === 0) {
        return rows.map((row) => ({ ...row, [keyColumn]: label }));
    }

    const collapsed: TableRow = { [keyColumn]: label };

    for (const { column, unkeyed } of collapsing) {
        const target = unkeyed?.into ?? `${column} ${label}`;
        const separator = unkeyed?.separator ?? DEFAULT_SEPARATOR;
        collapsed[target] = presentValues(rows, column)
            .map(String)
            .join(separator);
    }

    return [collapsed];
}
