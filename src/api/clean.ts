import { z } from "zod";
import { EtlConfig, etlConfigSchema } from "../config";
import { mergeColumnSchema } from "../config/mergeSchema";
import { combineColumnsSchema, fillEmptySchema } from "../config/prepareSchema";
import { validationSchema } from "../config/validationSchema";
import { registerBuiltinKeyNormalizers } from "../normalizers";
import {
    applySteps,
    buildSteps,
    countPendingReasons,
    Mode,
    PendingReason,
    StepReport,
} from "../pipeline";
import { TableRow } from "../types";
import { parseWith } from "./parse";

export const rulesSchema = z
    .object({
        fillEmpty: z.array(fillEmptySchema).optional(),
        combineColumns: z.array(combineColumnsSchema).optional(),
        validation: validationSchema.optional(),
        dedupe: z
            .object({
                column: z.string().min(1),
                keep: z.enum(["first", "last"]).optional(),
                normalizer: z.string().optional(),
            })
            .optional(),
        merge: z
            .object({
                key: z.string().min(1),
                columns: z.array(mergeColumnSchema).min(1),
                normalizer: z.string().optional(),
                emptyKeyLabel: z.string().optional(),
                rejectedKeyLabel: z.string().optional(),
            })
            .optional(),
    })
    .refine((rules) => !(rules.dedupe && rules.merge), {
        message: "Escolha dedupe ou merge, os dois juntos não dá.",
        path: ["merge"],
    });

export type Rules = z.input<typeof rulesSchema>;
export type ConfigInput = z.input<typeof etlConfigSchema>;

export interface CleanOptions {
    onStep?: ((report: StepReport) => void) | undefined;
}

export interface CleanResult {
    rows: TableRow[];
    pending: TableRow[];
    pendingByReason: PendingReason[];
    steps: StepReport[];
    durationMs: number;
}

export function defineConfig(config: ConfigInput): ConfigInput {
    return config;
}

export function defineRules(rules: Rules): Rules {
    return rules;
}

function configOf(rules: z.infer<typeof rulesSchema>): {
    config: EtlConfig;
    mode: Mode;
} {
    const mode: Mode = rules.merge ? "merge" : rules.dedupe ? "dedupe" : "raw";
    const config: EtlConfig = {
        mode,
        fillEmpty: rules.fillEmpty,
        combineColumns: rules.combineColumns,
        validation: rules.validation,
        dedupeColumn: rules.dedupe?.column,
        dedupeStrategy:
            rules.dedupe?.keep === "last" ? "keep-last" : "keep-first",
        dedupeKeyNormalizer: rules.dedupe?.normalizer,
        mergeKeyColumn: rules.merge?.key,
        mergeColumns: rules.merge?.columns,
        mergeKeyNormalizer: rules.merge?.normalizer,
        mergeEmptyKeyLabel: rules.merge?.emptyKeyLabel,
        mergeRejectedKeyLabel: rules.merge?.rejectedKeyLabel,
    };
    return { config, mode };
}

export function clean(
    rows: TableRow[],
    rules: Rules = {},
    options: CleanOptions = {},
): CleanResult {
    const startedAt = Date.now();
    const parsed = parseWith(rulesSchema, rules, "As regras");
    registerBuiltinKeyNormalizers();
    const { config, mode } = configOf(parsed);
    const result = applySteps(buildSteps(config, mode), rows, options.onStep);
    return {
        rows: result.rows,
        pending: result.pending,
        pendingByReason: countPendingReasons(
            result.pending,
            parsed.validation?.reasonColumn,
        ),
        steps: result.steps,
        durationMs: Date.now() - startedAt,
    };
}

type FillEmptyRule = z.input<typeof fillEmptySchema>;
type CombineRule = z.input<typeof combineColumnsSchema>;
type Validation = z.input<typeof validationSchema>;
type ValidationRule = Validation["rules"][number];
type MergeColumn = z.input<typeof mergeColumnSchema>;

export function fillEmpty(
    rows: TableRow[],
    rules: FillEmptyRule[],
): TableRow[] {
    return clean(rows, { fillEmpty: rules }).rows;
}

export function combineColumns(
    rows: TableRow[],
    rules: CombineRule[],
): TableRow[] {
    return clean(rows, { combineColumns: rules }).rows;
}

export function validate(
    rows: TableRow[],
    rules: ValidationRule[] | Validation,
): { valid: TableRow[]; pending: TableRow[] } {
    const validation = Array.isArray(rules) ? { rules } : rules;
    const result = clean(rows, { validation });
    return { valid: result.rows, pending: result.pending };
}

export interface DedupeOptions {
    keep?: "first" | "last" | undefined;
    normalizer?: string | undefined;
}

export function dedupe(
    rows: TableRow[],
    column: string,
    options: DedupeOptions = {},
): TableRow[] {
    return clean(rows, {
        dedupe: {
            column,
            ...(options.keep ? { keep: options.keep } : {}),
            ...(options.normalizer ? { normalizer: options.normalizer } : {}),
        },
    }).rows;
}

export interface MergeOptions {
    columns?: MergeColumn[] | undefined;
    normalizer?: string | undefined;
    separator?: string | undefined;
    overwrite?: string[] | undefined;
    extraColumn?: string[] | undefined;
    emptyKeyLabel?: string | undefined;
    rejectedKeyLabel?: string | undefined;
}

export function mergeColumnsFor(
    rows: TableRow[],
    key: string,
    options: MergeOptions = {},
): MergeColumn[] {
    const names = new Set<string>();
    for (const row of rows) {
        for (const name of Object.keys(row)) names.add(name);
    }
    names.delete(key);
    return [...names].map((column) =>
        options.overwrite?.includes(column)
            ? { column, strategy: "overwrite" }
            : options.extraColumn?.includes(column)
              ? { column, strategy: "extra-column" }
              : {
                    column,
                    strategy: "concat",
                    separator: options.separator ?? " | ",
                },
    );
}

export function merge(
    rows: TableRow[],
    key: string,
    options: MergeOptions = {},
): TableRow[] {
    const columns = options.columns ?? mergeColumnsFor(rows, key, options);
    if (columns.length === 0) return rows;
    return clean(rows, {
        merge: {
            key,
            columns,
            ...(options.normalizer ? { normalizer: options.normalizer } : {}),
            ...(options.emptyKeyLabel
                ? { emptyKeyLabel: options.emptyKeyLabel }
                : {}),
            ...(options.rejectedKeyLabel
                ? { rejectedKeyLabel: options.rejectedKeyLabel }
                : {}),
        },
    }).rows;
}
