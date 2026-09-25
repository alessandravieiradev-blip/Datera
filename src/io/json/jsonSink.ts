import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { extraOutputPath, writeTextFile } from "../files";
import { consoleLogger, Logger } from "../../logger";

export interface JsonSinkOptions {
    path: string;
}

export class JsonSink implements Sink {
    constructor(
        private readonly options: JsonSinkOptions,
        private readonly logger: Logger = consoleLogger,
    ) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const filePath = extraOutputPath(this.options.path, options.name);
        writeTextFile(filePath, JSON.stringify(rows, null, 2) + "\n");
        this.logger.info(`${rows.length} linhas escritas em ${filePath}.`);
    }
}
