import fs from "fs";
import path from "path";
import { SourceConfig } from "../config/ioSchema";
import { findFiles } from "../api/files";
import { DEFAULT_ORIGIN_COLUMN, MultiSource } from "./multiSource";
import { EtlConfig } from "../config";
import { createSheetsClient } from "./sheets/client";
import { Sink, Source } from "./types";
import { MysqlSource } from "./mysql/mysqlSource";
import { CsvSource } from "./csv/csvSource";
import { JsonSource } from "./json/jsonSource";
import { SheetsSink } from "./sheets/sheetsSink";
import { CsvSink } from "./csv/csvSink";
import { JsonSink } from "./json/jsonSink";
import { XmlSource } from "./xml/xmlSource";
import { PostgresSource } from "./postgres/postgresSource";
import { SqlServerSource } from "./sqlserver/sqlServerSource";
import { SqliteSource } from "./sqlite/sqliteSource";
import { SqliteSink } from "./sqlite/sqliteSink";
import { PostgresSink } from "./postgres/postgresSink";
import { SqlServerSink } from "./sqlserver/sqlServerSink";
import { MysqlSink } from "./mysql/mysqlSink";
import { XmlSink } from "./xml/xmlSink";
import { ParquetSource } from "./parquet/parquetSource";
import { ParquetSink } from "./parquet/parquetSink";
import { ExcelSource } from "./excel/excelSource";
import { ExcelSink } from "./excel/excelSink";
import { SheetsSource } from "./sheets/sheetsSource";
import { createCustomSink, createCustomSource } from "./custom/registry";
import { consoleLogger, Logger } from "../logger";
import { assertSourceIsSafe, isSameFile } from "./safety";
import { destinationSharesSource, serverOf } from "./servers";

const SERVER_NAMES = {
    mysql: "MySQL",
    postgres: "PostgreSQL",
    sqlserver: "SQL Server",
};

function required<T>(value: T | undefined, what: string): T {
    if (value === undefined || value === "") {
        throw new Error(`Faltou configurar ${what}.`);
    }
    return value;
}

function hasPath(
    source: SourceConfig,
): source is Extract<SourceConfig, { path: string }> {
    return "path" in source && typeof source.path === "string";
}

export function expandSources(sources: SourceConfig[]): SourceConfig[] {
    const expanded: SourceConfig[] = [];
    for (const source of sources) {
        if (!hasPath(source)) {
            expanded.push(source);
            continue;
        }
        const isPattern =
            /[*?]/.test(source.path) ||
            (fs.existsSync(source.path) &&
                fs.statSync(source.path).isDirectory());
        if (!isPattern) {
            expanded.push(source);
            continue;
        }
        for (const file of findFiles(source.path)) {
            expanded.push({ ...source, path: file });
        }
    }
    return expanded;
}

function assertSourcesAreSafe(config: EtlConfig): void {
    const destination = config.destination;
    if (!config.sources || !destination || !("path" in destination)) return;
    for (const part of expandSources(config.sources)) {
        if (hasPath(part) && isSameFile(part.path, destination.path)) {
            throw new Error(
                `${part.path} é uma das fontes e também o destino. O destino é apagado antes de gravar, então escolha outro arquivo pra saída.`,
            );
        }
    }
}

export function sourceLabel(source: SourceConfig): string {
    if (hasPath(source)) {
        return path.basename(source.path, path.extname(source.path));
    }
    if (source.type === "sheets") return source.spreadsheetId;
    if (source.type === "custom") return source.adapter;
    return source.table ?? source.type;
}

