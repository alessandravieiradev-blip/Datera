import { Filter } from "./types";
import { TableRow } from "../types";
import { FillEmptyConfig } from "./fillEmptyTypes";
import { cellOf, setCell } from "../cells";

export class FillEmptyFilter implements Filter<TableRow> {
    constructor(private readonly rules: FillEmptyConfig[]) {}

    apply(rows: TableRow[]): TableRow[] {
        return rows.map((row) => {
            const result: TableRow = { ...row };
            for (const {
                column,
                fallbackColumns = [],
                default: fallbackValue,
            } of this.rules) {
                if (!this.isEmpty(cellOf(row, column))) continue;

                const fromColumn = fallbackColumns
                    .map((fallback) => cellOf(row, fallback))
                    .find((value) => !this.isEmpty(value));

                if (fromColumn !== undefined) {
                    setCell(result, column, fromColumn);
                } else if (fallbackValue !== undefined) {
                    setCell(result, column, fallbackValue);
                }
            }
            return result;
        });
    }

    private isEmpty(value: TableRow[string] | undefined): boolean {
        return (
            value === null || value === undefined || String(value).trim() === ""
        );
    }
}
