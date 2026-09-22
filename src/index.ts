// src/index.ts
import "dotenv/config";
import { readTable, createPool } from "./db";
import { writeData, createSheetsClient } from "./sheets";
import { loadConfig } from "./config";
import { options, validateMode } from "./cli";
import { DedupeFilter } from "./filters/dedupe";
import { TableRow } from "./types";

async function runRawMode(rows: TableRow[]): Promise<TableRow[]> {
    return rows;
}

async function main() {
    const configPath = options.config ?? "./config.json";
    const config = loadConfig(configPath);

    // --mode da CLI vence o mode do config.json; se nenhum dos dois vier, cai pro "raw"
    const mode = validateMode(options.mode ?? config.mode ?? "raw");

    const pool = createPool(config);

    try {
        const rows = await readTable(pool, config.tableName);
        console.log(`${rows.length} linhas lidas do banco.`);
        console.log(`Modo em uso: ${mode}`);

        let processedRows: TableRow[];
        switch (mode) {
            case "raw":
                processedRows = await runRawMode(rows);
                break;
            case "dedupe": {
                if (!config.dedupeColumn) {
                    throw new Error("dedupeColumn não definido na config para o modo dedupe.");
                }
                const filter = new DedupeFilter(config.dedupeColumn, config.dedupeStrategy);
                processedRows = filter.apply(rows);
                break;
            }
            default:
                throw new Error(`Modo não implementado: ${mode}`);
        }

        const sheets = createSheetsClient(config);
        await writeData(sheets, config.spreadsheetId, processedRows);
        console.log("ETL concluído com sucesso!");
    } catch (error) {
        console.error("Deu erro no ETL: ", error);
    } finally {
        await pool.end();
    }
}

main();