import { TableRow } from "../types";
import { Sink, SinkWriteOptions } from "./types";
import { extraOutputPath, writeTextFile } from "./files";

export interface JsonSinkOptions {
    path: string;
}

export class JsonSink implements Sink {
    constructor(private readonly options: JsonSinkOptions) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const filePath = extraOutputPath(this.options.path, options.name);
        writeTextFile(filePath, JSON.stringify(rows, null, 2) + "\n");
        console.log(`${rows.length} linhas escritas em ${filePath}.`);
    }
}
