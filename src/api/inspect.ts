import { buildHeader } from "../io/header";
import { registerBuiltinKeyNormalizers } from "../normalizers";
import { getKeyNormalizer, listKeyNormalizers } from "../normalizers/registry";
import { TableRow } from "../types";
import { cellOf } from "../cells";

export type ColumnKind = "número" | "texto" | "misto" | "vazio";

export interface ColumnInfo {
    name: string;
    filled: number;
    empty: number;
    distinct: number;
    kind: ColumnKind;
    examples: string[];
}

const EXAMPLES = 3;

function isEmpty(value: TableRow[string] | undefined): boolean {
    return value === null || value === undefined || value === "";
}

function kindOf(values: TableRow[string][]): ColumnKind {
    if (values.length === 0) return "vazio";
    const numbers = values.filter((value) => typeof value === "number").length;
    if (numbers === values.length) return "número";
    return numbers === 0 ? "texto" : "misto";
}

export function describeColumns(rows: TableRow[]): ColumnInfo[] {
    return buildHeader(rows).map((name) => {
        const present = rows
            .map((row) => cellOf(row, name))
            .filter((value): value is string | number => !isEmpty(value));
        const distinct = new Set(present.map((value) => String(value)));
        return {
            name,
            filled: present.length,
            empty: rows.length - present.length,
            distinct: distinct.size,
            kind: kindOf(present),
            examples: [...distinct].slice(0, EXAMPLES),
        };
    });
}

export function listNormalizers(): string[] {
    registerBuiltinKeyNormalizers();
    return listKeyNormalizers();
}

export function normalize(
    name: string,
    value: string | number,
): string | number | null {
    registerBuiltinKeyNormalizers();
    return getKeyNormalizer(name)(value)?.key ?? null;
}
