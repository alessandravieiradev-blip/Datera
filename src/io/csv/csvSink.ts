import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { buildHeader } from "../header";
import { escapeFormula, toCsv } from "./csvFormat";
import { extraOutputPath, writeTextFile } from "../files";
import { consoleLogger, Logger } from "../../logger";
import { cellOf } from "../../cells";

export interface CsvSinkOptions {
    path: string;
    delimiter?: string | undefined;
    bom?: boolean | undefined;
    escapeFormulas?: boolean | undefined;
}

export class CsvSink implements Sink {
    constructor(
        private readonly options: CsvSinkOptions,
        private readonly logger: Logger = consoleLogger,
    ) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const filePath = extraOutputPath(this.options.path, options.name);
        const safe =
            (this.options.escapeFormulas ?? true)
                ? escapeFormula
                : (value: string) => value;
        const header = buildHeader(rows);
        const lines = rows.map((row) =>
            header.map((column) => {
                const value = cellOf(row, column);
                if (value === null || value === undefined) return "";
                return typeof value === "number" ? String(value) : safe(value);
            }),
        );
        const content =
            rows.length === 0
                ? ""
                : toCsv(
                      [header.map(safe), ...lines],
                      this.options.delimiter ?? ",",
                  );
        const bom = (this.options.bom ?? true) ? "\uFEFF" : "";

        writeTextFile(filePath, bom + content + (content ? "\r\n" : ""));
        this.logger.info(`${rows.length} linhas escritas em ${filePath}.`);
    }
}
