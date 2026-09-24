import { Filter } from "./types";
import { TableRow } from "../types";
import {
    MergeColumnConfig,
    MergeFilterOptions,
    DistributeConfig,
} from "./mergeTypes";
import { KeyNormalizer, getKeyNormalizer } from "./keyNormalizers";

type CellValue = string | number | null;

const DEFAULT_SEPARATOR = "; ";

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
                ? this.distributeOnly(items[0]!)
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

    // linha sozinha so passa pelo distribute, senao a coluna fica diferente na planilha
    private distributeOnly(row: TableRow): TableRow {
        const distributed = this.columns.filter(
            (c) => c.strategy === "concat" && c.distribute !== undefined,
        );
        if (distributed.length === 0) return row;

        const result: TableRow = { ...row };
        for (const { column, separator, distribute } of distributed) {
            this.mergeConcatDistributed(
                [row],
                column,
                result,
                distribute!,
                separator ?? DEFAULT_SEPARATOR,
            );
        }
        return result;
    }

    private mergeGroup(group: TableRow[], category?: string): TableRow {
        const merged: TableRow = { ...group[0]! };

        for (const { column, strategy, separator, distribute, byGroup } of this
            .columns) {
            const override =
                category === undefined ? undefined : byGroup?.[category];
            const target = override?.into ?? column;
            const finalSeparator =
                override?.separator ?? separator ?? DEFAULT_SEPARATOR;
            const resolvedStrategy = override?.strategy ?? strategy;
            const finalDistribute = override?.distribute ?? distribute;

            if (resolvedStrategy === "concat" && finalDistribute) {
                this.mergeConcatDistributed(
                    group,
                    column,
                    merged,
                    finalDistribute,
                    finalSeparator,
                );
                continue;
            }

            switch (resolvedStrategy) {
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
            const separator = unkeyed?.separator ?? DEFAULT_SEPARATOR;
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

    private mergeConcatDistributed(
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
                        this.presentValues([row], source).map(String),
                    ),
                ),
            ),
        );

        // limpa os destinos antes pra nao sobrar valor velho da primeira linha
        for (const destination of columns) {
            if (destination in merged) merged[destination] = null;
        }

        uniqueValues.forEach((value, index) => {
            if (index < columns.length) {
                merged[columns[index]!] = value;
            }
        });

        const overflowValues = uniqueValues.slice(columns.length);
        if (overflowValues.length > 0) {
            const overflowColumn =
                overflowInto ?? this.findFreeOverflowColumnName(column, merged);
            merged[overflowColumn] = overflowValues.join(separator);
        }

        for (const source of sourceColumns) {
            if (!columns.includes(source)) delete merged[source];
        }
    }

    private findFreeOverflowColumnName(
        column: string,
        merged: TableRow,
    ): string {
        const base = `${column}_overflow`;
        if (merged[base] === undefined) return base;

        let suffix = 2;
        while (merged[`${base}_${suffix}`] !== undefined) {
            suffix++;
        }
        return `${base}_${suffix}`;
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
