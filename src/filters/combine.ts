import { Filter } from "./types";
import { TableRow } from "../types";
import { CombineColumnsConfig } from "./combineTypes";

export class CombineFilter implements Filter<TableRow> {
    constructor(private readonly combinations: CombineColumnsConfig[]) {}

    apply(rows: TableRow[]): TableRow[] {
        const targets = new Set(this.combinations.map((c) => c.into));
        const sourcesToRemove = new Set(
            this.combinations
                .filter((c) => !c.keepSources)
                .flatMap((c) => c.columns)
                .filter((column) => !targets.has(column)),
        );

        return rows.map((row) => {
            const combined = new Map<string, string | null>();
            for (const combination of this.combinations) {
                combined.set(combination.into, this.combine(row, combination));
            }
            return this.rebuildRow(row, combined, sourcesToRemove);
        });
    }

    private rebuildRow(
        row: TableRow,
        combined: Map<string, string | null>,
        sourcesToRemove: Set<string>,
    ): TableRow {
        const anchorOf = new Map<string, string>();
        for (const { into, columns } of this.combinations) {
            const anchor = columns.find((column) => column in row);
            if (anchor !== undefined && !(into in row))
                anchorOf.set(anchor, into);
        }

        const result: TableRow = {};
        for (const [column, value] of Object.entries(row)) {
            const into = anchorOf.get(column);
            if (into !== undefined) result[into] = combined.get(into) ?? null;
            if (combined.has(column)) {
                result[column] = combined.get(column) ?? null;
            } else if (!sourcesToRemove.has(column)) {
                result[column] = value;
            }
        }
        for (const [into, value] of combined) {
            if (!(into in result)) result[into] = value;
        }
        return result;
    }

    private combine(
        row: TableRow,
        { columns, separator = " " }: CombineColumnsConfig,
    ): string | null {
        const values: string[] = [];

        for (const column of columns) {
            const raw = row[column];
            const text =
                raw === null || raw === undefined ? "" : String(raw).trim();
            if (text === "") return null;
            values.push(text);
        }

        return values.join(separator);
    }
}
