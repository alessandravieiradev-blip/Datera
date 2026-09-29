import { TableRow } from "../../types";
import { buildHeader } from "../header";
import { Logger } from "../../logger";
import { cellOf } from "../../cells";
import crypto from "crypto";

export type ColumnKind = "integer" | "number" | "text";
export type SqlValue = string | number | null;

export interface SqlSession {
    run(sql: string, params?: SqlValue[]): Promise<void>;
    all(sql: string, params?: SqlValue[]): Promise<Record<string, unknown>[]>;
    begin(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}

export interface SqlDialect {
    label: string;
    open: string;
    close: string;
    schemas: boolean;
    maxNameLength: number;
    nameLength(name: string): number;
    maxParams: number;
    maxRowsPerInsert: number;
    transactionalDdl: boolean;
    types: Record<ColumnKind, string>;
    keyType: string;
    tableSuffix: string;
    param(index: number): string;
    tableExists(session: SqlSession, table: string): Promise<boolean>;
    tableMark(token: string): { inside: string; after: string };
    tableId(session: SqlSession, table: string): Promise<string | null>;
    ownsTable?(session: SqlSession, table: string): Promise<boolean>;
}

export const OWNED_TABLES = "datera_tabelas";
export const NEW_SUFFIX = "__datera_novo";
export const OLD_SUFFIX = "__datera_velho";
export const MARK_PREFIX = "datera:";

export function newToken(): string {
    return `${MARK_PREFIX}${crypto.randomUUID()}`;
}

export function quoteName(dialect: SqlDialect, name: string): string {
    const { open, close } = dialect;
    return `${open}${name.split(close).join(close + close)}${close}`;
}

export function tableParts(dialect: SqlDialect, table: string): string[] {
    const trimmed = table.trim();
    const parts = dialect.schemas
        ? trimmed.split(".").map((part) => part.trim())
        : [trimmed];
    if (parts.length > 2 || parts.some((part) => part === "")) {
        throw new Error(`Nome de tabela inválido: "${table}".`);
    }
    return parts;
}

export function quoteTableName(dialect: SqlDialect, table: string): string {
    return tableParts(dialect, table)
        .map((part) => quoteName(dialect, part))
        .join(".");
}

export function nameRoom(dialect: SqlDialect): number {
    return dialect.transactionalDdl ? 0 : OLD_SUFFIX.length;
}

function checkName(dialect: SqlDialect, name: string, what: string): void {
    if (/[\u0000-\u001f\u007f]/.test(name)) {
        throw new Error(
            `${what} "${name.replace(/[\u0000-\u001f\u007f]/g, "?")}" tem um caractere invisível no nome (tipo quebra de linha ou tab). Tire ele antes de gravar no banco.`,
        );
    }
    if (dialect.nameLength(name) > dialect.maxNameLength) {
        throw new Error(
            `${what} "${name}" tem um nome comprido demais pro ${dialect.label}, que aceita até ${dialect.maxNameLength} caracteres. Use um nome mais curto.`,
        );
    }
}

export function checkTableName(
    dialect: SqlDialect,
    table: string,
    extra: number = 0,
): void {
    const parts = tableParts(dialect, table);
    const last = parts[parts.length - 1]!;
    if (dialect.nameLength(last) + extra > dialect.maxNameLength) {
        throw new Error(
            `A tabela "${table}" tem um nome comprido demais pro ${dialect.label}. Use um nome de até ${dialect.maxNameLength - extra} caracteres.`,
        );
    }
    for (const part of parts) checkName(dialect, part, "A tabela");
}

export function checkColumns(dialect: SqlDialect, header: string[]): void {
    const seen = new Map<string, string>();
    for (const column of header) {
        if (column.trim() === "") {
            throw new Error(
                "Tem uma coluna sem nome. Dê um nome pra ela antes de gravar no banco.",
            );
        }
        checkName(dialect, column, "A coluna");
        const key = column.toLowerCase();
        const other = seen.get(key);
        if (other !== undefined) {
            throw new Error(
                `As colunas "${other}" e "${column}" só mudam nas maiúsculas, e o ${dialect.label} pode achar que são a mesma. Troque o nome de uma delas.`,
            );
        }
        seen.set(key, column);
    }
}

export function columnKind(rows: TableRow[], column: string): ColumnKind {
    let kind: ColumnKind | null = null;
    for (const row of rows) {
        const value = cellOf(row, column);
        if (value === null || value === undefined || value === "") continue;
        if (typeof value !== "number") return "text";
        kind =
            kind === "number" || !Number.isSafeInteger(value)
                ? "number"
                : "integer";
    }
    return kind ?? "text";
}

function valueFor(kind: ColumnKind, value: TableRow[string] | undefined) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    return kind === "text" ? String(value) : value;
}

