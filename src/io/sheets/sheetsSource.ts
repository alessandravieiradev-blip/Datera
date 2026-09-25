import { sheets_v4 } from "@googleapis/sheets";
import { TableRow } from "../../types";
import { Source } from "../types";
import { readSheet } from "./client";

type CellValue = string | number | null;

function fromSheetCell(value: unknown): CellValue {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" || typeof value === "string") return value;
    return String(value);
}

export class SheetsSource implements Source {
    constructor(
        private readonly sheets: sheets_v4.Sheets,
        private readonly spreadsheetId: string,
        private readonly sheet?: string,
    ) {}

    async read(): Promise<TableRow[]> {
        const [header, ...lines] = await readSheet(
            this.sheets,
            this.spreadsheetId,
            this.sheet,
        );
        if (!header) return [];

        const columns = header.map((cell) => {
            const name = fromSheetCell(cell);
            return name === null ? null : String(name).trim();
        });

        const rows: TableRow[] = [];
        for (const values of lines) {
            const row: TableRow = {};
            let hasValue = false;
            columns.forEach((column, index) => {
                if (column === null) return;
                const value = fromSheetCell(values[index]);
                row[column] = value;
                if (value !== null) hasValue = true;
            });
            if (hasValue) rows.push(row);
        }
        return rows;
    }
}
