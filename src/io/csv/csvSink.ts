import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { buildHeader } from "../header";
import { toCsv } from "./csvFormat";
import { extraOutputPath, writeTextFile } from "../files";

export interface CsvSinkOptions {
    path: string;
    delimiter?: string | undefined;
    bom?: boolean | undefined;
}

export class CsvSink implements Sink {
    constructor(private readonly options: CsvSinkOptions) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const filePath = extraOutputPath(this.options.path, options.name);
        const header = buildHeader(rows);
        const lines = rows.map((row) =>
            header.map((column) => {
                const value = row[column];
                return value === null || value === undefined
                    ? ""
                    : String(value);
            }),
        );
        const content =
            rows.length === 0
                ? ""
                : toCsv([header, ...lines], this.options.delimiter ?? ",");
        // o bom faz o excel entender acento em utf-8
        const bom = (this.options.bom ?? true) ? "\uFEFF" : "";

        writeTextFile(filePath, bom + content + (content ? "\r\n" : ""));
        console.log(`${rows.length} linhas escritas em ${filePath}.`);
    }
}
