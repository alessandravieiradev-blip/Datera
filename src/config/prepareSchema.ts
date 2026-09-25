import { z } from "zod";

export const fillEmptySchema = z.object({
    column: z.string(),
    fallbackColumns: z.array(z.string()).optional(),
    default: z.string().optional(),
});

export const combineColumnsSchema = z.object({
    into: z.string(),
    columns: z.array(z.string()).min(1),
    separator: z.string().optional(),
    keepSources: z.boolean().optional(),
});
