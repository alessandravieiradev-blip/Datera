import type { TableRow } from "../../../../../src";

interface PreviewTableProps {
    rows: TableRow[];
}

function columnsOf(rows: TableRow[]): string[] {
    const columns: string[] = [];
    for (const row of rows) {
        for (const column of Object.keys(row)) {
            if (!columns.includes(column)) columns.push(column);
        }
    }
    return columns;
}

export function PreviewTable({ rows }: PreviewTableProps) {
    const columns = columnsOf(rows);

    return (
        <div className="table-wrap">
            <table className="table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column}>{column}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index}>
                            {columns.map((column) => (
                                <td key={column}>{row[column] ?? ""}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
