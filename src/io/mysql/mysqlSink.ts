import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { consoleLogger, Logger } from "../../logger";
import {
    MARK_PREFIX,
    SqlDialect,
    SqlSession,
    tableParts,
    writeTable,
} from "../sql/writer";
import { TableTarget, tableFor } from "../sql/target";
import { createPool, MysqlConnection } from "./client";

export const MYSQL_DIALECT: SqlDialect = {
    label: "MySQL",
    open: "`",
    close: "`",
    schemas: true,
    maxNameLength: 64,
    nameLength: (name) => name.length,
    maxParams: 60000,
    maxRowsPerInsert: 1000,
    transactionalDdl: false,
    types: { integer: "BIGINT", number: "DOUBLE", text: "LONGTEXT" },
    keyType: "VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin",
    tableSuffix: " DEFAULT CHARSET=utf8mb4",
    param: () => "?",
    tableMark: (token) => ({ inside: "", after: ` COMMENT='${token}'` }),
    tableId: async (session, table) => {
        const parts = tableParts(MYSQL_DIALECT, table);
        const name = parts[parts.length - 1]!;
        const schema = parts.length > 1 ? parts[0]! : null;
        const [found] = await session.all(
            "SELECT TABLE_COMMENT AS id FROM information_schema.tables WHERE table_schema = COALESCE(?, DATABASE()) AND table_name = ? AND table_type = 'BASE TABLE'",
            [schema, name],
        );
        const id = found?.id;
        return typeof id === "string" && id.startsWith(MARK_PREFIX) ? id : null;
    },
    tableExists: async (session, table) => {
        const parts = tableParts(MYSQL_DIALECT, table);
        const name = parts[parts.length - 1]!;
        const schema = parts.length > 1 ? parts[0]! : null;
        const [found] = await session.all(
            "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = COALESCE(?, DATABASE()) AND table_name = ?",
            [schema, name],
        );
        return Number(found?.total ?? 0) > 0;
    },
};

export interface MysqlSession extends SqlSession {
    close(): Promise<void>;
}

export type MysqlSessionFactory = (
    connection: MysqlConnection,
) => Promise<MysqlSession>;

interface MysqlConnectionHandle {
    query(sql: string, values?: unknown[]): Promise<[unknown, unknown]>;
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    release(): void;
}

export const createMysqlSession: MysqlSessionFactory = async (connection) => {
    const pool = createPool(connection);
    let handle: MysqlConnectionHandle;
    try {
        handle =
            (await pool.getConnection()) as unknown as MysqlConnectionHandle;
    } catch (error) {
        await pool.end();
        throw error;
    }
    return {
        run: async (sql, values) => {
            await handle.query(sql, values);
        },
        all: async (sql, values) => {
            const [rows] = await handle.query(sql, values);
            return rows as Record<string, unknown>[];
        },
        begin: () => handle.beginTransaction(),
        commit: () => handle.commit(),
        rollback: () => handle.rollback(),
        close: async () => {
            handle.release();
            await pool.end();
        },
    };
};

export class MysqlSink implements Sink {
    constructor(
        private readonly connection: MysqlConnection,
        private readonly target: TableTarget,
        private readonly logger: Logger = consoleLogger,
        private readonly createSession: MysqlSessionFactory = createMysqlSession,
    ) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const session = await this.createSession(this.connection);
        try {
            await writeTable(
                session,
                MYSQL_DIALECT,
                tableFor(this.target, options),
                rows,
                this.logger,
            );
        } finally {
            await session.close();
        }
    }
}
