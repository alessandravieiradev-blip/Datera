import { TableRow } from "../types";
import { Source } from "./types";
import { hasCell, setCell } from "../cells";

export const DEFAULT_ORIGIN_COLUMN = "origem";

export interface SourcePart {
    label: string;
    source: Source;
}

export class MultiSource implements Source {
    constructor(
        private readonly parts: SourcePart[],
        private readonly column: string | false,
    ) {}

    async read(): Promise<TableRow[]> {
        const joined: TableRow[] = [];
        for (const { label, source } of this.parts) {
            for (const row of await source.read()) {
                if (this.column === false) {
                    joined.push(row);
                    continue;
                }
                if (hasCell(row, this.column)) {
                    throw new Error(
                        `${label} já tem uma coluna "${this.column}". Escolha outro nome pra coluna de origem (originColumn, ou --origin-column no terminal).`,
                    );
                }
                const next: TableRow = {};
                setCell(next, this.column, label);
                for (const [name, value] of Object.entries(row)) {
                    setCell(next, name, value);
                }
                joined.push(next);
            }
        }
        return joined;
    }

    async close(): Promise<void> {
        for (const { source } of this.parts) await source.close?.();
    }
}