function createTableSql(
    dialect: SqlDialect,
    table: string,
    header: string[],
    kinds: ColumnKind[],
    token: string,
): string {
    const columns = header.map(
        (column, index) =>
            `${quoteName(dialect, column)} ${dialect.types[kinds[index]!]}`,
    );
    const mark = dialect.tableMark(token);
    return `CREATE TABLE ${quoteTableName(dialect, table)} (${mark.inside}${columns.join(", ")})${dialect.tableSuffix}${mark.after}`;
}

async function insertRows(
    session: SqlSession,
    dialect: SqlDialect,
    table: string,
    header: string[],
    kinds: ColumnKind[],
    rows: TableRow[],
): Promise<void> {
    const perInsert = Math.max(
        1,
        Math.min(
            dialect.maxRowsPerInsert,
            Math.floor(dialect.maxParams / header.length),
        ),
    );
    const columns = header.map((column) => quoteName(dialect, column));
    const target = quoteTableName(dialect, table);

    for (let start = 0; start < rows.length; start += perInsert) {
        const batch = rows.slice(start, start + perInsert);
        const params: SqlValue[] = [];
        const tuples = batch.map((row) => {
            const marks = header.map((column, index) => {
                params.push(valueFor(kinds[index]!, cellOf(row, column)));
                return dialect.param(params.length);
            });
            return `(${marks.join(", ")})`;
        });
        await session.run(
            `INSERT INTO ${target} (${columns.join(", ")}) VALUES ${tuples.join(", ")}`,
            params,
        );
    }
}

function ownedTablesName(dialect: SqlDialect): string {
    return quoteName(dialect, OWNED_TABLES);
}

async function ensureOwnedTables(
    session: SqlSession,
    dialect: SqlDialect,
): Promise<void> {
    if (await dialect.tableExists(session, OWNED_TABLES)) {
        if (
            dialect.ownsTable &&
            !(await dialect.ownsTable(session, OWNED_TABLES))
        ) {
            throw new Error(
                `A tabela "${OWNED_TABLES}", onde o Datera anota as tabelas que ele criou, foi criada por outro usuário do ${dialect.label}. Por segurança, ele não confia nela. Use outro banco ou schema, ou peça pra quem cuida do banco apagar essa tabela.`,
            );
        }
        return;
    }
    await session.run(
        `CREATE TABLE ${ownedTablesName(dialect)} (${quoteName(dialect, "tabela")} ${dialect.keyType} PRIMARY KEY, ${quoteName(dialect, "identificador")} ${dialect.types.text}, ${quoteName(dialect, "atualizada_em")} ${dialect.types.text})${dialect.tableSuffix}`,
    );
}

async function isOwned(
    session: SqlSession,
    dialect: SqlDialect,
    table: string,
): Promise<boolean> {
    const found = await session.all(
        `SELECT ${quoteName(dialect, "identificador")} AS ${quoteName(dialect, "identificador")} FROM ${ownedTablesName(dialect)} WHERE ${quoteName(dialect, "tabela")} = ${dialect.param(1)}`,
        [table],
    );
    const saved = found[0]?.identificador;
    if (typeof saved !== "string" || saved === "") return false;
    const current = await dialect.tableId(session, table);
    return current !== null && current === saved;
}

async function markOwned(
    session: SqlSession,
    dialect: SqlDialect,
    table: string,
    id: string,
): Promise<void> {
    await unmarkOwned(session, dialect, table);
    await session.run(
        `INSERT INTO ${ownedTablesName(dialect)} (${quoteName(dialect, "tabela")}, ${quoteName(dialect, "identificador")}, ${quoteName(dialect, "atualizada_em")}) VALUES (${dialect.param(1)}, ${dialect.param(2)}, ${dialect.param(3)})`,
        [table, id, new Date().toISOString()],
    );
}

async function unmarkOwned(
    session: SqlSession,
    dialect: SqlDialect,
    table: string,
): Promise<void> {
    await session.run(
        `DELETE FROM ${ownedTablesName(dialect)} WHERE ${quoteName(dialect, "tabela")} = ${dialect.param(1)}`,
        [table],
    );
}

async function markCurrent(
    session: SqlSession,
    dialect: SqlDialect,
    table: string,
): Promise<void> {
    const id = await dialect.tableId(session, table);
    if (id === null) {
        throw new Error(
            `Não consegui confirmar que a tabela "${table}" foi criada no ${dialect.label}.`,
        );
    }
    await markOwned(session, dialect, table, id);
}

function notOwned(dialect: SqlDialect, table: string): Error {
    return new Error(
        `A tabela "${table}" já existe no ${dialect.label} e não foi o Datera que criou (ou foi apagada e criada de novo por outra pessoa). Pra não apagar nada seu, ele só grava em tabela nova ou em tabela que ele mesmo criou antes. Escolha outro nome.`,
    );
}

