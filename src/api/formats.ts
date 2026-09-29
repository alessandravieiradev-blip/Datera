import path from "path";
import { DestinationConfig, SourceConfig } from "../config/ioSchema";

export type FileFormat =
    "csv" | "json" | "xml" | "excel" | "parquet" | "sqlite";

const EXTENSIONS: Record<string, FileFormat> = {
    ".csv": "csv",
    ".tsv": "csv",
    ".txt": "csv",
    ".json": "json",
    ".xml": "xml",
    ".xlsx": "excel",
    ".parquet": "parquet",
    ".db": "sqlite",
    ".sqlite": "sqlite",
    ".sqlite3": "sqlite",
};

export interface ReadOptions {
    table?: string | undefined;
    sheet?: string | undefined;
    recordsPath?: string | undefined;
    delimiter?: string | undefined;
    encoding?: "utf-8" | "latin1" | undefined;
}

export interface WriteOptions {
    sheet?: string | undefined;
    delimiter?: string | undefined;
    bom?: boolean | undefined;
    root?: string | undefined;
    record?: string | undefined;
}

function defined<T extends object>(value: T): T {
    return Object.fromEntries(
        Object.entries(value).filter(([, inner]) => inner !== undefined),
    ) as T;
}

export function detectFormat(filePath: string): FileFormat {
    const extension = path.extname(filePath).toLowerCase();
    const format = EXTENSIONS[extension];
    if (!format) {
        throw new Error(
            `Não sei qual é o formato de "${filePath}" pela extensão. As que eu conheço: ${Object.keys(EXTENSIONS).join(", ")}.`,
        );
    }
    return format;
}

export function sourceFromPath(
    filePath: string,
    options: ReadOptions = {},
): SourceConfig {
    const format = detectFormat(filePath);
    switch (format) {
        case "csv":
            return defined({
                type: "csv",
                path: filePath,
                delimiter:
                    options.delimiter ??
                    (path.extname(filePath).toLowerCase() === ".tsv"
                        ? "\t"
                        : undefined),
                encoding: options.encoding,
            });
        case "json":
            return defined({
                type: "json",
                path: filePath,
                recordsPath: options.recordsPath,
            });
        case "xml":
            return defined({
                type: "xml",
                path: filePath,
                recordsPath: options.recordsPath,
            });
        case "excel":
            return defined({
                type: "excel",
                path: filePath,
                sheet: options.sheet,
            });
        case "parquet":
            return { type: "parquet", path: filePath };
        case "sqlite":
            if (!options.table) {
                throw new Error(
                    `Pra ler o SQLite "${filePath}", diga qual tabela (table).`,
                );
            }
            return { type: "sqlite", path: filePath, table: options.table };
    }
}

export function destinationFromPath(
    filePath: string,
    options: WriteOptions = {},
): DestinationConfig {
    const format = detectFormat(filePath);
    switch (format) {
        case "csv":
            return defined({
                type: "csv",
                path: filePath,
                delimiter:
                    options.delimiter ??
                    (path.extname(filePath).toLowerCase() === ".tsv"
                        ? "\t"
                        : undefined),
                bom: options.bom,
            });
        case "json":
            return { type: "json", path: filePath };
        case "xml":
            return defined({
                type: "xml",
                path: filePath,
                root: options.root,
                record: options.record,
            });
        case "excel":
            return defined({
                type: "excel",
                path: filePath,
                sheet: options.sheet,
            });
        case "parquet":
            return { type: "parquet", path: filePath };
        case "sqlite":
            throw new Error(
                "Ainda não dá pra gravar em SQLite. Escolha outro formato pra saída.",
            );
    }
}
