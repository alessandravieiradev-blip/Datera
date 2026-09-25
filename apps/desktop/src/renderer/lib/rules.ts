import type { RawConfig } from "../../shared/api";

export type Condition =
    | "empty"
    | "email"
    | "digits"
    | "date"
    | "list"
    | "pattern"
    | "normalizer"
    | "advanced";

export interface RuleDraft {
    id: string;
    column: string;
    condition: Condition;
    values: string;
    pattern?: string | undefined;
    flags?: string | undefined;
    normalizer?: string | undefined;
    message?: string | undefined;
    original?: RawConfig | undefined;
}

export const CONDITION_LABELS: Record<Condition, string> = {
    empty: "vazio",
    email: "com e-mail inválido",
    digits: "com algo que não é número",
    date: "com data fora do dd/mm/aaaa",
    list: "fora da lista",
    pattern: "fora do formato próprio",
    normalizer: "recusado pelo normalizador",
    advanced: "regra avançada (do arquivo)",
};

export const EDITABLE_CONDITIONS: Condition[] = [
    "empty",
    "email",
    "digits",
    "date",
    "list",
];

const PATTERNS: Partial<Record<Condition, string>> = {
    email: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
    digits: "^\\d+$",
    date: "^\\d{2}/\\d{2}/\\d{4}$",
};

const MESSAGES: Record<Condition, (column: string) => string> = {
    empty: (column) => `${column} vazio`,
    email: (column) => `${column} com e-mail inválido`,
    digits: (column) => `${column} com algo que não é número`,
    date: (column) => `${column} com data fora do formato`,
    list: (column) => `${column} fora da lista`,
    pattern: (column) => `${column} fora do formato`,
    normalizer: (column) => `${column} inválido`,
    advanced: (column) => `${column} inválido`,
};

let counter = 0;
export function newId(): string {
    counter += 1;
    return `regra-${Date.now()}-${counter}`;
}

function text(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function conditionOf(rule: RawConfig): Condition {
    if (rule.rule === "required") return "empty";
    if (rule.rule === "oneOf") return "list";
    if (rule.rule === "pattern" && typeof rule.pattern === "string") {
        const match = (Object.keys(PATTERNS) as Condition[]).find(
            (condition) => PATTERNS[condition] === rule.pattern,
        );
        return match && rule.flags === undefined ? match : "pattern";
    }
    if (rule.rule === "normalizer" && typeof rule.normalizer === "string")
        return "normalizer";
    return "advanced";
}

export function rulesFromConfig(config: RawConfig): RuleDraft[] {
    const validation = config.validation as RawConfig | undefined;
    const rules = Array.isArray(validation?.rules)
        ? (validation.rules as RawConfig[])
        : [];
    return rules.map((rule) => ({
        id: newId(),
        column: text(rule.column),
        condition: conditionOf(rule),
        values: Array.isArray(rule.values) ? rule.values.join(", ") : "",
        pattern: typeof rule.pattern === "string" ? rule.pattern : undefined,
        flags: typeof rule.flags === "string" ? rule.flags : undefined,
        normalizer:
            typeof rule.normalizer === "string" ? rule.normalizer : undefined,
        message: typeof rule.message === "string" ? rule.message : undefined,
        original: rule,
    }));
}

function messageFor(draft: RuleDraft): string {
    const original = draft.original;
    const unchanged =
        original !== undefined &&
        text(original.column) === draft.column &&
        conditionOf(original) === draft.condition;
    if (unchanged && draft.message) return draft.message;
    if (
        (draft.condition === "pattern" || draft.condition === "normalizer") &&
        draft.message
    ) {
        return draft.message;
    }
    return MESSAGES[draft.condition](draft.column);
}

export function ruleToConfig(draft: RuleDraft): RawConfig {
    if (draft.condition === "advanced" && draft.original) return draft.original;
    const base = { column: draft.column, message: messageFor(draft) };
    if (draft.condition === "empty") return { ...base, rule: "required" };
    if (draft.condition === "list") {
        const values = draft.values
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value !== "");
        return { ...base, rule: "oneOf", values, ignoreCase: true };
    }
    if (draft.condition === "normalizer") {
        return {
            ...base,
            rule: "normalizer",
            normalizer: draft.normalizer ?? "",
        };
    }
    if (draft.condition === "pattern") {
        return {
            ...base,
            rule: "pattern",
            pattern: draft.pattern ?? "",
            ...(draft.flags ? { flags: draft.flags } : {}),
        };
    }
    return {
        ...base,
        rule: "pattern",
        pattern: PATTERNS[draft.condition] ?? "",
    };
}

export function problemOf(draft: RuleDraft): string | null {
    if (draft.column.trim() === "") return "Escolha a coluna.";
    if (draft.condition === "list" && draft.values.trim() === "") {
        return "Escreva os valores aceitos, separados por vírgula.";
    }
    if (
        draft.condition === "pattern" &&
        patternProblem(draft.pattern ?? "", draft.flags)
    ) {
        return "O formato próprio está com problema. Clique em editar.";
    }
    if (draft.condition === "normalizer" && !draft.normalizer)
        return "Escolha o normalizador.";
    return null;
}

export function patternProblem(pattern: string, flags?: string): string | null {
    if (pattern.trim() === "") return "Escreva o formato.";
    try {
        new RegExp(pattern, (flags ?? "").replace(/[gy]/g, ""));
        return null;
    } catch {
        return "Esse formato tem algum erro de escrita.";
    }
}

export function withRules(config: RawConfig, drafts: RuleDraft[]): RawConfig {
    const next: RawConfig = { ...config };
    const previous = (config.validation as RawConfig | undefined) ?? {};
    if (drafts.length === 0) {
        delete next.validation;
        return next;
    }
    next.validation = { ...previous, rules: drafts.map(ruleToConfig) };
    return next;
}