async function inTransaction(
    session: SqlSession,
    work: () => Promise<void>,
): Promise<void> {
    await session.begin();
    try {
        await work();
        await session.commit();
    } catch (error) {
        await session.rollback().catch(() => undefined);
        throw error;
    }
}

async function replaceInTransaction(
    session: SqlSession,
    dialect: SqlDialect,
    table: string,
    rows: TableRow[],
    header: string[],
    kinds: ColumnKind[],
): Promise<boolean> {
    let created = true;
    await inTransaction(session, async () => {
        await ensureOwnedTables(session, dialect);
        const exists = await dialect.tableExists(session, table);
        if (exists && !(await isOwned(session, dialect, table))) {
            throw notOwned(dialect, table);
        }
        if (header.length === 0) {
            created = exists;
            if (exists) {
                await session.run(
                    `DELETE FROM ${quoteTableName(dialect, table)}`,
                );
            }
            return;
        }
        if (exists) {
            await session.run(`DROP TABLE ${quoteTableName(dialect, table)}`);
        }
        await session.run(
            createTableSql(dialect, table, header, kinds, newToken()),
        );
        await insertRows(session, dialect, table, header, kinds, rows);
        await markCurrent(session, dialect, table);
    });
    return created;
}

async function dropOwned(
    session: SqlSession,
    dialect: SqlDialect,
    table: string,
): Promise<void> {
    if (!(await dialect.tableExists(session, table))) return;
    if (!(await isOwned(session, dialect, table))) {
        throw notOwned(dialect, table);
    }
    await session.run(`DROP TABLE ${quoteTableName(dialect, table)}`);
    await inTransaction(session, () => unmarkOwned(session, dialect, table));
}

async function replaceBySwap(
    session: SqlSession,
    dialect: SqlDialect,
    table: string,
    rows: TableRow[],
    header: string[],
    kinds: ColumnKind[],
): Promise<boolean> {
    checkTableName(dialect, table, nameRoom(dialect));
    await ensureOwnedTables(session, dialect);
    const exists = await dialect.tableExists(session, table);
    if (exists && !(await isOwned(session, dialect, table))) {
        throw notOwned(dialect, table);
    }
    if (header.length === 0) {
        if (!exists) return false;
        await inTransaction(session, async () => {
            await session.run(`DELETE FROM ${quoteTableName(dialect, table)}`);
        });
        return true;
    }

    const fresh = `${table}${NEW_SUFFIX}`;
    const old = `${table}${OLD_SUFFIX}`;
    await dropOwned(session, dialect, fresh);
    await dropOwned(session, dialect, old);
    const token = newToken();
    await inTransaction(session, () =>
        markOwned(session, dialect, fresh, token),
    );
    try {
        await session.run(createTableSql(dialect, fresh, header, kinds, token));
        const oldId = exists ? await dialect.tableId(session, table) : null;
        await inTransaction(session, async () => {
            await insertRows(session, dialect, fresh, header, kinds, rows);
            if (oldId !== null) await markOwned(session, dialect, old, oldId);
        });
        const target = quoteTableName(dialect, table);
        const freshName = quoteTableName(dialect, fresh);
        await session.run(
            exists
                ? `RENAME TABLE ${target} TO ${quoteTableName(dialect, old)}, ${freshName} TO ${target}`
                : `RENAME TABLE ${freshName} TO ${target}`,
        );
    } catch (error) {
        await dropOwned(session, dialect, fresh).catch(() => undefined);
        throw error;
    }
    await inTransaction(session, async () => {
        await unmarkOwned(session, dialect, fresh);
        await markOwned(session, dialect, table, token);
    });
    await dropOwned(session, dialect, old);
    return true;
}

export async function writeTable(
    session: SqlSession,
    dialect: SqlDialect,
    table: string,
    rows: TableRow[],
    logger: Logger,
): Promise<void> {
    const name = table.trim();
    checkTableName(dialect, name);
    const header = buildHeader(rows);
    checkColumns(dialect, header);
    const kinds = header.map((column) => columnKind(rows, column));

    const created = dialect.transactionalDdl
        ? await replaceInTransaction(
              session,
              dialect,
              name,
              rows,
              header,
              kinds,
          )
        : await replaceBySwap(session, dialect, name, rows, header, kinds);

    logger.info(
        created
            ? `${rows.length} ${rows.length === 1 ? "linha gravada" : "linhas gravadas"} na tabela "${name}" (${dialect.label}).`
            : `Nenhuma linha pra tabela "${name}" (${dialect.label}), então ela não foi criada.`,
    );
}
