import { TableRow } from "../../types";
import { Sink, SinkWriteOptions } from "../types";
import { consoleLogger, Logger } from "../../logger";
import {
    quoteTableName,
    SqlDialect,
    SqlSession,
    writeTable,
} from "../sql/writer";
import { TableTarget, tableFor } from "../sql/target";
import {
    createPostgresClient,
    PostgresClient,
    PostgresClientFactory,
    PostgresConnection,
} from "./postgresSource";

export const POSTGRES_DIALECT: SqlDialect = {
    label: "PostgreSQL",
    open: '"',
    close: '"',
    schemas: true,
    maxNameLength: 63,
    nameLength: (name) => Buffer.byteLength(name, "utf8"),
    maxParams: 65000,
    maxRowsPerInsert: 1000,
    transactionalDdl: true,
    types: {
        integer: "BIGINT",
        number: "DOUBLE PRECISION",
        text: "TEXT",
    },
    keyType: "TEXT",
    tableSuffix: "",
    param: (index) => `$${index}`,
    tableMark: () => ({ inside: "", after: "" }),
    tableId: async (session, table) => {
        const [found] = await session.all(
            "SELECT to_regclass($1)::oid::text AS id",
            [quoteTableName(POSTGRES_DIALECT, table)],
        );
        return typeof found?.id === "string" ? found.id : null;
    },
    ownsTable: async (session, table) => {
        const [found] = await session.all(
            "SELECT pg_get_userbyid(c.relowner) = current_user AS dono FROM pg_class c WHERE c.oid = to_regclass($1)",
            [quoteTableName(POSTGRES_DIALECT, table)],
        );
        return found?.dono === true;
    },
    tableExists: async (session, table) => {
        const [found] = await session.all("SELECT to_regclass($1) AS nome", [
            quoteTableName(POSTGRES_DIALECT, table),
        ]);
        return found?.nome !== null && found?.nome !== undefined;
    },
};

export function postgresSession(client: PostgresClient): SqlSession {
    return {
        run: async (sql, values) => {
            await client.query(sql, values);
        },
        all: async (sql, values) => (await client.query(sql, values)).rows,
        begin: async () => {
            await client.query("BEGIN");
        },
        commit: async () => {
            await client.query("COMMIT");
        },
        rollback: async () => {
            await client.query("ROLLBACK");
        },
    };
}

export class PostgresSink implements Sink {
    constructor(
        private readonly connection: PostgresConnection,
        private readonly target: TableTarget,
        private readonly logger: Logger = consoleLogger,
        private readonly createClient: PostgresClientFactory = createPostgresClient,
    ) {}

    async write(
        rows: TableRow[],
        options: SinkWriteOptions = {},
    ): Promise<void> {
        const client = this.createClient(this.connection);
        await client.connect();
        try {
            await writeTable(
                postgresSession(client),
                POSTGRES_DIALECT,
                tableFor(this.target, options),
                rows,
                this.logger,
            );
        } finally {
            await client.end();
        }
    }
}
