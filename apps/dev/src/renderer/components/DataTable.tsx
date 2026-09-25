import type { TableRow } from "../../../../../src";

function columnsOf(rows: TableRow[]): string[] {
    const columns: string[] = [];
    for (const row of rows) {
        for (const column of Object.keys(row)) {
            if (!columns.includes(column)) columns.push(column);
        }
    }
    return columns;
}

interface DataTableProps {
    rows: TableRow[];
    highlight?: string | undefined;
}

export function DataTable({ rows, highlight }: DataTableProps) {
    const columns = columnsOf(rows);
    return (
        <div className="table-scroll">
            <table className="data">
                <thead>
                    <tr>
                        <th className="row-number">#</th>
                        {columns.map((column) => (
                            <th
                                key={column}
                                className={column === highlight ? "marked" : ""}
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
                                return (
                                    <td
                                        key={column}
                                        className={`${value === null || value === undefined ? "null" : ""} ${column === highlight ? "marked" : ""}`}
                                    >
                                        {value === null || value === undefined
                                            ? "null"
                                            : String(value)}
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
