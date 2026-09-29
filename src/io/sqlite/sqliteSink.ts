import fs from "fs";
import path from "path";
import type { DatabaseSync } from "node:sqlite";
import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { consoleLogger, Logger } from "../../logger";
import { SqlDialect, SqlSession, SqlValue, writeTable } from "../sql/writer";
import { TableTarget, tableFor } from "../sql/target";
import { loadSqlite } from "./sqlite";

export interface SqliteSinkOptions extends TableTarget {
    path: string;
}

export const SQLITE_DIALECT: SqlDialect = {
    label: "SQLite",
    open: '"',
    close: '"',
    schemas: false,
    maxNameLength: 1000,
    nameLength: (name) => name.length,
    maxParams: 999,
    maxRowsPerInsert: 500,
    transactionalDdl: true,
    types: { integer: "INTEGER", number: "REAL", text: "TEXT" },
    keyType: "TEXT",
    tableSuffix: "",
    param: () => "?",
    tableMark: (token) => ({ inside: `/* ${token} */ `, after: "" }),
    tableId: async (session, table) => {
        const [found] = await session.all(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(?)",
            [table.trim()],
        );
        const sql = typeof found?.sql === "string" ? found.sql : "";
        return sql.match(/\/\* (datera:[0-9a-f-]+) \*\//)?.[1] ?? null;
    },
    tableExists: async (session, table) =>
        (
            await session.all(
                "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND lower(name) = lower(?)",
                [table.trim()],
            )
        ).length > 0,
};

export function sqliteSession(database: DatabaseSync): SqlSession {
    const params = (values: SqlValue[] = []) => values;
    return {
        run: async (sql, values) => {
            database.prepare(sql).run(...params(values));
        },
        all: async (sql, values) =>
            database.prepare(sql).all(...params(values)) as Record<
                string,
                unknown
            >[],
        begin: async () => database.exec("BEGIN IMMEDIATE"),
        commit: async () => database.exec("COMMIT"),
        rollback: async () => database.exec("ROLLBACK"),
    };
}

export class SqliteSink implements Sink {
    constructor(
        private readonly options: SqliteSinkOptions,
        private readonly logger: Logger = consoleLogger,
    ) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const folder = path.dirname(this.options.path);
        if (folder) fs.mkdirSync(folder, { recursive: true });
        const { DatabaseSync } = loadSqlite();
        const database = new DatabaseSync(this.options.path);
        try {
            await writeTable(
                sqliteSession(database),
                SQLITE_DIALECT,
                tableFor(this.options, options),
                rows,
                this.logger,
            );
        } finally {
            database.close();
        }
    }
}
