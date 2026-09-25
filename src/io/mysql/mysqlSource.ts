import { Pool } from "mysql2/promise";
import { createPool, readTable, MysqlConnection } from "./client";
import { TableRow } from "../../types";
import { Source } from "../types";

export class MysqlSource implements Source {
    private pool: Pool | undefined;

    constructor(
        private readonly connection: MysqlConnection,
        private readonly table: string,
    ) {}

    async read(): Promise<TableRow[]> {
        // so abre a conexao na hora de ler, nao quando cria a classe
        this.pool ??= createPool(this.connection);
        return readTable(this.pool, this.table);
    }

    async close(): Promise<void> {
        await this.pool?.end();
        this.pool = undefined;
    }
}