export function createSource(
    config: EtlConfig,
    logger: Logger = consoleLogger,
): Source {
    if (config.sources) {
        const parts = expandSources(config.sources);
        const labels = parts.map(sourceLabel);
        return new MultiSource(
            parts.map((part, index) => {
                const label = labels[index]!;
                const repeated =
                    labels.indexOf(label) !== labels.lastIndexOf(label);
                return {
                    label:
                        repeated && hasPath(part)
                            ? path.relative(process.cwd(), part.path)
                            : label,
                    source: createSource(
                        { ...config, sources: undefined, source: part },
                        logger,
                    ),
                };
            }),
            config.originColumn ?? DEFAULT_ORIGIN_COLUMN,
        );
    }
    const source = config.source ?? { type: "mysql" as const };

    switch (source.type) {
        case "mysql":
            return new MysqlSource(
                {
                    host: required(
                        source.host ?? config.dbHost,
                        "o host do MySQL",
                    ),
                    port: serverOf(config, "source")!.port,
                    user: required(
                        source.user ?? config.dbUser,
                        "o usuário do MySQL",
                    ),
                    password: source.password ?? config.dbPassword,
                    database: required(
                        source.database ?? config.dbName,
                        "o banco do MySQL",
                    ),
                    ssl: source.ssl,
                },
                required(source.table ?? config.tableName, "a tabela do MySQL"),
                logger,
            );
        case "postgres":
            return new PostgresSource(
                {
                    host: required(source.host, "o host do PostgreSQL"),
                    port: serverOf(config, "source")!.port,
                    user: required(source.user, "o usuário do PostgreSQL"),
                    password: source.password,
                    database: required(
                        source.database,
                        "o banco do PostgreSQL",
                    ),
                    ssl: source.ssl,
                },
                required(source.table, "a tabela do PostgreSQL"),
            );
        case "sqlserver":
            return new SqlServerSource(
                {
                    host: required(source.host, "o servidor do SQL Server"),
                    port: serverOf(config, "source")!.port,
                    user: required(source.user, "o usuário do SQL Server"),
                    password: source.password,
                    database: required(
                        source.database,
                        "o banco do SQL Server",
                    ),
                    encrypt: source.encrypt,
                    trustServerCertificate: source.trustServerCertificate,
                },
                required(source.table, "a tabela do SQL Server"),
            );
        case "sqlite":
            return new SqliteSource(source);
        case "csv":
            return new CsvSource(source);
        case "json":
            return new JsonSource(source);
        case "xml":
            return new XmlSource(source);
        case "parquet":
            return new ParquetSource(source);
        case "excel":
            return new ExcelSource(source);
        case "sheets": {
            const credentialsPath = required(
                source.credentialsPath ?? config.credentialsPath,
                "o caminho das credenciais do Google",
            );
            return new SheetsSource(
                createSheetsClient(credentialsPath),
                source.spreadsheetId,
                source.sheet,
                {
                    allSheets: source.allSheets,
                    sheetColumn: source.sheetColumn,
                },
            );
        }
        case "custom":
            return createCustomSource(
                source.adapter,
                source.options ?? {},
                logger,
            );
    }
}

export function createSink(
    config: EtlConfig,
    logger: Logger = consoleLogger,
): Sink {
    assertSourceIsSafe(config);
    assertSourcesAreSafe(config);
    const destination = config.destination ?? { type: "sheets" as const };

    switch (destination.type) {
        case "mysql":
        case "postgres":
        case "sqlserver": {
            const server = serverOf(config, "destination")!;
            const what = SERVER_NAMES[destination.type];
            const connection = {
                host: required(server.host, `o host do ${what} de destino`),
                port: server.port,
                user: required(server.user, `o usuário do ${what} de destino`),
                password: server.password,
                database: required(
                    server.database,
                    `o banco do ${what} de destino`,
                ),
            };
            const target = {
                table: required(
                    destination.table,
                    `a tabela do ${what} onde gravar`,
                ),
                pendingTable: destination.pendingTable,
            };
            if (destination.type === "mysql") {
                const same =
                    config.source?.type === "mysql" &&
                    destinationSharesSource(config)
                        ? config.source
                        : undefined;
                return new MysqlSink(
                    { ...connection, ssl: destination.ssl ?? same?.ssl },
                    target,
                    logger,
                );
            }
            if (destination.type === "postgres") {
                const same =
                    config.source?.type === "postgres" &&
                    destinationSharesSource(config)
                        ? config.source
                        : undefined;
                return new PostgresSink(
                    { ...connection, ssl: destination.ssl ?? same?.ssl },
                    target,
                    logger,
                );
            }
            const same =
                config.source?.type === "sqlserver" &&
                destinationSharesSource(config)
                    ? config.source
                    : undefined;
            return new SqlServerSink(
                {
                    ...connection,
                    encrypt: destination.encrypt ?? same?.encrypt,
                    trustServerCertificate:
                        destination.trustServerCertificate ??
                        same?.trustServerCertificate,
                },
                target,
                logger,
            );
        }
        case "sqlite":
            return new SqliteSink(destination, logger);
        case "sheets": {
            const credentialsPath = required(
                destination.credentialsPath ?? config.credentialsPath,
                "o caminho das credenciais do Google",
            );
            const spreadsheetId = required(
                destination.spreadsheetId ?? config.spreadsheetId,
                "o id da planilha",
            );
            return new SheetsSink(
                createSheetsClient(credentialsPath),
                spreadsheetId,
                destination.sheet,
                logger,
            );
        }
        case "csv":
            return new CsvSink(destination, logger);
        case "json":
            return new JsonSink(destination, logger);
        case "xml":
            return new XmlSink(destination, logger);
        case "parquet":
            return new ParquetSink(destination, logger);
        case "excel":
            return new ExcelSink(destination, logger);
        case "custom":
            return createCustomSink(
                destination.adapter,
                destination.options ?? {},
                logger,
            );
    }
}
