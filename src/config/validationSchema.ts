import { z } from "zod";

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

export const validationSchema = z.object({
    rules: z.array(validationRuleSchema).min(1),
    pendingSheet: z.string().min(1).optional(),
    reasonColumn: z.string().min(1).optional(),
});
