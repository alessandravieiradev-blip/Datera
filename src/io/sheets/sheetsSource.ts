import type { sheets_v4 } from "@googleapis/sheets";
import { TableRow } from "../../types";
import { Source } from "../types";
import { readSheet, visibleSheetTitles } from "./client";
import { setCell } from "../../cells";
import { DEFAULT_SHEET_COLUMN, joinTabs, SheetRows, TabOptions } from "../tabs";

type CellValue = string | number | null;

function fromSheetCell(value: unknown): CellValue {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" || typeof value === "string") return value;
    return String(value);
}

function rowsFrom(values: unknown[][]): TableRow[] {
    const [header, ...lines] = values;
    if (!header) return [];

    const columns = header.map((cell) => {
        const name = fromSheetCell(cell);
        return name === null ? null : String(name).trim();
    });

    const rows: TableRow[] = [];
    for (const line of lines) {
        const row: TableRow = {};
        let hasValue = false;
        columns.forEach((column, index) => {
            if (column === null) return;
            const value = fromSheetCell(line[index]);
            setCell(row, column, value);
            if (value !== null) hasValue = true;
        });
        if (hasValue) rows.push(row);
    }
    return rows;
}

export class SheetsSource implements Source {
    constructor(
        private readonly sheets: sheets_v4.Sheets,
        private readonly spreadsheetId: string,
        private readonly sheet?: string,
        private readonly tabs: TabOptions = {},
    ) {}

    async readTabs(): Promise<SheetRows[]> {
        const titles = await visibleSheetTitles(
            this.sheets,
            this.spreadsheetId,
        );
        if (titles.length === 0) {
            throw new Error("A planilha não tem nenhuma aba visível pra ler.");
        }
        const tabs: SheetRows[] = [];
        for (const title of titles) {
            tabs.push({
                sheet: title,
                rows: rowsFrom(
                    await readSheet(this.sheets, this.spreadsheetId, title),
                ),
            });
        }
        return tabs;
    }

    async read(): Promise<TableRow[]> {
        if (this.tabs.allSheets) {
            return joinTabs(
                await this.readTabs(),
                this.tabs.sheetColumn ?? DEFAULT_SHEET_COLUMN,
                "a planilha do Google",
            );
        }
        return rowsFrom(
            await readSheet(this.sheets, this.spreadsheetId, this.sheet),
        );
    }
}
