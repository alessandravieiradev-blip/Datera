import { Filter } from "./types";
import { TableRow } from "../types";
import { CombineColumnsConfig, CombinePart } from "./combineTypes";

// junta varias colunas numa so tipo ddd + telefone, roda antes do merge
export class CombineFilter implements Filter<TableRow> {
    constructor(private readonly combinations: CombineColumnsConfig[]) {}

    apply(rows: TableRow[]): TableRow[] {
        const targets = new Set(this.combinations.map((c) => c.into));
        const sourcesToRemove = new Set(
            this.combinations
                .filter((c) => !c.keepSources)
                .flatMap((c) => c.parts.map((p) => p.column))
                .filter((column) => !targets.has(column)),
        );

        return rows.map((row) => {
            // calcula tudo antes de apagar pq o ddd 1 é usado de reserva pelos outros
            const combined = new Map<string, string | null>();
            for (const combination of this.combinations) {
                combined.set(combination.into, this.combine(row, combination));
            }
            return this.rebuildRow(row, combined, sourcesToRemove);
        });
    }

    // remonta a linha pra coluna nova nao ir pro final da planilha
    private rebuildRow(
        row: TableRow,
        combined: Map<string, string | null>,
        sourcesToRemove: Set<string>,
    ): TableRow {
        const anchorOf = new Map<string, string>();
        for (const { into, parts } of this.combinations) {
            const anchor = parts.find((p) => p.column in row)?.column;
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
        { parts, separator = " " }: CombineColumnsConfig,
    ): string | null {
        const values: string[] = [];

        for (const part of parts) {
            const value = this.resolvePart(row, part);
            // se nao tem valor nem default nao combina nada (ddd sem telefone)
            if (value === null) return null;
            values.push(value);
        }

        return values.join(separator);
    }

    private resolvePart(row: TableRow, part: CombinePart): string | null {
        for (const column of [part.column, ...(part.fallbackColumns ?? [])]) {
            const raw = row[column];
            if (raw === null || raw === undefined) continue;
            const text = String(raw).trim();
            if (text !== "") return text;
        }
        return part.default ?? null;
    }
}
