import { etlConfigSchema } from "../config";
import { assertSourceIsSafe } from "../io/safety";
import { Logger, silentLogger } from "../logger";
import { registerBuiltinKeyNormalizers } from "../normalizers";
import {
    compareRows,
    Comparison,
    comparisonRows,
    comparisonWarnings,
} from "../pipeline/compare";
import { runEtl } from "../pipeline/runEtl";
import { summarize } from "../pipeline/summary";
import { TableRow } from "../types";
import { ReadOptions, WriteOptions } from "./formats";
import {
    destinationOf,
    Input,
    Output,
    readRows,
    sourceOf,
    writeRows,
} from "./rows";

export interface SummaryOptions {
    read?: ReadOptions | undefined;
    write?: WriteOptions | undefined;
    output?: Output | undefined;
    logger?: Logger | undefined;
}

export interface CompareOptions {
    key: string | string[];
    ignore?: string[] | undefined;
    keepUnchanged?: boolean | undefined;
    read?: ReadOptions | undefined;
    write?: WriteOptions | undefined;
    output?: Output | undefined;
    sheetBy?: string | undefined;
    logger?: Logger | undefined;
}

function assertNotInput(
    input: Input,
    output: Output,
    read: ReadOptions,
    write: WriteOptions,
): void {
    assertSourceIsSafe({
        mode: "raw",
        source: sourceOf(input, read),
        destination: destinationOf(output, write),
    });
}

export async function summarizeFile(
    input: Input,
    by: string | string[],
    options: SummaryOptions = {},
): Promise<TableRow[]> {
    const read = options.read ?? {};
    const write = options.write ?? {};
    if (options.output !== undefined) {
        assertNotInput(input, options.output, read, write);
    }
    const summary = summarize(
        await readRows(input, { ...read, logger: options.logger }),
        by,
    );
    if (options.output !== undefined) {
        await writeRows(summary, options.output, write);
    }
    return summary;
}

export async function compareFiles(
    before: Input,
    after: Input,
    options: CompareOptions,
): Promise<Comparison> {
    const read = options.read ?? {};
    const write = options.write ?? {};
    const logger = options.logger ?? silentLogger;
    if (options.output !== undefined) {
        assertNotInput(before, options.output, read, write);
        assertNotInput(after, options.output, read, write);
    }
    const [oldRows, newRows] = await Promise.all([
        readRows(before, { ...read, logger }),
        readRows(after, { ...read, logger }),
    ]);
    const comparison = compareRows(oldRows, newRows, options.key, {
        ignore: options.ignore,
    });
    for (const warning of comparisonWarnings(comparison)) logger.warn(warning);
    if (options.output !== undefined) {
        const rows = comparisonRows(comparison, {
            keepUnchanged: options.keepUnchanged,
        });
        registerBuiltinKeyNormalizers();
        await runEtl(
            etlConfigSchema.parse({
                mode: "raw",
                source: sourceOf(after, read),
                destination: destinationOf(options.output, write),
                sheetBy: options.sheetBy,
            }),
            { logger: silentLogger, source: { read: async () => rows } },
        );
    }
    return comparison;
}
