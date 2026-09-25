import { TableRow } from "../types";
import { Source } from "./types";
import { detectDelimiter, parseCsv, stripBom } from "./csvFormat";
import { FileEncoding, readTextFile } from "./files";

export interface CsvSourceOptions {
    path: string;
    delimiter?: string | undefined;
    encoding?: FileEncoding | undefined;
}

export class CsvSource implements Source {
    constructor(private readonly options: CsvSourceOptions) {}

    async read(): Promise<TableRow[]> {
        const text = stripBom(
            readTextFile(this.options.path, this.options.encoding),
        );
        const delimiter = this.options.delimiter ?? detectDelimiter(text);
        const [header, ...lines] = parseCsv(text, delimiter);
        if (!header) return [];

        const columns = header.map((column) => column.trim());

        return lines.map((values) => {
            const row: TableRow = {};
            columns.forEach((column, index) => {
                const value = values[index];
                // celula vazia vira null, igual vem do banco
                row[column] =
                    value === undefined || value === "" ? null : value;
            });
            return row;
        });
    }
}
