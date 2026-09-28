import fs from "fs";
import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { extraOutputPath } from "../files";
import { buildHeader } from "../header";
import { consoleLogger, Logger } from "../../logger";
import {
    ParquetColumn,
    ParquetColumnType,
    ParquetLibrary,
    parquetLibrary,
} from "./parquetLibrary";

export interface ParquetSinkOptions {
    path: string;
}

const INT32_MIN = -(2 ** 31);
const INT32_MAX = 2 ** 31 - 1;

function typeOf(values: TableRow[string][]): ParquetColumnType {
    const present = values.filter((value) => value !== null);
    if (present.length === 0) return "STRING";
    if (!present.every((value) => typeof value === "number")) return "STRING";
    const integers = present.every(
        (value) =>
            Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX,
    );
    return integers ? "INT32" : "DOUBLE";
}

export function parquetColumns(rows: TableRow[]): ParquetColumn[] {
    return buildHeader(rows).map((name) => {
        const values = rows.map((row) => row[name] ?? null);
        const type = typeOf(values);
        return {
            name,
            type,
            data:
                type === "STRING"
                    ? values.map((value) =>
                          value === null ? null : String(value),
                      )
                    : values,
        };
    });
}

export class ParquetSink implements Sink {
    constructor(
        private readonly options: ParquetSinkOptions,
        private readonly logger: Logger = consoleLogger,
        private readonly library: ParquetLibrary = parquetLibrary,
    ) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const filePath = extraOutputPath(this.options.path, options.name);
        const columns = parquetColumns(rows);
        if (columns.length === 0) {
            fs.rmSync(filePath, { force: true });
            this.logger.info(`Nenhuma linha pra escrever em ${filePath}.`);
            return;
        }
        await this.library.write(filePath, columns);
        this.logger.info(`${rows.length} linhas escritas em ${filePath}.`);
    }
}
