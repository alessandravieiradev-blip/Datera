import fs from "fs";
import { TableRow } from "../../types";
import { Source } from "../types";
import { quoteTable } from "../sql/names";
import { toRow } from "../sql/cell";
import { loadSqlite } from "./sqlite";

export interface SqliteSourceOptions {
    path: string;
    table: string;
}

export class SqliteSource implements Source {
    constructor(private readonly options: SqliteSourceOptions) {}

    async read(): Promise<TableRow[]> {
        if (!fs.existsSync(this.options.path)) {
            throw new Error(`Arquivo não encontrado: ${this.options.path}`);
        }
        const { DatabaseSync } = loadSqlite();
        const database = new DatabaseSync(this.options.path, {
            readOnly: true,
        });
        try {
            const tables = database
                .prepare(
                    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
                )
                .all()
                .map((row) => String(row.name));
            if (!tables.includes(this.options.table)) {
                throw new Error(
                    `A tabela "${this.options.table}" não existe em ${this.options.path}.` +
                        (tables.length > 0
                            ? ` As que existem são: ${tables.join(", ")}.`
                            : " O arquivo não tem nenhuma tabela."),
                );
            }
            return database
                .prepare(`SELECT * FROM ${quoteTable(this.options.table, '"')}`)
                .all()
                .map((record) => toRow(record));
        } finally {
            database.close();
        }
    }
}
