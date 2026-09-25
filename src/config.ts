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
    sources: z.array(z.string()).optional(),
});

const fillEmptySchema = z.object({
    column: z.string(),
    fallbackColumns: z.array(z.string()).optional(),
    default: z.string().optional(),
});

const combineColumnsSchema = z.object({
    into: z.string(),
    columns: z.array(z.string()).min(1),
    separator: z.string().optional(),
    keepSources: z.boolean().optional(),
});

const ruleMessage = { message: z.string().optional() };

const validationRuleSchema = z.discriminatedUnion("rule", [
    z.object({
        column: z.string(),
        rule: z.literal("required"),
        ...ruleMessage,
    }),
    z
        .object({
            column: z.string(),
            rule: z.literal("pattern"),
            pattern: z.string(),
            flags: z.string().optional(),
            ...ruleMessage,
        })
        .refine(
            (value) => {
                try {
                    new RegExp(value.pattern, value.flags);
                    return true;
                } catch {
                    return false;
                }
            },
            {
                message: "pattern não é uma expressão regular válida.",
                path: ["pattern"],
            },
        ),
    z.object({
        column: z.string(),
        rule: z.literal("oneOf"),
        values: z.array(z.string()).min(1),
        ignoreCase: z.boolean().optional(),
        ...ruleMessage,
    }),
    z.object({
        column: z.string(),
        rule: z.literal("normalizer"),
        normalizer: z.string(),
        ...ruleMessage,
    }),
]);

const validationSchema = z.object({
    rules: z.array(validationRuleSchema).min(1),
    pendingSheet: z.string().min(1).optional(),
    reasonColumn: z.string().min(1).optional(),
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
    )
    .refine(
        (value) => value.into === undefined || value.distribute === undefined,
        {
            message:
                "into e distribute não podem ser usados juntos, o distribute já define as colunas de destino.",
            path: ["into"],
        },
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

const sourceSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("mysql"),
        host: z.string().optional(),
        port: z.number().optional(),
        user: z.string().optional(),
        password: z.string().optional(),
        database: z.string().optional(),
        table: z.string().optional(),
    }),
    z.object({
        type: z.literal("csv"),
        path: z.string(),
        delimiter: z.string().min(1).optional(),
        encoding: z.enum(["utf-8", "latin1"]).optional(),
    }),
    z.object({
        type: z.literal("json"),
        path: z.string(),
        recordsPath: z.string().optional(),
    }),
]);

const destinationSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("sheets"),
        spreadsheetId: z.string().optional(),
        credentialsPath: z.string().optional(),
    }),
    z.object({
        type: z.literal("csv"),
        path: z.string(),
        delimiter: z.string().min(1).optional(),
        bom: z.boolean().optional(),
    }),
    z.object({
        type: z.literal("json"),
        path: z.string(),
    }),
]);

export type SourceConfig = z.infer<typeof sourceSchema>;
export type DestinationConfig = z.infer<typeof destinationSchema>;

export const etlConfigSchema = z
    .object({
        source: sourceSchema.optional(),
        destination: destinationSchema.optional(),
        // campos antigos, continuam valendo como source mysql e destination sheets
        tableName: z.string().optional(),
        spreadsheetId: z.string().optional(),
        credentialsPath: z.string().optional(),
        mode: z.enum(["raw", "dedupe", "merge"]),
        dbHost: z.string().optional(),
        dbPort: z.number().optional(),
        dbUser: z.string().optional(),
        dbPassword: z.string().optional(),
        dbName: z.string().optional(),
        dedupeColumn: z.string().optional(),
        dedupeStrategy: z.enum(["keep-first", "keep-last"]).optional(),
        mergeKeyColumn: z.string().optional(),
        mergeColumns: z.array(mergeColumnSchema).optional(),
        mergeEmptyKeyLabel: z.string().optional(),
        mergeRejectedKeyLabel: z.string().optional(),
        mergeKeyNormalizer: z.string().optional(),
        normalizerModules: z.array(z.string()).optional(),
        fillEmpty: z.array(fillEmptySchema).optional(),
        combineColumns: z.array(combineColumnsSchema).optional(),
        validation: validationSchema.optional(),
    })
    .refine(
        (config) =>
            config.source !== undefined || config.tableName !== undefined,
        {
            message:
                'Faltou dizer de onde ler: coloque "source" ou os campos antigos do MySQL.',
            path: ["source"],
        },
    )
    .refine(
        (config) =>
            config.destination !== undefined ||
            config.spreadsheetId !== undefined,
        {
            message:
                'Faltou dizer onde escrever: coloque "destination" ou o "spreadsheetId".',
            path: ["destination"],
        },
    );

export type EtlConfig = z.infer<typeof etlConfigSchema>;

export function loadJsonConfig(filePath: string): EtlConfig {
    const content = fs.readFileSync(filePath, "utf-8");
    const parsedData = JSON.parse(content);
    return etlConfigSchema.parse(parsedData);
}

// variavel de ambiente vence o json, igual antes
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
