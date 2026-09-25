import { TableRow } from "../../types";
import { Source } from "../types";
import { openWorkbook } from "./workbook";
import { fromExcelCell } from "./excelCell";

export interface ExcelSourceOptions {
    path: string;
    sheet?: string | undefined;
}

export class ExcelSource implements Source {
    constructor(private readonly options: ExcelSourceOptions) {}

    async read(): Promise<TableRow[]> {
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
                row[name] = value;
                if (value !== null) hasValue = true;
            }
            if (hasValue) rows.push(row);
        });

        return rows;
    }
}
