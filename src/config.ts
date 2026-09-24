import { z } from "zod";
import fs from "fs";
import { getOptionalEnv } from "./env";

const mergeColumnStrategySchema = z.enum([
    "concat",
    "overwrite",
    "extra-column",
]);

const distributeSchema = z.object({
    columns: z.array(z.string()).min(1),
    overflowInto: z.string().optional(),
});

const distributeOnlyOnConcat = {
    message: 'distribute só é permitido quando strategy é "concat".',
    path: ["distribute"],
};

const groupOverrideSchema = z
    .object({
        strategy: mergeColumnStrategySchema,
        separator: z.string().optional(),
        into: z.string().optional(),
        distribute: distributeSchema.optional(),
    })
    .refine(
        (value) =>
            value.strategy === "concat" || value.distribute === undefined,
        distributeOnlyOnConcat,
    );

const mergeColumnSchema = z
    .object({
        column: z.string(),
        strategy: mergeColumnStrategySchema,
        separator: z.string().optional(),
        distribute: distributeSchema.optional(),
        byGroup: z.record(z.string(), groupOverrideSchema).optional(),
        unkeyed: z
            .object({
                strategy: z.enum(["collapse-column"]),
                into: z.string().optional(),
                separator: z.string().optional(),
            })
            .optional(),
    })
    .refine(
        (value) =>
            value.strategy === "concat" || value.distribute === undefined,
        distributeOnlyOnConcat,
    );

export const etlConfigSchema = z.object({
    tableName: z.string(),
    spreadsheetId: z.string(),
    credentialsPath: z.string(),
    mode: z.enum(["raw", "dedupe", "merge"]),
    dbHost: z.string(),
    dbPort: z.number(),
    dbUser: z.string(),
    dbPassword: z.string(),
    dbName: z.string(),
    dedupeColumn: z.string().optional(),
    dedupeStrategy: z.enum(["keep-first", "keep-last"]).optional(),
    mergeKeyColumn: z.string().optional(),
    mergeColumns: z.array(mergeColumnSchema).optional(),
    mergeEmptyKeyLabel: z.string().optional(),
    mergeRejectedKeyLabel: z.string().optional(),
    mergeKeyNormalizer: z.string().optional(),
    normalizerModules: z.array(z.string()).optional(),
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
        spreadsheetId:
            getOptionalEnv("GOOGLE_SPREADSHEET_ID") ?? jsonConfig.spreadsheetId,
        credentialsPath:
            getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH") ??
            jsonConfig.credentialsPath,
        mode: jsonConfig.mode,
        dbHost: getOptionalEnv("DB_HOST") ?? jsonConfig.dbHost,
        dbPort: Number(getOptionalEnv("DB_PORT") ?? jsonConfig.dbPort),
        dbUser: getOptionalEnv("DB_USER") ?? jsonConfig.dbUser,
        dbPassword: getOptionalEnv("DB_PASSWORD") ?? jsonConfig.dbPassword,
        dbName: getOptionalEnv("DB_NAME") ?? jsonConfig.dbName,
        dedupeColumn: jsonConfig.dedupeColumn,
        dedupeStrategy: jsonConfig.dedupeStrategy,
        mergeKeyColumn: jsonConfig.mergeKeyColumn,
        mergeColumns: jsonConfig.mergeColumns,
        mergeEmptyKeyLabel: jsonConfig.mergeEmptyKeyLabel,
        mergeRejectedKeyLabel: jsonConfig.mergeRejectedKeyLabel,
        mergeKeyNormalizer: jsonConfig.mergeKeyNormalizer,
        normalizerModules: jsonConfig.normalizerModules,
    };
    return etlConfigSchema.parse(finalConfig);
}
