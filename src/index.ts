import "dotenv/config";
import { readTable, createPool } from "./db";
import { writeData, createSheetsClient } from "./sheets";
import { loadConfig, EtlConfig } from "./config";
import { options, validateMode } from "./cli";
import { DedupeFilter } from "./filters/dedupe";
import { TableRow } from "./types";
import { MergeFilter } from "./filters/merge";
import { CombineFilter } from "./filters/combine";
import { FillEmptyFilter } from "./filters/fillEmpty";
import {
    RowValidator,
    ValidationResult,
    DEFAULT_PENDING_SHEET,
} from "./filters/validate";
import {
    registerBuiltinKeyNormalizers,
    loadNormalizerModules,
} from "./filters/normalizers";

async function runRawMode(rows: TableRow[]): Promise<TableRow[]> {
    return rows;
}

// etapas que rodam antes do modo, na ordem: preencher vazios e depois juntar colunas
function prepareRows(rows: TableRow[], config: EtlConfig): TableRow[] {
    let prepared = rows;
    if (config.fillEmpty)
        prepared = new FillEmptyFilter(config.fillEmpty).apply(prepared);
    if (config.combineColumns)
        prepared = new CombineFilter(config.combineColumns).apply(prepared);
    return prepared;
}

// linha com problema vai pra aba de pendencias e nao passa pelo modo
function validateRows(rows: TableRow[], config: EtlConfig): ValidationResult {
    if (!config.validation) return { valid: rows, pending: [] };

    const validator = new RowValidator(
        config.validation.rules,
        config.validation.reasonColumn,
    );
    const result = validator.split(rows);
    console.log(
        `${result.valid.length} linhas válidas e ${result.pending.length} pendências.`,
    );
    return result;
}

async function main() {
    registerBuiltinKeyNormalizers();
    const configPath = options.config ?? "./config.json";
    const config = loadConfig(configPath);
    loadNormalizerModules(config.normalizerModules ?? []);

    const mode = validateMode(options.mode ?? config.mode ?? "raw");

    const pool = createPool(config);

    try {
        const rawRows = await readTable(pool, config.tableName);
        console.log(`${rawRows.length} linhas lidas do banco.`);

        const { valid: rows, pending } = validateRows(
            prepareRows(rawRows, config),
            config,
        );
        console.log(`Modo em uso: ${mode}`);

        let processedRows: TableRow[];
        switch (mode) {
            case "raw":
                processedRows = await runRawMode(rows);
                break;
            case "dedupe": {
                if (!config.dedupeColumn) {
                    throw new Error(
                        "dedupeColumn não definido na config para o modo dedupe.",
                    );
                }
                const filter = new DedupeFilter(
                    config.dedupeColumn,
                    config.dedupeStrategy,
                );
                processedRows = filter.apply(rows);
                break;
            }
            case "merge": {
                if (!config.mergeKeyColumn || !config.mergeColumns) {
                    throw new Error(
                        "mergeKeyColumn/mergeColumns não definidos na config para o modo merge.",
                    );
                }
                const filter = new MergeFilter(
                    config.mergeKeyColumn,
                    config.mergeColumns,
                    {
                        emptyKeyLabel: config.mergeEmptyKeyLabel,
                        rejectedKeyLabel: config.mergeRejectedKeyLabel,
                        keyNormalizer: config.mergeKeyNormalizer,
                    },
                );
                processedRows = filter.apply(rows);
                break;
            }
            default:
                throw new Error(`Modo não implementado: ${mode}`);
        }

        const sheets = createSheetsClient(config);
        await writeData(sheets, config.spreadsheetId, processedRows);
        if (config.validation) {
            await writeData(sheets, config.spreadsheetId, pending, {
                sheetName:
                    config.validation.pendingSheet ?? DEFAULT_PENDING_SHEET,
            });
        }
        console.log("ETL concluído com sucesso!");
    } catch (error) {
        console.error("Deu erro no ETL: ", error);
    } finally {
        await pool.end();
    }
}

main();
