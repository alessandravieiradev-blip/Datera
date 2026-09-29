import fs from "fs";
import { getOptionalEnv } from "../env";
import { DestinationConfig, SourceConfig } from "./ioSchema";
import { EtlConfig, etlConfigSchema } from "./schema";

export function loadJsonConfig(filePath: string): EtlConfig {
    const content = fs.readFileSync(filePath, "utf-8");
    const parsedData = JSON.parse(content);
    return etlConfigSchema.parse(parsedData);
}

function envPassword(prefix: "DB" | "DEST_DB"): string | undefined {
    const password = getOptionalEnv(`${prefix}_PASSWORD`);
    if (password === undefined) return undefined;
    if (getOptionalEnv(`${prefix}_HOST`) === undefined) {
        throw new Error(
            `Por segurança, a senha do .env (${prefix}_PASSWORD) só é usada quando o .env também diz qual é o servidor (${prefix}_HOST). Assim uma config não consegue mandar a sua senha pra outro endereço. Coloque ${prefix}_HOST=<endereço do servidor> no .env, do lado da senha.`,
        );
    }
    return password;
}

function withDatabaseEnv(
    source: SourceConfig | undefined,
): SourceConfig | undefined {
    if (!isServer(source)) return source;
    const port = getOptionalEnv("DB_PORT");
    return {
        ...source,
        host: getOptionalEnv("DB_HOST") ?? source.host,
        port: port !== undefined ? Number(port) : source.port,
        user: getOptionalEnv("DB_USER") ?? source.user,
        password: envPassword("DB") ?? source.password,
        database: getOptionalEnv("DB_NAME") ?? source.database,
        table: getOptionalEnv("DB_TABLE") ?? source.table,
    };
}

function isServer(
    side: SourceConfig | DestinationConfig | undefined,
): side is Extract<
    SourceConfig | DestinationConfig,
    { type: "mysql" | "postgres" | "sqlserver" }
> {
    return (
        side?.type === "mysql" ||
        side?.type === "postgres" ||
        side?.type === "sqlserver"
    );
}

function withDestinationDatabaseEnv(
    destination: DestinationConfig | undefined,
): DestinationConfig | undefined {
    if (!isServer(destination)) return destination;
    const port = getOptionalEnv("DEST_DB_PORT");
    return {
        ...destination,
        host: getOptionalEnv("DEST_DB_HOST") ?? destination.host,
        port: port !== undefined ? Number(port) : destination.port,
        user: getOptionalEnv("DEST_DB_USER") ?? destination.user,
        password: envPassword("DEST_DB") ?? destination.password,
        database: getOptionalEnv("DEST_DB_NAME") ?? destination.database,
        table: getOptionalEnv("DEST_DB_TABLE") ?? destination.table,
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

export function withEnv(jsonConfig: EtlConfig): EtlConfig {
    const dbPort = getOptionalEnv("DB_PORT");

    const finalConfig = {
        ...jsonConfig,
        source: withDatabaseEnv(jsonConfig.source),
        destination: withDestinationDatabaseEnv(
            withSheetsEnv(jsonConfig.destination),
        ),
        tableName: getOptionalEnv("DB_TABLE") ?? jsonConfig.tableName,
        spreadsheetId:
            getOptionalEnv("GOOGLE_SPREADSHEET_ID") ?? jsonConfig.spreadsheetId,
        credentialsPath:
            getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH") ??
            jsonConfig.credentialsPath,
        dbHost: getOptionalEnv("DB_HOST") ?? jsonConfig.dbHost,
        dbPort: dbPort !== undefined ? Number(dbPort) : jsonConfig.dbPort,
        dbUser: getOptionalEnv("DB_USER") ?? jsonConfig.dbUser,
        dbPassword:
            jsonConfig.source === undefined
                ? (envPassword("DB") ?? jsonConfig.dbPassword)
                : jsonConfig.dbPassword,
        dbName: getOptionalEnv("DB_NAME") ?? jsonConfig.dbName,
    };
    return etlConfigSchema.parse(finalConfig);
}

export function loadConfig(jsonPath: string): EtlConfig {
    return withEnv(loadJsonConfig(jsonPath));
}

export function parseConfig(value: unknown): EtlConfig {
    return withEnv(etlConfigSchema.parse(value));
}
