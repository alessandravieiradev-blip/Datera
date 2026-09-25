import fs from "fs";
import { getOptionalEnv } from "../env";
import { DestinationConfig, SourceConfig } from "./ioSchema";
import { EtlConfig, etlConfigSchema } from "./schema";

export function loadJsonConfig(filePath: string): EtlConfig {
    const content = fs.readFileSync(filePath, "utf-8");
    const parsedData = JSON.parse(content);
    return etlConfigSchema.parse(parsedData);
}

function withMysqlEnv(
    source: SourceConfig | undefined,
): SourceConfig | undefined {
    if (source?.type !== "mysql") return source;
    const port = getOptionalEnv("DB_PORT");
    return {
        ...source,
        host: getOptionalEnv("DB_HOST") ?? source.host,
        port: port !== undefined ? Number(port) : source.port,
        user: getOptionalEnv("DB_USER") ?? source.user,
        password: getOptionalEnv("DB_PASSWORD") ?? source.password,
        database: getOptionalEnv("DB_NAME") ?? source.database,
        table: getOptionalEnv("DB_TABLE") ?? source.table,
    };
}

function withSheetsEnv(
    destination: DestinationConfig | undefined,
): DestinationConfig | undefined {
    if (destination?.type !== "sheets") return destination;
    return {
        ...destination,
        spreadsheetId:
            getOptionalEnv("GOOGLE_SPREADSHEET_ID") ??
            destination.spreadsheetId,
        credentialsPath:
            getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH") ??
            destination.credentialsPath,
    };
}

export function loadConfig(jsonPath: string): EtlConfig {
    const jsonConfig = loadJsonConfig(jsonPath);
    const dbPort = getOptionalEnv("DB_PORT");

    const finalConfig = {
        ...jsonConfig,
        source: withMysqlEnv(jsonConfig.source),
        destination: withSheetsEnv(jsonConfig.destination),
        tableName: getOptionalEnv("DB_TABLE") ?? jsonConfig.tableName,
        spreadsheetId:
            getOptionalEnv("GOOGLE_SPREADSHEET_ID") ?? jsonConfig.spreadsheetId,
        credentialsPath:
            getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH") ??
            jsonConfig.credentialsPath,
        dbHost: getOptionalEnv("DB_HOST") ?? jsonConfig.dbHost,
        dbPort: dbPort !== undefined ? Number(dbPort) : jsonConfig.dbPort,
        dbUser: getOptionalEnv("DB_USER") ?? jsonConfig.dbUser,
        dbPassword: getOptionalEnv("DB_PASSWORD") ?? jsonConfig.dbPassword,
        dbName: getOptionalEnv("DB_NAME") ?? jsonConfig.dbName,
    };
    return etlConfigSchema.parse(finalConfig);
}
