import fs from "fs";
import { TableRow } from "../../types";
import { Source } from "../types";
import { toCell } from "../sql/cell";
import { ParquetLibrary, parquetLibrary } from "./parquetLibrary";
import { setCell } from "../../cells";

export interface ParquetSourceOptions {
    path: string;
}

function join(prefix: string, name: string): string {
    return prefix ? `${prefix}.${name}` : name;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Date) &&
        !(value instanceof Uint8Array)
    );
}

function isSimple(value: unknown): boolean {
    return value === null || (typeof value !== "object" && value !== undefined);
}

function flatten(value: unknown, prefix: string, row: TableRow): void {
    if (isPlainObject(value)) {
        for (const [name, inner] of Object.entries(value)) {
            flatten(inner, join(prefix, name), row);
        }
    } else if (Array.isArray(value) && value.every(isSimple)) {
        setCell(
            row,
            prefix,
            value.map((item) => String(toCell(item) ?? "")).join(", "),
        );
    } else {
        setCell(row, prefix, toCell(value));
    }
}

export function parquetRow(record: Record<string, unknown>): TableRow {
    const row: TableRow = {};
    for (const [name, value] of Object.entries(record)) {
        flatten(value, name, row);
    }
    return row;
}

export class ParquetSource implements Source {
    constructor(
        private readonly options: ParquetSourceOptions,
        private readonly library: ParquetLibrary = parquetLibrary,
    ) {}

    async read(): Promise<TableRow[]> {
        if (!fs.existsSync(this.options.path)) {
            throw new Error(`Arquivo não encontrado: ${this.options.path}`);
        }
        let records: Record<string, unknown>[];
        try {
            records = await this.library.read(this.options.path);
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error);
            throw new Error(
                `Não consegui ler o Parquet em ${this.options.path}: ${reason}`,
            );
        }
        return records.map(parquetRow);
    }
}
