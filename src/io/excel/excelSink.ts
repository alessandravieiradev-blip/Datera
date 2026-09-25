import fs from "fs";
import { Workbook } from "exceljs";
import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { buildHeader } from "../header";
import { openWorkbook, saveWorkbook } from "./workbook";
import { consoleLogger, Logger } from "../../logger";

export interface ExcelSinkOptions {
    path: string;
    sheet?: string | undefined;
}

const DEFAULT_SHEET = "Dados";
const MAX_SHEET_NAME = 31;

export function safeSheetName(name: string): string {
    const clean = name
        .replace(/[[\]:*?/\\]/g, " ")
        .trim()
        .slice(0, MAX_SHEET_NAME);
    return clean || DEFAULT_SHEET;
}

export class ExcelSink implements Sink {
    constructor(
        private readonly options: ExcelSinkOptions,
        private readonly logger: Logger = consoleLogger,
    ) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const isMain = options.name === undefined;
        const sheetName = safeSheetName(
            options.name ?? this.options.sheet ?? DEFAULT_SHEET,
        );

        const workbook =
            !isMain && fs.existsSync(this.options.path)
                ? await openWorkbook(this.options.path)
                : new Workbook();
        if (!isMain) {
            const old = workbook.getWorksheet(sheetName);
            if (old) workbook.removeWorksheet(old.id);
        }

        const worksheet = workbook.addWorksheet(sheetName, {
            views: [{ state: "frozen", ySplit: 1 }],
        });
        const header = buildHeader(rows);

        if (header.length > 0) {
            worksheet.addRow(header).font = { bold: true };
            for (const row of rows) {
                worksheet.addRow(header.map((column) => row[column] ?? null));
            }
            header.forEach((column, index) => {
                const longest = Math.max(
                    column.length,
                    ...rows.map((row) => String(row[column] ?? "").length),
                );
                worksheet.getColumn(index + 1).width = Math.min(
                    Math.max(longest + 2, 10),
                    50,
                );
            });
        }

        await saveWorkbook(workbook, this.options.path);
        this.logger.info(
            `${rows.length} linhas escritas na aba "${sheetName}" de ${this.options.path}.`,
        );
    }
}
