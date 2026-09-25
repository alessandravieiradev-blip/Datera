import { z } from "zod";

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

export const mergeColumnSchema = z
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
