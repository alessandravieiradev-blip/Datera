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
        options: MergeFilterOptions = {},
    ) {
        this.emptyKeyLabel = options.emptyKeyLabel ?? `(sem ${keyColumn})`;
        this.rejectedKeyLabel =
            options.rejectedKeyLabel ?? `(${keyColumn} inválido)`;

        const normalizer = options.keyNormalizer;
        this.normalizeKey =
            typeof normalizer === "string"
                ? getKeyNormalizer(normalizer)
                : (normalizer ?? identityNormalizer);
    }

    apply(rows: TableRow[]): TableRow[] {
        const groups = new Map<
            string | number,
            { category: string | undefined; items: TableRow[] }
        >();
        const emptyKeyRows: TableRow[] = [];
        const rejectedKeyRows: TableRow[] = [];

        for (const row of rows) {
            const rawKey = row[this.keyColumn];

            if (
                rawKey === null ||
                rawKey === undefined ||
                (typeof rawKey === "string" && rawKey.trim() === "")
            ) {
                emptyKeyRows.push(row);
                continue;
            }

            const normalized = this.normalizeKey(rawKey);
            if (normalized === null) {
                rejectedKeyRows.push(row);
                continue;
            }

            const groupKey =
                normalized.group === undefined
                    ? normalized.key
                    : `${normalized.group}\u0000${normalized.key}`;

            const existing = groups.get(groupKey);
            if (existing) {
                existing.items.push(row);
            } else {
                groups.set(groupKey, {
                    category: normalized.group,
                    items: [row],
                });
            }
        }

        const merged = Array.from(groups.values()).map(({ category, items }) =>
            items.length === 1 && !this.hasGroupOverride(category)
                ? items[0]!
                : this.mergeGroup(items, category),
        );

        return [
            ...merged,
            ...this.buildUnkeyedRows(emptyKeyRows, this.emptyKeyLabel),
            ...this.buildUnkeyedRows(rejectedKeyRows, this.rejectedKeyLabel),
        ];
    }

    private hasGroupOverride(category: string | undefined): boolean {
        if (category === undefined) return false;
        return this.columns.some((c) => c.byGroup?.[category] !== undefined);
    }

    private mergeGroup(group: TableRow[], category?: string): TableRow {
        const merged: TableRow = { ...group[0]! };

        for (const { column, strategy, separator, byGroup } of this.columns) {
            const override =
                category === undefined ? undefined : byGroup?.[category];
            const target = override?.into ?? column;
            const finalSeparator = override?.separator ?? separator ?? "; ";

            switch (override?.strategy ?? strategy) {
                case "overwrite":
                    merged[target] = this.mergeOverwrite(group, column);
                    break;
                case "concat":
                    merged[target] = this.mergeConcat(
                        group,
                        column,
                        finalSeparator,
                    );
                    break;
                case "extra-column":
                    this.mergeExtraColumns(group, column, merged, target);
                    break;
            }

            if (target !== column) delete merged[column];
        }

        return merged;
    }

    private buildUnkeyedRows(rows: TableRow[], label: string): TableRow[] {
        if (rows.length === 0) return [];

        const collapsing = this.columns.filter(
            (c) => c.unkeyed?.strategy === "collapse-column",
        );
        if (collapsing.length === 0) {
            return rows.map((row) => ({ ...row, [this.keyColumn]: label }));
        }

        const collapsed: TableRow = { [this.keyColumn]: label };

        for (const { column, unkeyed } of collapsing) {
            const target = unkeyed?.into ?? `${column} ${label}`;
            const separator = unkeyed?.separator ?? "; ";
            collapsed[target] = this.presentValues(rows, column)
                .map(String)
                .join(separator);
        }

        return [collapsed];
    }

    private presentValues(
        rows: TableRow[],
        column: string,
    ): (string | number)[] {
        return rows
            .map((row) => row[column])
            .filter(
                (v): v is string | number =>
                    v !== null && v !== undefined && v !== "",
            );
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

    private mergeConcat(
        group: TableRow[],
        column: string,
        separator: string,
    ): string {
        const values = this.presentValues(group, column).map(String);

        return Array.from(new Set(values)).join(separator);
    }

    private mergeExtraColumns(
        group: TableRow[],
        column: string,
        merged: TableRow,
        target: string = column,
    ): void {
        const values = this.presentValues(group, column);

        merged[target] = values[0] ?? null;

        for (let i = 1; i < values.length; i++) {
            merged[`${target}_${i + 1}`] = values[i] ?? null;
        }
    }
}
