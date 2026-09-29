import { TableRow } from "../../types";
import { Source } from "../types";
import { requireOptional } from "../optional";
import { quoteTable } from "../sql/names";
import { toRow } from "../sql/cell";

export interface PostgresConnection {
    host: string;
    port: number;
    user: string;
    password?: string | undefined;
    database: string;
    ssl?: boolean | undefined;
}

export interface PostgresClient {
    connect(): Promise<unknown>;
    query(
        text: string,
        values?: unknown[],
    ): Promise<{ rows: Record<string, unknown>[] }>;
    end(): Promise<unknown>;
}

export type PostgresClientFactory = (
    connection: PostgresConnection,
) => PostgresClient;

interface PgModule {
    Client: new (options: Record<string, unknown>) => PostgresClient;
}

export const createPostgresClient: PostgresClientFactory = (connection) => {
    const pg = requireOptional<PgModule>(
        () => require("pg"),
        ["pg"],
        "PostgreSQL",
    );
    return new pg.Client({
        host: connection.host,
        port: connection.port,
        user: connection.user,
        ...(connection.password !== undefined
            ? { password: connection.password }
            : {}),
        database: connection.database,
        ...(connection.ssl ? { ssl: true } : {}),
    });
};

export class PostgresSource implements Source {
    constructor(
        private readonly connection: PostgresConnection,
        private readonly table: string,
        private readonly createClient: PostgresClientFactory = createPostgresClient,
    ) {}

    async read(): Promise<TableRow[]> {
        const client = this.createClient(this.connection);
        await client.connect();
        try {
            const result = await client.query(
                `SELECT * FROM ${quoteTable(this.table, '"')}`,
            );
            return result.rows.map(toRow);
        } finally {
            await client.end();
        }
    }
}
