import { TableRow } from "../types";
import { getKeyNormalizer } from "../normalizers/registry";
import { ValidationRule } from "./validateTypes";

export const DEFAULT_PENDING_SHEET = "Pendências";
export const DEFAULT_REASON_COLUMN = "Motivo";

type CellValue = TableRow[string] | undefined;

interface Check {
    column: string;
    message: string;
    skipEmpty: boolean;
    isValid: (value: string) => boolean;
}

export interface ValidationResult {
    valid: TableRow[];
    pending: TableRow[];
}

export class RowValidator {
    private readonly checks: Check[];

    constructor(
        rules: ValidationRule[],
        private readonly reasonColumn: string = DEFAULT_REASON_COLUMN,
    ) {
        this.checks = rules.map((rule) => this.buildCheck(rule));
    }

    split(rows: TableRow[]): ValidationResult {
        const valid: TableRow[] = [];
        const pending: TableRow[] = [];

        for (const row of rows) {
            const reasons = this.checks
                .filter((check) => !this.passes(check, row[check.column]))
                .map((check) => check.message);

            if (reasons.length === 0) {
                valid.push(row);
                continue;
            }

            const withReason: TableRow = { [this.reasonColumn]: null, ...row };
            withReason[this.reasonColumn] = Array.from(new Set(reasons)).join(
                "; ",
            );
            pending.push(withReason);
        }

        return { valid, pending };
    }

    private passes(check: Check, value: CellValue): boolean {
        const text =
            value === null || value === undefined ? "" : String(value).trim();
        if (text === "") return check.skipEmpty;
        return check.isValid(text);
    }

    private buildCheck(rule: ValidationRule): Check {
        const { column } = rule;

        switch (rule.rule) {
            case "required":
                return {
                    column,
                    message: rule.message ?? `${column} vazio`,
                    skipEmpty: false,
                    isValid: () => true,
                };
            case "pattern": {
                const flags = (rule.flags ?? "").replace(/[gy]/g, "");
                const regex = new RegExp(rule.pattern, flags);
                return {
                    column,
                    message: rule.message ?? `${column} fora do formato`,
                    skipEmpty: true,
                    isValid: (text) => regex.test(text),
                };
            }
            case "oneOf": {
                const normalize = (text: string) =>
                    rule.ignoreCase ? text.toLowerCase() : text;
                const allowed = new Set(
                    rule.values.map((v) => normalize(v.trim())),
                );
                return {
                    column,
                    message:
                        rule.message ?? `${column} com valor não permitido`,
                    skipEmpty: true,
                    isValid: (text) => allowed.has(normalize(text)),
                };
            }
            case "normalizer": {
                const normalizer = getKeyNormalizer(rule.normalizer);
                return {
                    column,
                    message: rule.message ?? `${column} inválido`,
                    skipEmpty: true,
                    isValid: (text) => normalizer(text) !== null,
                };
            }
        }
    }
}
