import { sheets_v4 } from "googleapis";
import { writeData } from "./client";
import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { consoleLogger, Logger } from "../../logger";

export class SheetsSink implements Sink {
    constructor(
        private readonly sheets: sheets_v4.Sheets,
        private readonly spreadsheetId: string,
        private readonly sheet?: string | undefined,
        private readonly logger: Logger = consoleLogger,
    ) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        await writeData(this.sheets, this.spreadsheetId, rows, {
            sheetName: options.name ?? this.sheet,
            logger: this.logger,
        });
    }
}
