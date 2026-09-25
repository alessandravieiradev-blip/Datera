import { Pool } from "mysql2/promise";
import { createPool, readTable, MysqlConnection } from "./client";
import { TableRow } from "../../types";
import { Source } from "../types";
import { consoleLogger, Logger } from "../../logger";

export class MysqlSource implements Source {
    private pool: Pool | undefined;

    constructor(
        private readonly connection: MysqlConnection,
        private readonly table: string,
        private readonly logger: Logger = consoleLogger,
    ) {}

    async read(): Promise<TableRow[]> {
        this.pool ??= createPool(this.connection);
        return readTable(this.pool, this.table, this.logger);
    }

    async close(): Promise<void> {
        await this.pool?.end();
        this.pool = undefined;
    }
}
