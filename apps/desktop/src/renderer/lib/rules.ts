import type { RawConfig } from "../../shared/api";

export type Condition =
    | "empty"
    | "email"
    | "digits"
    | "number"
    | "date"
    | "cep"
    | "letters"
    | "short"
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
    empty: "Vazio",
    email: "Com e-mail inválido",
    digits: "Com algo além de dígitos (0 a 9)",
    number: "Com número inválido (aceita vírgula)",
    date: "Com data inválida (dd/mm/aaaa)",
    cep: "Com CEP inválido",
    letters: "Com números ou símbolos (só letras)",
    short: "Curto demais (menos de 3 caracteres)",
    list: "Fora da lista",
    pattern: "Fora do formato próprio",
    normalizer: "Recusado pelo normalizador",
    advanced: "Regra avançada (do arquivo)",
};

export const EDITABLE_CONDITIONS: Condition[] = [
    "empty",
    "email",
    "digits",
    "number",
    "date",
    "cep",
    "letters",
    "short",
    "list",
];

const PATTERNS: Partial<Record<Condition, string>> = {
    email: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
    digits: "^\\d+$",
    number: "^-?(\\d+|\\d{1,3}(\\.\\d{3})+)([.,]\\d+)?$",
    date: "^\\d{2}/\\d{2}/\\d{4}$",
    cep: "^\\d{5}-?\\d{3}$",
    letters: "^[A-Za-zÀ-ÿ' -]+$",
    short: "^.{3,}$",
};

const MESSAGES: Record<Condition, (column: string) => string> = {
    empty: (column) => `Campo "${column}" vazio`,
    email: (column) => `E-mail inválido em "${column}"`,
    digits: (column) => `Só dígitos são aceitos em "${column}"`,
    number: (column) => `Número inválido em "${column}"`,
    date: (column) => `Data inválida em "${column}"`,
    cep: (column) => `CEP inválido em "${column}"`,
    letters: (column) => `Só letras são aceitas em "${column}"`,
    short: (column) => `Valor curto demais em "${column}"`,
    list: (column) => `Valor fora da lista em "${column}"`,
    pattern: (column) => `Formato inválido em "${column}"`,
    normalizer: (column) => `Valor inválido em "${column}"`,
    advanced: (column) => `Valor inválido em "${column}"`,
};

export function defaultMessage(condition: Condition, column: string): string {
    return MESSAGES[condition](column);
}

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
