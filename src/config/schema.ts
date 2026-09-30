import { z } from "zod";
import { destinationSchema, sourceSchema } from "./ioSchema";
import { mergeColumnSchema } from "./mergeSchema";
import {
    alignColumnsSchema,
    combineColumnsSchema,
    fillEmptySchema,
} from "./prepareSchema";
import { validationSchema } from "./validationSchema";

const columnName = z.string().trim().min(1);
const columnList = z.union([columnName, z.array(columnName).min(1)]);

export const summarySchema = z.object({
    by: columnList,
    name: columnName.optional(),
});

export const compareSchema = z.object({
    with: sourceSchema,
    key: columnList,
    ignore: z.array(columnName).optional(),
    keepUnchanged: z.boolean().optional(),
});

export const etlConfigSchema = z
    .object({
        source: sourceSchema.optional(),
        sources: z.array(sourceSchema).min(1).optional(),
        originColumn: z
            .union([z.string().trim().min(1), z.literal(false)])
            .optional(),
        splitBy: z.string().trim().min(1).optional(),
        sheetBy: z.string().trim().min(1).optional(),
        blocksBy: z.string().trim().min(1).optional(),
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
        dedupeKeyNormalizer: z.string().optional(),
        mergeKeyColumn: z.string().optional(),
        mergeColumns: z.array(mergeColumnSchema).optional(),
        mergeEmptyKeyLabel: z.string().optional(),
        mergeRejectedKeyLabel: z.string().optional(),
        mergeKeyNormalizer: z.string().optional(),
        normalizerModules: z.array(z.string()).optional(),
        adapterModules: z.array(z.string()).optional(),
        alignColumns: alignColumnsSchema.optional(),
        fillEmpty: z.array(fillEmptySchema).optional(),
        combineColumns: z.array(combineColumnsSchema).optional(),
        validation: validationSchema.optional(),
        summary: z
            .union([summarySchema, z.array(summarySchema).min(1)])
            .optional(),
        compare: compareSchema.optional(),
    })
    .refine(
        (config) =>
            config.source !== undefined ||
            config.sources !== undefined ||
            config.tableName !== undefined,
        {
            message:
                'Faltou dizer de onde ler: coloque "source", "sources" ou os campos antigos do MySQL.',
            path: ["source"],
        },
    )
    .refine(
        (config) =>
            !(config.source !== undefined && config.sources !== undefined),
        {
            message:
                'Use "source" pra ler de um lugar só ou "sources" pra juntar vários, mas não os dois.',
            path: ["sources"],
        },
    )
    .refine(
        (config) =>
            [config.splitBy, config.sheetBy, config.blocksBy].filter(
                (value) => value !== undefined,
            ).length <= 1,
        {
            message:
                'Escolha um jeito de organizar o resultado: "splitBy", "sheetBy" ou "blocksBy".',
            path: ["splitBy"],
        },
    )
    .refine(
        (config) =>
            !(
                (config.source?.type === "excel" ||
                    config.source?.type === "sheets") &&
                config.source.allSheets === true &&
                config.source.sheet !== undefined
            ),
        {
            message:
                'Use "sheet" pra ler uma aba só ou "allSheets": true pra ler todas, mas não os dois juntos.',
            path: ["source", "allSheets"],
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
export type SummaryConfig = z.infer<typeof summarySchema>;
export type CompareConfig = z.infer<typeof compareSchema>;
