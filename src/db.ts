import mysql, { Pool } from "mysql2/promise";
import { EtlConfig } from "./config";
import { TableRow } from "./types";

export function createPool(config: EtlConfig): Pool {
  return mysql.createPool({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  })
};

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
  maxRetries: number = 3,
  baseDelayMs: number = 500
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
      console.error(
        `Erro de conexão com o banco. Tentando de novo em ${delay}ms (tentativa ${attempt + 1}/${maxRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("withRetry: número de tentativas esgotado sem sucesso e sem erro capturado.");
}

const DEFAULT_BATCH_SIZE = 1000;

export async function* readTableInBatches(
  pool: Pool,
  tableName: string,
  batchSize: number = DEFAULT_BATCH_SIZE
): AsyncGenerator<TableRow[]> {
  let offset = 0;

  while (true) {
    const [rows] = await withRetry(() =>
      pool.query(`SELECT * FROM ?? LIMIT ? OFFSET ?`, [tableName, batchSize, offset])
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

export async function readTable(pool: Pool, tableName: string): Promise<TableRow[]> {
  const allRows: TableRow[] = [];

  for await (const batch of readTableInBatches(pool, tableName)) {
    allRows.push(...batch);
  }

  return allRows;
}