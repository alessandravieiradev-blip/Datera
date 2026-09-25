import mysql, { Pool } from "mysql2/promise";
import { TableRow } from "../../types";
import { consoleLogger, Logger } from "../../logger";

export interface MysqlConnection {
    host: string;
    port: number;
    user: string;
    password?: string | undefined;
    database: string;
}

export function createPool(connection: MysqlConnection): Pool {
    return mysql.createPool({
        host: connection.host,
        port: connection.port,
        user: connection.user,
        ...(connection.password !== undefined
            ? { password: connection.password }
            : {}),
        database: connection.database,
    });
}

const RETRYABLE_ERROR_CODES = new Set([
    "PROTOCOL_CONNECTION_LOST",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ECONNRESET",
]);

function isRetryableError(error: unknown): boolean {
    const code = (error as { code?: string })?.code;
    return typeof code === "string" && RETRYABLE_ERROR_CODES.has(code);
}

async function withRetry<T>(
    fn: () => Promise<T>,
    logger: Logger,
    maxRetries: number = 3,
    baseDelayMs: number = 500,
): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isLastAttempt = attempt === maxRetries;
            if (!isRetryableError(error) || isLastAttempt) {
                throw error;
            }

            const delay = baseDelayMs * 2 ** attempt;
            logger.warn(
                `Erro de conexão com o banco. Tentando de novo em ${delay}ms (tentativa ${attempt + 1}/${maxRetries})...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw new Error(
        "withRetry: número de tentativas esgotado sem sucesso e sem erro capturado.",
    );
}

const DEFAULT_BATCH_SIZE = 1000;

export async function* readTableInBatches(
    pool: Pool,
    tableName: string,
    batchSize: number = DEFAULT_BATCH_SIZE,
    logger: Logger = consoleLogger,
): AsyncGenerator<TableRow[]> {
    let offset = 0;

    while (true) {
        const [rows] = await withRetry(
            () =>
                pool.query(`SELECT * FROM ?? LIMIT ? OFFSET ?`, [
                    tableName,
                    batchSize,
                    offset,
                ]),
            logger,
        );
        const batch = rows as TableRow[];

        if (batch.length === 0) {
            break;
        }

        yield batch;

        if (batch.length < batchSize) {
            break;
        }

        offset += batchSize;
    }
}

export async function readTable(
    pool: Pool,
    tableName: string,
    logger: Logger = consoleLogger,
): Promise<TableRow[]> {
    const allRows: TableRow[] = [];

    for await (const batch of readTableInBatches(
        pool,
        tableName,
        DEFAULT_BATCH_SIZE,
        logger,
    )) {
        allRows.push(...batch);
    }

    return allRows;
}
