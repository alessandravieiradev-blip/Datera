import type { Worksheet } from "exceljs";
import { TableRow } from "../../types";
import { Source } from "../types";
import { openWorkbook } from "./workbook";
import { fromExcelCell } from "./excelCell";
import { setCell } from "../../cells";
import { DEFAULT_SHEET_COLUMN, joinTabs, SheetRows, TabOptions } from "../tabs";

export interface ExcelSourceOptions extends TabOptions {
    path: string;
    sheet?: string | undefined;
}

function readWorksheet(worksheet: Worksheet): TableRow[] {
    const header = new Map<number, string>();
    worksheet.getRow(1).eachCell((cell, column) => {
        const name = fromExcelCell(cell.value);
        if (name !== null) header.set(column, String(name).trim());
    });

    const rows: TableRow[] = [];
    worksheet.eachRow((excelRow, rowNumber) => {
        if (rowNumber === 1) return;
        const row: TableRow = {};
        let hasValue = false;
        for (const [column, name] of header) {
            const value = fromExcelCell(excelRow.getCell(column).value);
            setCell(row, name, value);
            if (value !== null) hasValue = true;
        }
        if (hasValue) rows.push(row);
    });
    return rows;
}

export class ExcelSource implements Source {
    constructor(private readonly options: ExcelSourceOptions) {}

    async readTabs(): Promise<SheetRows[]> {
        const workbook = await openWorkbook(this.options.path);
        const visible = workbook.worksheets.filter(
            (worksheet) =>
                worksheet.state === undefined || worksheet.state === "visible",
        );
        if (visible.length === 0) {
            throw new Error(
                `O arquivo ${this.options.path} não tem nenhuma aba visível.`,
            );
        }
        return visible.map((worksheet) => ({
            sheet: worksheet.name,
            rows: readWorksheet(worksheet),
        }));
    }

    async read(): Promise<TableRow[]> {
        if (this.options.allSheets) {
            return joinTabs(
                await this.readTabs(),
                this.options.sheetColumn ?? DEFAULT_SHEET_COLUMN,
                this.options.path,
            );
        }

        const workbook = await openWorkbook(this.options.path);
        const sheetName = this.options.sheet;
        const worksheet =
            sheetName === undefined
                ? workbook.worksheets[0]
                : workbook.getWorksheet(sheetName);
        if (!worksheet) {
            const names = workbook.worksheets.map((ws) => ws.name).join(", ");
            throw new Error(
                sheetName === undefined
                    ? `O arquivo ${this.options.path} não tem nenhuma aba.`
                    : `Aba "${sheetName}" não encontrada em ${this.options.path}. Abas: ${names}`,
            );
        }
        return readWorksheet(worksheet);
    }
}
