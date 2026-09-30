import { TableRow } from "../types";
import { cellOf, hasCell, setCell } from "../cells";

export interface AlignOptions {
    auto?: boolean | undefined;
    rename?: Record<string, string> | undefined;
}

export const ALIGN_SEPARATOR = " | ";

export function columnKey(name: string): string {
    const key = name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    return key === "" ? `=${name}` : key;
}

function columnNames(rows: TableRow[]): string[] {
    const seen = new Set<string>();
    for (const row of rows) {
        for (const name of Object.keys(row)) seen.add(name);
    }
    return [...seen];
}

export function columnMapping(
    names: string[],
    options: AlignOptions = {},
): Map<string, string> {
    const auto = options.auto ?? true;
    const renameByKey = new Map<string, string>();
    for (const [from, to] of Object.entries(options.rename ?? {})) {
        const target = to.trim();
        const key = columnKey(from);
        const other = renameByKey.get(key);
        if (other !== undefined && other !== target) {
            throw new Error(
                `A coluna "${from}" está no rename duas vezes, uma indo pra "${other}" e outra pra "${target}". Deixe só uma.`,
            );
        }
        renameByKey.set(key, target);
    }

    const canonical = new Map<string, string>();
    for (const target of renameByKey.values()) {
        const key = columnKey(target);
        if (!canonical.has(key)) canonical.set(key, target);
    }

    const mapping = new Map<string, string>();
    for (const name of names) {
        const renamed = renameByKey.get(columnKey(name));
        if (renamed !== undefined) {
            mapping.set(
                name,
                auto ? (canonical.get(columnKey(renamed)) ?? renamed) : renamed,
            );
            continue;
        }
        if (!auto) {
            mapping.set(name, name);
            continue;
        }
        const key = columnKey(name);
        const first = canonical.get(key);
        if (first === undefined) canonical.set(key, name);
        mapping.set(name, first ?? name);
    }
    return mapping;
}

export function similarColumns(names: string[]): string[][] {
    const groups = new Map<string, string[]>();
    for (const name of names) {
        const key = columnKey(name);
        groups.set(key, [...(groups.get(key) ?? []), name]);
    }
    return [...groups.values()].filter((group) => group.length > 1);
}

function isEmpty(value: TableRow[string] | undefined): boolean {
    return value === null || value === undefined || value === "";
}

export function alignRows(
    rows: TableRow[],
    options: AlignOptions = {},
): TableRow[] {
    const mapping = columnMapping(columnNames(rows), options);
    if ([...mapping].every(([from, to]) => from === to)) return rows;

    return rows.map((row) => {
        const next: TableRow = {};
        for (const [name, value] of Object.entries(row)) {
            const target = mapping.get(name) ?? name;
            if (!hasCell(next, target)) {
                setCell(next, target, value);
                continue;
            }
            const current = cellOf(next, target);
            if (isEmpty(current)) {
                setCell(next, target, value);
            } else if (!isEmpty(value) && String(value) !== String(current)) {
                setCell(
                    next,
                    target,
                    `${String(current)}${ALIGN_SEPARATOR}${String(value)}`,
                );
            }
        }
        return next;
    });
}

export function alignOptionsOf(
    value: boolean | AlignOptions | undefined,
): AlignOptions | undefined {
    if (value === undefined || value === false) return undefined;
    return value === true ? {} : value;
}
