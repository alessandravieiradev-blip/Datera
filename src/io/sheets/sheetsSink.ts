import { sheets_v4 } from "googleapis";
import { writeData } from "./client";
import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";

export class SheetsSink implements Sink {
    constructor(
        private readonly sheets: sheets_v4.Sheets,
        private readonly spreadsheetId: string,
    ) {}

    // no sheets a saida extra vira uma aba com esse nome
    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        await writeData(this.sheets, this.spreadsheetId, rows, {
            sheetName: options.name,
        });
    }
}
