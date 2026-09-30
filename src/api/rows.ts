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
import {
    checkPlan,
    extensionFor,
    findFiles,
    PlannedFile,
    planOutputs,
    planSheetOutputs,
} from "./files";
import { SheetRows } from "../io/tabs";
import { detectFormat } from "./formats";
import { alignOptionsOf, alignRows } from "../filters/align";

function aligned(rows: TableRow[], options: ReadOptions): TableRow[] {
    const align = alignOptionsOf(options.alignColumns);
    return align ? alignRows(rows, align) : rows;
}

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

export function sourceOf(input: Input, options: ReadOptions): SourceConfig {
    return typeof input === "string"
        ? sourceFromPath(input, options)
        : parseWith(sourceSchema, input, "A fonte");
}

export function destinationOf(
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
        return aligned(await source.read(), options);
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
        const rows = aligned(await reader.read(), options.read ?? {});
        await sink.write(rows);
        return rows.length;
    } finally {
        await reader.close?.();
    }
}

export async function readSheets(
    input: Input,
    options: ReadRowsOptions = {},
): Promise<SheetRows[]> {
    registerBuiltinKeyNormalizers();
    const config: EtlConfig = { mode: "raw", source: sourceOf(input, options) };
    const source = createSource(config, options.logger ?? silentLogger);
    try {
        if (!source.readTabs) {
            throw new Error(
                "Só dá pra ler aba por aba de um arquivo Excel ou de uma planilha do Google.",
            );
        }
        return (await source.readTabs()).map((tab) => ({
            sheet: tab.sheet,
            rows: aligned(tab.rows, options),
        }));
    } finally {
        await source.close?.();
    }
}

export interface ConvertManyOptions extends ConvertOptions {
    to: string;
    outDir?: string | undefined;
}

export interface ConvertedFile {
    input: string;
    output: string;
    rows: number;
    sheet?: string | undefined;
}

export async function convertMany(
    inputs: string | string[],
    options: ConvertManyOptions,
): Promise<ConvertedFile[]> {
    const files = findFiles(inputs);
    const byTab = options.read?.allSheets === true;
    if (!byTab) {
        return convertPlan(
            planOutputs(files, options.to, options.outDir),
            options,
            new Map(),
        );
    }

    extensionFor(options.to);
    const tabs = new Map<string, SheetRows>();
    const plan: PlannedFile[] = [];
    for (const file of files) {
        if (detectFormat(file) !== "excel") {
            plan.push(...planOutputs([file], options.to, options.outDir));
            continue;
        }
        const sheets = await readSheets(file, {
            ...options.read,
            logger: options.logger,
        });
        const planned = planSheetOutputs(
            file,
            sheets.map((tab) => tab.sheet),
            options.to,
            options.outDir,
        );
        planned.forEach((item, index) => tabs.set(item.output, sheets[index]!));
        plan.push(...planned);
    }
    return convertPlan(checkPlan(plan), options, tabs);
}

async function convertPlan(
    plan: PlannedFile[],
    options: ConvertManyOptions,
    tabs: Map<string, SheetRows>,
): Promise<ConvertedFile[]> {
    const read = { ...options.read, allSheets: undefined };
    const results: ConvertedFile[] = [];
    for (const { input, output, sheet } of plan) {
        try {
            const tab = tabs.get(output);
            let rows: number;
            if (tab) {
                await writeRows(tab.rows, output, {
                    ...options.write,
                    logger: options.logger,
                });
                rows = tab.rows.length;
            } else {
                rows = await convert(input, output, { ...options, read });
            }
            results.push({ input, output, rows, sheet });
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error);
            const done =
                results.length === 0
                    ? ""
                    : ` Os ${results.length} anteriores já foram convertidos.`;
            const where =
                sheet === undefined ? input : `${input} (aba ${sheet})`;
            throw new Error(`Parei em ${where}: ${reason}${done}`);
        }
    }
    return results;
}
