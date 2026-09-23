import { Filter } from "./types";
import { TableRow } from "../types";
import { MergeColumnConfig, MergeFilterOptions } from "./mergeTypes";
import { KeyNormalizer, getKeyNormalizer } from "./keyNormalizers";

type CellValue = string | number | null;

const identityNormalizer: KeyNormalizer = (raw) => ({
    key: typeof raw === "string" ? raw.trim() : raw,
});

export class MergeFilter implements Filter<TableRow> {
    private readonly emptyKeyLabel: string;
    private readonly rejectedKeyLabel: string;
    private readonly normalizeKey: KeyNormalizer;

    constructor(
        private readonly keyColumn: string,
        private readonly columns: MergeColumnConfig[],
        options: MergeFilterOptions = {}
    ) {
        this.emptyKeyLabel = options.emptyKeyLabel ?? `(sem ${keyColumn})`;
        this.rejectedKeyLabel = options.rejectedKeyLabel ?? `(${keyColumn} inválido)`;

        const normalizer = options.keyNormalizer;
        this.normalizeKey =
            typeof normalizer === "string" ? getKeyNormalizer(normalizer) : (normalizer ?? identityNormalizer);
    }

    apply(rows: TableRow[]): TableRow[] {
        const groups = new Map<unknown, TableRow[]>();
        const emptyKeyRows: TableRow[] = [];
        const rejectedKeyRows: TableRow[] = [];

        for (const row of rows) {
            const rawKey = row[this.keyColumn];

            if (rawKey === null || rawKey === undefined || (typeof rawKey === "string" && rawKey.trim() === "")) {
                emptyKeyRows.push(row);
                continue;
            }

            const normalized = this.normalizeKey(rawKey);
            if (normalized === null) {
                rejectedKeyRows.push(row);
                continue;
            }

            const groupKey =
                normalized.group === undefined ? normalized.key : `${normalized.group}\u0000${normalized.key}`;

            const existing = groups.get(groupKey);
            if (existing) {
                existing.push(row);
            } else {
                groups.set(groupKey, [row]);
            }
        }

        const merged = Array.from(groups.values()).map((group) =>
            group.length === 1 ? group[0]! : this.mergeGroup(group)
        );

        return [
            ...merged,
            ...this.buildUnkeyedRows(emptyKeyRows, this.emptyKeyLabel),
            ...this.buildUnkeyedRows(rejectedKeyRows, this.rejectedKeyLabel),
        ];
    }

    private mergeGroup(group: TableRow[]): TableRow {
        const merged: TableRow = { ...group[0]! };

        for (const { column, strategy, separator } of this.columns) {
            switch (strategy) {
                case "overwrite":
                    merged[column] = this.mergeOverwrite(group, column);
                    break;
                case "concat":
                    merged[column] = this.mergeConcat(group, column, separator ?? "; ");
                    break;
                case "extra-column":
                    this.mergeExtraColumns(group, column, merged);
                    break;
            }
        }

        return merged;
    }

    private buildUnkeyedRows(rows: TableRow[], label: string): TableRow[] {
        if (rows.length === 0) return [];

        const collapsing = this.columns.filter((c) => c.unkeyed?.strategy === "collapse-column");
        if (collapsing.length === 0) {
            return rows.map((row) => ({ ...row, [this.keyColumn]: label }));
        }

        const collapsed: TableRow = { [this.keyColumn]: label };

        for (const { column, unkeyed } of collapsing) {
            const target = unkeyed?.into ?? `${column} ${label}`;
            const separator = unkeyed?.separator ?? "; ";
            collapsed[target] = this.presentValues(rows, column).map(String).join(separator);
        }

        return [collapsed];
    }

    private presentValues(rows: TableRow[], column: string): (string | number)[] {
        return rows
            .map((row) => row[column])
            .filter((v): v is string | number => v !== null && v !== undefined && v !== "");
    }

    private mergeOverwrite(group: TableRow[], column: string): CellValue {
        let result: CellValue = group[0]?.[column] ?? null;
        for (const row of group) {
            const value = row[column];
            if (value !== null && value !== undefined) {
                result = value;
            }
        }
        return result;
    }

    private mergeConcat(group: TableRow[], column: string, separator: string): string {
        const values = this.presentValues(group, column).map(String);

        return Array.from(new Set(values)).join(separator);
    }

    private mergeExtraColumns(group: TableRow[], column: string, merged: TableRow): void {
        const values = this.presentValues(group, column);

        merged[column] = values[0] ?? null;

        for (let i = 1; i < values.length; i++) {
            merged[`${column}_${i + 1}`] = values[i] ?? null;
        }
    }
}
