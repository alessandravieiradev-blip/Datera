interface BaseRule {
    column: string;
    message?: string | undefined;
}

export interface RequiredRule extends BaseRule {
    rule: "required";
}

export interface PatternRule extends BaseRule {
    rule: "pattern";
    pattern: string;
    flags?: string | undefined;
}

export interface OneOfRule extends BaseRule {
    rule: "oneOf";
    values: string[];
    ignoreCase?: boolean | undefined;
}

export interface NormalizerRule extends BaseRule {
    rule: "normalizer";
    normalizer: string;
}

export type ValidationRule =
    RequiredRule | PatternRule | OneOfRule | NormalizerRule;
