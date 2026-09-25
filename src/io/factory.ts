import { EtlConfig } from "../config";
import { createSheetsClient } from "./sheets/client";
import { Sink, Source } from "./types";
import { MysqlSource } from "./mysql/mysqlSource";
import { CsvSource } from "./csv/csvSource";
import { JsonSource } from "./json/jsonSource";
import { SheetsSink } from "./sheets/sheetsSink";
import { CsvSink } from "./csv/csvSink";
import { JsonSink } from "./json/jsonSink";
import { ExcelSource } from "./excel/excelSource";
import { ExcelSink } from "./excel/excelSink";
import { SheetsSource } from "./sheets/sheetsSource";

const DEFAULT_MYSQL_PORT = 3306;

function required<T>(value: T | undefined, what: string): T {
    if (value === undefined || value === "") {
        throw new Error(`Faltou configurar ${what}.`);
    }
    return value;
}

export function createSource(config: EtlConfig): Source {
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
            );
        case "csv":
            return new CsvSource(source);
        case "json":
            return new JsonSource(source);
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
    }
}

export function createSink(config: EtlConfig): Sink {
    assertNotSameSheet(config);
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
            );
        }
        case "csv":
            return new CsvSink(destination);
        case "json":
            return new JsonSink(destination);
        case "excel":
            return new ExcelSink(destination);
    }
}

function assertNotSameSheet(config: EtlConfig): void {
    const source = config.source;
    const destination = config.destination ?? { type: "sheets" as const };
    if (source?.type !== "sheets" || destination.type !== "sheets") return;

    const destinationId = destination.spreadsheetId ?? config.spreadsheetId;
    if (source.spreadsheetId === destinationId && source.sheet === undefined) {
        throw new Error(
            'A fonte e o destino são a mesma aba da mesma planilha, e ela seria apagada antes de escrever. Coloque "sheet" na fonte com o nome da aba de onde ler.',
        );
    }
}
