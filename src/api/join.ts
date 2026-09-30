import { EtlConfig, etlConfigSchema } from "../config";
import { AlignOptions } from "../filters/align";
import { DEFAULT_ORIGIN_COLUMN } from "../io/multiSource";
import { Logger, silentLogger } from "../logger";
import { registerBuiltinKeyNormalizers } from "../normalizers";
import { groupRows, RowGroup } from "../pipeline/groups";
import { runEtl } from "../pipeline/runEtl";
import { EtlReport } from "../pipeline/types";
import { TableRow } from "../types";
import { findFiles } from "./files";
import { ReadOptions, sourceFromPath, WriteOptions } from "./formats";
import { destinationOf, Input, Output, sourceOf } from "./rows";

export interface JoinOptions {
    read?: ReadOptions | undefined;
    write?: WriteOptions | undefined;
    originColumn?: string | false | undefined;
    blocks?: boolean | undefined;
    sheetBy?: string | undefined;
    splitBy?: string | undefined;
    align?: boolean | AlignOptions | undefined;
    logger?: Logger | undefined;
}

export interface SplitOptions {
    read?: ReadOptions | undefined;
    write?: WriteOptions | undefined;
    files?: boolean | undefined;
    logger?: Logger | undefined;
}

function run(
    config: EtlConfig,
    logger: Logger | undefined,
): Promise<EtlReport> {
    registerBuiltinKeyNormalizers();
    return runEtl(etlConfigSchema.parse(config), {
        logger: logger ?? silentLogger,
    });
}

export async function joinFiles(
    inputs: string | string[],
    output: Output,
    options: JoinOptions = {},
): Promise<EtlReport> {
    const read = options.read ?? {};
    const origin =
        options.originColumn === undefined
            ? DEFAULT_ORIGIN_COLUMN
            : options.originColumn;
    if (options.blocks && origin === false) {
        throw new Error(
            "Os blocos usam a coluna de origem pra saber onde começa cada arquivo, então ela não pode ser desligada junto.",
        );
    }
    return run(
        {
            mode: "raw",
            sources: findFiles(inputs).map((file) =>
                sourceFromPath(file, read),
            ),
            destination: destinationOf(output, options.write ?? {}),
            originColumn: origin,
            alignColumns: read.alignColumns ?? options.align ?? true,
            blocksBy: options.blocks && origin !== false ? origin : undefined,
            sheetBy: options.sheetBy,
            splitBy: options.splitBy,
        },
        options.logger,
    );
}

export async function splitFile(
    input: Input,
    output: Output,
    column: string,
    options: SplitOptions = {},
): Promise<EtlReport> {
    const read = options.read ?? {};
    const destination = destinationOf(output, options.write ?? {});
    const byTab =
        !options.files &&
        destination.type !== "csv" &&
        destination.type !== "json" &&
        destination.type !== "xml" &&
        destination.type !== "parquet";
    return run(
        {
            mode: "raw",
            source: sourceOf(input, read),
            destination,
            alignColumns: read.alignColumns,
            sheetBy: byTab ? column : undefined,
            splitBy: byTab ? undefined : column,
        },
        options.logger,
    );
}

export function splitRows(rows: TableRow[], column: string): RowGroup[] {
    return groupRows(rows, column);
}
