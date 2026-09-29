import { Filter } from "./types";
import { TableRow } from "../types";
import { KeyNormalizer } from "../normalizers/registry";
import { cellOf } from "../cells";

export type DedupeStrategy = "keep-first" | "keep-last";

export class DedupeFilter implements Filter<TableRow> {
    constructor(
        private readonly column: string,
        private readonly strategy: DedupeStrategy = "keep-first",
        private readonly normalizer?: KeyNormalizer,
    ) {}

    private keyOf(row: TableRow): unknown {
        const raw = cellOf(row, this.column);
        if (raw === null || raw === undefined) return undefined;
        if (!this.normalizer) return raw;
        const normalized = this.normalizer(raw);
        if (normalized === null) return undefined;
        return normalized.group === undefined
            ? normalized.key
            : `${normalized.group}\u0000${normalized.key}`;
    }

    apply(rows: TableRow[]): TableRow[] {
        const seen = new Map<unknown, TableRow>();

        for (const row of rows) {
            const key = this.keyOf(row);

            if (key === undefined) {
                seen.set(Symbol(), row);
                continue;
            }

            if (!seen.has(key)) {
                seen.set(key, row);
            } else if (this.strategy === "keep-last") {
                seen.delete(key);
                seen.set(key, row);
            }
        }

        return Array.from(seen.values());
    }
}
