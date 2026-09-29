import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { consoleLogger, Logger } from "../../logger";
import { requireOptional } from "../optional";
import {
    quoteTableName,
    SqlDialect,
    SqlSession,
    SqlValue,
    writeTable,
} from "../sql/writer";
import { TableTarget, tableFor } from "../sql/target";
import { SqlServerConnection } from "./sqlServerSource";

export const SQLSERVER_DIALECT: SqlDialect = {
    label: "SQL Server",
    open: "[",
    close: "]",
    schemas: true,
    maxNameLength: 128,
    nameLength: (name) => name.length,
    maxParams: 2000,
    maxRowsPerInsert: 1000,
    transactionalDdl: true,
    types: { integer: "BIGINT", number: "FLOAT", text: "NVARCHAR(MAX)" },
    keyType: "NVARCHAR(450) COLLATE Latin1_General_BIN2",
    tableSuffix: "",
    param: (index) => `@p${index}`,
    tableMark: () => ({ inside: "", after: "" }),
    tableId: async (session, table) => {
        const [found] = await session.all(
            "SELECT CAST(OBJECT_ID(@p1, 'U') AS NVARCHAR(20)) AS id",
            [quoteTableName(SQLSERVER_DIALECT, table)],
        );
        return typeof found?.id === "string" ? found.id : null;
    },
    tableExists: async (session, table) => {
        const [found] = await session.all("SELECT OBJECT_ID(@p1) AS id", [
            quoteTableName(SQLSERVER_DIALECT, table),
        ]);
        return found?.id !== null && found?.id !== undefined;
    },
};

export interface SqlServerSession extends SqlSession {
    close(): Promise<void>;
}

export type SqlServerSessionFactory = (
    connection: SqlServerConnection,
) => Promise<SqlServerSession>;

type SqlType = unknown;

interface MssqlRequest {
    input(name: string, type: SqlType, value: SqlValue): MssqlRequest;
    query(text: string): Promise<{ recordset?: Record<string, unknown>[] }>;
}

interface MssqlTransaction {
    begin(): Promise<unknown>;
    commit(): Promise<unknown>;
    rollback(): Promise<unknown>;
}

interface MssqlPool {
    connect(): Promise<MssqlPool>;
    close(): Promise<unknown>;
}

interface MssqlModule {
    ConnectionPool: new (options: Record<string, unknown>) => MssqlPool;
    Transaction: new (pool: MssqlPool) => MssqlTransaction;
    Request: new (parent: MssqlPool | MssqlTransaction) => MssqlRequest;
    BigInt: SqlType;
    Float: SqlType;
    NVarChar: (length: number) => SqlType;
    MAX: number;
}

function typeOf(mssql: MssqlModule, value: SqlValue): SqlType {
    if (typeof value === "number") {
        return Number.isSafeInteger(value) ? mssql.BigInt : mssql.Float;
    }
    return mssql.NVarChar(mssql.MAX);
}

export const createSqlServerSession: SqlServerSessionFactory = async (
    connection,
) => {
    const mssql = requireOptional<MssqlModule>(
        () => require("mssql"),
        ["mssql"],
        "SQL Server",
    );
    const pool = new mssql.ConnectionPool({
        server: connection.host,
        port: connection.port,
        user: connection.user,
        ...(connection.password !== undefined
            ? { password: connection.password }
            : {}),
        database: connection.database,
        options: {
            encrypt: connection.encrypt ?? true,
            trustServerCertificate: connection.trustServerCertificate ?? false,
        },
    });
    await pool.connect();
    let transaction: MssqlTransaction | undefined;

    const request = (sql: string, values: SqlValue[] = []) => {
        const next = new mssql.Request(transaction ?? pool);
        values.forEach((value, index) =>
            next.input(`p${index + 1}`, typeOf(mssql, value), value),
        );
        return next.query(sql);
    };

    return {
        run: async (sql, values) => {
            await request(sql, values);
        },
        all: async (sql, values) =>
            (await request(sql, values)).recordset ?? [],
        begin: async () => {
            transaction = new mssql.Transaction(pool);
            await transaction.begin();
        },
        commit: async () => {
            await transaction?.commit();
            transaction = undefined;
        },
        rollback: async () => {
            const current = transaction;
            transaction = undefined;
            await current?.rollback();
        },
        close: async () => {
            await pool.close();
        },
    };
};

export class SqlServerSink implements Sink {
    constructor(
        private readonly connection: SqlServerConnection,
        private readonly target: TableTarget,
        private readonly logger: Logger = consoleLogger,
        private readonly createSession: SqlServerSessionFactory = createSqlServerSession,
    ) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const session = await this.createSession(this.connection);
        try {
            await writeTable(
                session,
                SQLSERVER_DIALECT,
                tableFor(this.target, options),
                rows,
                this.logger,
            );
        } finally {
            await session.close();
        }
    }
}
