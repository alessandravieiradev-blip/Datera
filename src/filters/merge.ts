import { Filter } from "./types";
import { TableRow } from "../types";
import { MergeColumnConfig, MergeFilterOptions } from "./mergeTypes";
import {
    DEFAULT_SEPARATOR,
    mergeConcat,
    mergeConcatDistributed,
    mergeExtraColumns,
    mergeOverwrite,
} from "./mergeStrategies";
import { buildUnkeyedRows } from "./mergeUnkeyed";
import { KeyNormalizer, getKeyNormalizer } from "../normalizers/registry";

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
            ...buildUnkeyedRows(
                emptyKeyRows,
                this.emptyKeyLabel,
                this.keyColumn,
                this.columns,
            ),
            ...buildUnkeyedRows(
                rejectedKeyRows,
                this.rejectedKeyLabel,
                this.keyColumn,
                this.columns,
            ),
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
            mergeConcatDistributed(
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
                mergeConcatDistributed(
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
                    merged[target] = mergeOverwrite(group, column);
                    break;
                case "concat":
                    merged[target] = mergeConcat(group, column, finalSeparator);
                    break;
                case "extra-column":
                    mergeExtraColumns(group, column, merged, target);
                    break;
            }

            if (target !== column) delete merged[column];
        }

        return merged;
    }
}
