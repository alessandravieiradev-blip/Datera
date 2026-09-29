import { EtlConfig } from "../config";
import {
    DestinationConfig,
    destinationSchema,
    SourceConfig,
    sourceSchema,
} from "../config/ioSchema";
import { createSink, createSource } from "../io/factory";
import { registerBuiltinKeyNormalizers } from "../normalizers";
import { Logger, silentLogger } from "../logger";
import { TableRow } from "../types";
import {
    destinationFromPath,
    ReadOptions,
    sourceFromPath,
    WriteOptions,
} from "./formats";
import { parseWith } from "./parse";

export type Input = string | SourceConfig;
export type Output = string | DestinationConfig;

export interface ReadRowsOptions extends ReadOptions {
    logger?: Logger | undefined;
}

export interface WriteRowsOptions extends WriteOptions {
    pending?: TableRow[] | undefined;
    pendingName?: string | undefined;
    logger?: Logger | undefined;
}

export const DEFAULT_PENDING_NAME = "Pendências";

function sourceOf(input: Input, options: ReadOptions): SourceConfig {
    return typeof input === "string"
        ? sourceFromPath(input, options)
        : parseWith(sourceSchema, input, "A fonte");
}

function destinationOf(
    output: Output,
    options: WriteOptions,
): DestinationConfig {
    return typeof output === "string"
        ? destinationFromPath(output, options)
        : parseWith(destinationSchema, output, "O destino");
}

export async function readRows(
    input: Input,
    options: ReadRowsOptions = {},
): Promise<TableRow[]> {
    registerBuiltinKeyNormalizers();
    const config: EtlConfig = { mode: "raw", source: sourceOf(input, options) };
    const source = createSource(config, options.logger ?? silentLogger);
    try {
        return await source.read();
    } finally {
        await source.close?.();
    }
}

export async function writeRows(
    rows: TableRow[],
    output: Output,
    options: WriteRowsOptions = {},
): Promise<void> {
    const config: EtlConfig = {
        mode: "raw",
        destination: destinationOf(output, options),
    };
    const sink = createSink(config, options.logger ?? silentLogger);
    await sink.write(rows);
    if (options.pending !== undefined) {
        await sink.write(options.pending, {
            name: options.pendingName ?? DEFAULT_PENDING_NAME,
        });
    }
}

export interface ConvertOptions {
    read?: ReadOptions | undefined;
    write?: WriteOptions | undefined;
    logger?: Logger | undefined;
}

export async function convert(
    input: Input,
    output: Output,
    options: ConvertOptions = {},
): Promise<number> {
    const source = sourceOf(input, options.read ?? {});
    const destination = destinationOf(output, options.write ?? {});
    const config: EtlConfig = { mode: "raw", source, destination };
    const logger = options.logger ?? silentLogger;
    const reader = createSource(config, logger);
    const sink = createSink(config, logger);
    try {
        const rows = await reader.read();
        await sink.write(rows);
        return rows.length;
    } finally {
        await reader.close?.();
    }
}
