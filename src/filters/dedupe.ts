import { Filter } from "./types";
import { TableRow } from "../types";

export type DedupeStrategy = "keep-first" | "keep-last";

export class DedupeFilter implements Filter<TableRow> {
    constructor(
        private readonly column: string,
        private readonly strategy: DedupeStrategy = "keep-first"
    ) {}

    apply(rows: TableRow[]): TableRow[] {
        const seen = new Map<unknown, TableRow>();

        for (const row of rows) {
            const key = row[this.column];

            if (key === null || key === undefined) {
                seen.set(Symbol(), row);
                continue;
            }

            if (!seen.has(key)) {
                seen.set(key, row);
            } else if (this.strategy === "keep-last") {
                seen.delete(key);   // remove a posição antiga da chave
                seen.set(key, row); // reinsere no fim, com o valor mais recente
            }
        }

        return Array.from(seen.values());
    }
}