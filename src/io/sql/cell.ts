import { TableRow } from "../../types";

type Cell = TableRow[string];

function isoDate(date: Date): string {
    if (Number.isNaN(date.getTime())) return "";
    const iso = date.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
}

export function toCell(value: unknown): Cell {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") return value === "" ? null : value;
    if (typeof value === "bigint") {
        return Number.isSafeInteger(Number(value))
            ? Number(value)
            : value.toString();
    }
    if (typeof value === "boolean") return String(value);
    if (value instanceof Date) return isoDate(value) || null;
    if (value instanceof Uint8Array) {
        return Buffer.from(value).toString("base64");
    }
    return JSON.stringify(value, (_key, inner: unknown) =>
        typeof inner === "bigint" ? inner.toString() : inner,
    );
}

export function toRow(record: Record<string, unknown>): TableRow {
    const row: TableRow = {};
    for (const [column, value] of Object.entries(record)) {
        row[column] = toCell(value);
    }
    return row;
}
