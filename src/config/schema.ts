import { z } from "zod";
import { destinationSchema, sourceSchema } from "./ioSchema";
import { mergeColumnSchema } from "./mergeSchema";
import { combineColumnsSchema, fillEmptySchema } from "./prepareSchema";
import { validationSchema } from "./validationSchema";

export const etlConfigSchema = z
    .object({
        source: sourceSchema.optional(),
        destination: destinationSchema.optional(),
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
