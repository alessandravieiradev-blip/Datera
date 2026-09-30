import { TableRow } from "../types";
import { hasCell, setCell } from "../cells";

export const DEFAULT_SHEET_COLUMN = "aba";

export interface SheetRows {
    sheet: string;
    rows: TableRow[];
}

export interface TabOptions {
    allSheets?: boolean | undefined;
    sheetColumn?: string | undefined;
}

export function joinTabs(
    tabs: SheetRows[],
    column: string,
    where: string,
): TableRow[] {
    const joined: TableRow[] = [];
    for (const tab of tabs) {
        for (const row of tab.rows) {
            if (hasCell(row, column)) {
                throw new Error(
                    `A aba "${tab.sheet}" de ${where} já tem uma coluna "${column}". Escolha outro nome pra coluna que guarda a aba (sheetColumn, ou --sheet-column no terminal).`,
                );
            }
            const next: TableRow = {};
            setCell(next, column, tab.sheet);
            for (const [name, value] of Object.entries(row)) {
                setCell(next, name, value);
            }
            joined.push(next);
        }
    }
    return joined;
}
