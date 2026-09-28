import type { TableRow } from "../../../../../src";

const NUMBER = /^-?\d+([.,]\d+)?$/;

function columnsOf(rows: TableRow[]): string[] {
    const columns: string[] = [];
    for (const row of rows) {
        for (const column of Object.keys(row)) {
            if (!columns.includes(column)) columns.push(column);
        }
    }
    return columns;
}

function isNumeric(rows: TableRow[], column: string): boolean {
    let seen = false;
    for (const row of rows) {
        const value = row[column];
        if (value === null || value === undefined || value === "") continue;
        if (typeof value !== "number" && !NUMBER.test(String(value)))
            return false;
        seen = true;
    }
    return seen;
}

function cellClass(numeric: boolean, empty: boolean, marked: boolean): string {
    return [numeric ? "num" : "", empty ? "null" : "", marked ? "marked" : ""]
        .filter(Boolean)
        .join(" ");
}

interface DataTableProps {
    rows: TableRow[];
    highlight?: string | undefined;
}

export function DataTable({ rows, highlight }: DataTableProps) {
    const columns = columnsOf(rows);
    const numeric = new Set(
        columns.filter((column) => isNumeric(rows, column)),
    );

    return (
        <div className="table-scroll">
            <table className="data">
                <thead>
                    <tr>
                        <th className="row-number">#</th>
                        {columns.map((column) => (
                            <th
                                key={column}
                                className={cellClass(
                                    numeric.has(column),
                                    false,
                                    column === highlight,
                                )}
                            >
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index}>
                            <td className="row-number">{index + 1}</td>
                            {columns.map((column) => {
                                const value = row[column];
                                const empty =
                                    value === null || value === undefined;
                                const text = empty ? "null" : String(value);
                                return (
                                    <td
                                        key={column}
                                        className={cellClass(
                                            numeric.has(column),
                                            empty,
                                            column === highlight,
                                        )}
                                        title={
                                            text.length > 40 ? text : undefined
                                        }
                                    >
                                        {text}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
