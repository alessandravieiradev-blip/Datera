import { TableRow } from "../../types";
import { Source } from "../types";
import { loadDriver } from "../sql/driver";
import { quoteTable } from "../sql/names";
import { toRow } from "../sql/cell";

export interface SqlServerConnection {
    host: string;
    port: number;
    user: string;
    password?: string | undefined;
    database: string;
    encrypt?: boolean | undefined;
    trustServerCertificate?: boolean | undefined;
}

export interface SqlServerClient {
    query(text: string): Promise<Record<string, unknown>[]>;
    close(): Promise<unknown>;
}

export type SqlServerClientFactory = (
    connection: SqlServerConnection,
) => Promise<SqlServerClient>;

interface MssqlPool {
    connect(): Promise<MssqlPool>;
    request(): {
        query(text: string): Promise<{ recordset: Record<string, unknown>[] }>;
    };
    close(): Promise<unknown>;
}

interface MssqlModule {
    ConnectionPool: new (options: Record<string, unknown>) => MssqlPool;
}

export const createSqlServerClient: SqlServerClientFactory = async (
    connection,
) => {
    const mssql = loadDriver<MssqlModule>(
        () => require("mssql"),
        "mssql",
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
    return {
        query: async (text) => (await pool.request().query(text)).recordset,
        close: () => pool.close(),
    };
};

export class SqlServerSource implements Source {
    constructor(
        private readonly connection: SqlServerConnection,
        private readonly table: string,
        private readonly createClient: SqlServerClientFactory = createSqlServerClient,
    ) {}

    async read(): Promise<TableRow[]> {
        const client = await this.createClient(this.connection);
        try {
            const records = await client.query(
                `SELECT * FROM ${quoteTable(this.table, "[", "]")}`,
            );
            return records.map(toRow);
        } finally {
            await client.close();
        }
    }
}
