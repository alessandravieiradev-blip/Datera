import { z } from "zod";
import fs from "fs";
import { getOptionalEnv } from "./env";

export const etlConfigSchema = z.object({
    tableName: z.string(),
    spreadsheetId: z.string(),
    credentialsPath: z.string(),
    mode: z.enum(["raw", "dedupe"]),
    dbHost: z.string(),
    dbPort: z.number(),
    dbUser: z.string(),
    dbPassword: z.string(),
    dbName: z.string(),
    dedupeColumn: z.string().optional(),
    dedupeStrategy: z.enum(["keep-first", "keep-last"]).optional()
});

export type EtlConfig = z.infer<typeof etlConfigSchema>;

export function loadJsonConfig(filePath: string): EtlConfig {
    const content = fs.readFileSync(filePath, "utf-8");
    const parsedData = JSON.parse(content);
    return etlConfigSchema.parse(parsedData);
}

export function loadConfig(jsonPath: string): EtlConfig {
    const jsonConfig = loadJsonConfig(jsonPath);

    const finalConfig = {
        tableName: getOptionalEnv("DB_TABLE") ?? jsonConfig.tableName,
        spreadsheetId: getOptionalEnv("GOOGLE_SPREADSHEET_ID") ?? jsonConfig.spreadsheetId,
        credentialsPath: getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH") ?? jsonConfig.credentialsPath,
        mode: jsonConfig.mode,
        dbHost: getOptionalEnv("DB_HOST") ?? jsonConfig.dbHost,
        dbPort: Number(getOptionalEnv("DB_PORT") ?? jsonConfig.dbPort),
        dbUser: getOptionalEnv("DB_USER") ?? jsonConfig.dbUser,
        dbPassword: getOptionalEnv("DB_PASSWORD") ?? jsonConfig.dbPassword,
        dbName: getOptionalEnv("DB_NAME") ?? jsonConfig.dbName,
        dedupeColumn: jsonConfig.dedupeColumn,
        dedupeStrategy: jsonConfig.dedupeStrategy
    };
    return etlConfigSchema.parse(finalConfig);
}