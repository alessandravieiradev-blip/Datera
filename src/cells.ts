import { TableRow } from "./types";

export type Cell = TableRow[string];

const own = Object.prototype.hasOwnProperty;

export function hasCell(row: TableRow, column: string): boolean {
    return own.call(row, column);
}

export function cellOf(row: TableRow, column: string): Cell | undefined {
    return own.call(row, column) ? row[column] : undefined;
}

export function setCell(row: TableRow, column: string, value: Cell): void {
    if (column === "__proto__") {
        Object.defineProperty(row, column, {
            value,
            writable: true,
            enumerable: true,
            configurable: true,
        });
        return;
    }
    row[column] = value;
}
