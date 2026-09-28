import { z } from "zod";

const xmlName = z
    .string()
    .regex(
        /^[\p{L}_][\p{L}\p{N}_.-]*$/u,
        "Nome de elemento XML inválido: use letras, números, _ . ou -, começando com letra.",
    );

const serverFields = {
    host: z.string().optional(),
    port: z.number().optional(),
    user: z.string().optional(),
    password: z.string().optional(),
    database: z.string().optional(),
    table: z.string().optional(),
};

export const sourceSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("mysql"),
        ...serverFields,
    }),
    z.object({
        type: z.literal("postgres"),
        ...serverFields,
        ssl: z.boolean().optional(),
    }),
    z.object({
        type: z.literal("sqlserver"),
        ...serverFields,
        encrypt: z.boolean().optional(),
        trustServerCertificate: z.boolean().optional(),
    }),
    z.object({
        type: z.literal("sqlite"),
        path: z.string(),
        table: z.string().min(1),
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
    z.object({
        type: z.literal("xml"),
        path: z.string(),
        recordsPath: z.string().min(1).optional(),
    }),
    z.object({
        type: z.literal("excel"),
        path: z.string(),
        sheet: z.string().min(1).optional(),
    }),
    z.object({
        type: z.literal("sheets"),
        spreadsheetId: z.string().min(1),
        credentialsPath: z.string().optional(),
        sheet: z.string().min(1).optional(),
    }),
    z.object({
        type: z.literal("custom"),
        adapter: z.string().min(1),
        options: z.record(z.string(), z.unknown()).optional(),
    }),
]);

export const destinationSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("sheets"),
        spreadsheetId: z.string().optional(),
        credentialsPath: z.string().optional(),
        sheet: z.string().min(1).optional(),
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
    z.object({
        type: z.literal("xml"),
        path: z.string(),
        root: xmlName.optional(),
        record: xmlName.optional(),
    }),
    z.object({
        type: z.literal("excel"),
        path: z.string(),
        sheet: z.string().min(1).optional(),
    }),
    z.object({
        type: z.literal("custom"),
        adapter: z.string().min(1),
        options: z.record(z.string(), z.unknown()).optional(),
    }),
]);

export type SourceConfig = z.infer<typeof sourceSchema>;
export type DestinationConfig = z.infer<typeof destinationSchema>;
