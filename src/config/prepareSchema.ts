import { z } from "zod";

export const fillEmptySchema = z.object({
    column: z.string(),
    fallbackColumns: z.array(z.string()).optional(),
    default: z.string().optional(),
});

export const alignColumnsSchema = z.union([
    z.boolean(),
    z.object({
        auto: z.boolean().optional(),
        rename: z.record(z.string(), z.string().trim().min(1)).optional(),
    }),
]);

export const combineColumnsSchema = z.object({
    into: z.string(),
    columns: z.array(z.string()).min(1),
    separator: z.string().optional(),
    keepSources: z.boolean().optional(),
});
