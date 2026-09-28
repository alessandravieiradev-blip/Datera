import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { extraOutputPath, writeTextFile } from "../files";
import { consoleLogger, Logger } from "../../logger";

export interface XmlSinkOptions {
    path: string;
    root?: string | undefined;
    record?: string | undefined;
}

export const DEFAULT_XML_ROOT = "registros";
export const DEFAULT_XML_RECORD = "registro";

const INDENT = "  ";

function escapeText(value: string): string {
    return value
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export function xmlNameFor(column: string): string {
    const cleaned = column.trim().replace(/[^\p{L}\p{N}_.-]+/gu, "_");
    if (cleaned === "") return "coluna";
    return /^[\p{L}_]/u.test(cleaned) ? cleaned : `_${cleaned}`;
}

function elementNames(columns: string[]): Map<string, string> {
    const names = new Map<string, string>();
    const used = new Set<string>();
    for (const column of columns) {
        const base = xmlNameFor(column);
        let name = base;
        for (let count = 2; used.has(name); count++) name = `${base}_${count}`;
        used.add(name);
        names.set(column, name);
    }
    return names;
}

function columnsOf(rows: TableRow[]): string[] {
    const columns = new Set<string>();
    for (const row of rows) {
        for (const column of Object.keys(row)) columns.add(column);
    }
    return [...columns];
}

export function toXml(
    rows: TableRow[],
    root: string,
    record: string,
    names: Map<string, string> = elementNames(columnsOf(rows)),
): string {
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>', `<${root}>`];
    for (const row of rows) {
        lines.push(`${INDENT}<${record}>`);
        for (const [column, value] of Object.entries(row)) {
            const name = names.get(column) ?? xmlNameFor(column);
            lines.push(
                value === null || value === ""
                    ? `${INDENT}${INDENT}<${name}/>`
                    : `${INDENT}${INDENT}<${name}>${escapeText(String(value))}</${name}>`,
            );
        }
        lines.push(`${INDENT}</${record}>`);
    }
    lines.push(`</${root}>`);
    return lines.join("\n") + "\n";
}

export class XmlSink implements Sink {
    constructor(
        private readonly options: XmlSinkOptions,
        private readonly logger: Logger = consoleLogger,
    ) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const filePath = extraOutputPath(this.options.path, options.name);
        const names = elementNames(columnsOf(rows));
        for (const [column, name] of names) {
            if (column !== name) {
                this.logger.warn(
                    `A coluna "${column}" virou <${name}> no XML, porque o nome original não vale como elemento.`,
                );
            }
        }
        writeTextFile(
            filePath,
            toXml(
                rows,
                this.options.root ?? DEFAULT_XML_ROOT,
                this.options.record ?? DEFAULT_XML_RECORD,
                names,
            ),
        );
        this.logger.info(`${rows.length} linhas escritas em ${filePath}.`);
    }
}
