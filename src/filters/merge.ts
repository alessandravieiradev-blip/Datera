import { Filter } from "./types";
import { TableRow } from "../types";
import { MergeColumnConfig } from "./mergeTypes";

export class MergeFilter implements Filter<TableRow> {
    constructor(
        private readonly keyColumn: string,
        private readonly columns: MergeColumnConfig[]
    ) {}

    apply(rows: TableRow[]): TableRow[] {
        const groups = new Map<unknown, TableRow[]>();

        for (const row of rows) {
            const key = row[this.keyColumn];

            if (key === null || key === undefined) {
                groups.set(Symbol(), [row]);
                continue;
            }

            const existing = groups.get(key);
            if (existing) {
                existing.push(row);
            } else {
                groups.set(key, [row]);
            }
        }

        return Array.from(groups.values()).map((group) =>
            group.length === 1 ? group[0]! : this.mergeGroup(group)
        );
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

    private mergeOverwrite(group: TableRow[], column: string): string | number | null {
        // pega o valor mais recente que não seja nulo
        let result: string | number | null = group[0]?.[column] ?? null;
        for (const row of group) {
            const value = row[column];
            if (value !== null && value !== undefined) {
                result = value;
            }
        }
        return result;
    }

    private mergeConcat(group: TableRow[], column: string, separator: string): string {
        // junta os valores diferentes num texto só, sem repetir o que já apareceu
        const values = group
            .map((row) => row[column])
            .filter((v): v is string | number => v !== null && v !== undefined && v !== "")
            .map(String);

        return Array.from(new Set(values)).join(separator);
    }

    private mergeExtraColumns(group: TableRow[], column: string, merged: TableRow): void {
        // primeiro valor fica na coluna original, o resto vira coluna_2, coluna_3...
        const values = group
            .map((row) => row[column])
            .filter((v): v is string | number => v !== null && v !== undefined && v !== "");

        merged[column] = values[0] ?? null;

        for (let i = 1; i < values.length; i++) {
            merged[`${column}_${i + 1}`] = values[i] ?? null; // o "?? null" é só pro TS ficar feliz, na prática nunca cai aqui
        }
    }
}