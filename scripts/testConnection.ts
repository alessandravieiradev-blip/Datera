import "dotenv/config";
import { readTable, createPool } from "../src/db";
import { requireEnv } from "../src/env";

async function main() {
    const pool = createPool({
        host: requireEnv("DB_HOST"),
        port: Number(process.env.DB_PORT ?? 3306),
        user: requireEnv("DB_USER"),
        password: requireEnv("DB_PASSWORD"),
        database: requireEnv("DB_NAME"),
    });

    try {
        const tableName = process.env.DB_TABLE!;
        console.log("Tentando ler a tabela:", tableName);

        const rows = await readTable(pool, tableName);

        console.log("Deu certo! Total de linhas na tabela:", rows.length);
        console.log("As primeiras 3 linhas:", rows.slice(0, 3));
    } catch (error) {
        console.error("Deu erro:", error);
    } finally {
        await pool.end();
    }
}

main();
