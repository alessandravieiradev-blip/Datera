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
import { XmlSink } from "./xml/xmlSink";
import { ParquetSource } from "./parquet/parquetSource";
import { ParquetSink } from "./parquet/parquetSink";
import { ExcelSource } from "./excel/excelSource";
import { ExcelSink } from "./excel/excelSink";
import { SheetsSource } from "./sheets/sheetsSource";
import { createCustomSink, createCustomSource } from "./custom/registry";
import { consoleLogger, Logger } from "../logger";
import { assertSourceIsSafe } from "./safety";

const DEFAULT_MYSQL_PORT = 3306;
const DEFAULT_POSTGRES_PORT = 5432;
const DEFAULT_SQLSERVER_PORT = 1433;

function required<T>(value: T | undefined, what: string): T {
    if (value === undefined || value === "") {
        throw new Error(`Faltou configurar ${what}.`);
    }
    return value;
}

export function createSource(
    config: EtlConfig,
    logger: Logger = consoleLogger,
): Source {
    const source = config.source ?? { type: "mysql" as const };

    switch (source.type) {
        case "mysql":
            return new MysqlSource(
                {
                    host: required(
                        source.host ?? config.dbHost,
                        "o host do MySQL",
                    ),
                    port: source.port ?? config.dbPort ?? DEFAULT_MYSQL_PORT,
                    user: required(
                        source.user ?? config.dbUser,
                        "o usuário do MySQL",
                    ),
                    password: source.password ?? config.dbPassword,
                    database: required(
                        source.database ?? config.dbName,
                        "o banco do MySQL",
                    ),
                },
                required(source.table ?? config.tableName, "a tabela do MySQL"),
                logger,
            );
        case "postgres":
            return new PostgresSource(
                {
                    host: required(source.host, "o host do PostgreSQL"),
                    port: source.port ?? DEFAULT_POSTGRES_PORT,
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
                    port: source.port ?? DEFAULT_SQLSERVER_PORT,
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
    const destination = config.destination ?? { type: "sheets" as const };

    switch (destination.type) {
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
