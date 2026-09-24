import { Filter } from "./types";
import { TableRow } from "../types";
import { FillEmptyConfig } from "./fillEmptyTypes";

// preenche celula vazia com outra coluna ou com um valor padrao
export class FillEmptyFilter implements Filter<TableRow> {
    constructor(private readonly rules: FillEmptyConfig[]) {}

    apply(rows: TableRow[]): TableRow[] {
        return rows.map((row) => {
            const result: TableRow = { ...row };
            // le sempre da linha original pra ordem das regras nao mudar o resultado
            for (const {
                column,
                fallbackColumns = [],
                default: fallbackValue,
            } of this.rules) {
                if (!this.isEmpty(row[column])) continue;

                const fromColumn = fallbackColumns
                    .map((fallback) => row[fallback])
                    .find((value) => !this.isEmpty(value));

                if (fromColumn !== undefined) {
                    result[column] = fromColumn;
                } else if (fallbackValue !== undefined) {
                    result[column] = fallbackValue;
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
