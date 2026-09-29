import { describe, it, expect } from "vitest";
import {
    clean,
    combineColumns,
    dedupe,
    defineRules,
    fillEmpty,
    merge,
    mergeColumnsFor,
    validate,
} from "../../api";
import { StepReport } from "../../pipeline";

const ALUNOS = [
    {
        matricula: "2024-0042",
        nome: "Lia Martins",
        email: "lia@email.com",
        plano: "mensal",
        cidade: "Pelotas",
    },
    {
        matricula: "20240042",
        nome: "Lia M.",
        email: " LIA@email.com",
        plano: "Mensal",
        cidade: null,
    },
    {
        matricula: "2024-0060",
        nome: "Nina Rocha",
        email: "nina.email.com",
        plano: "trimestral",
        cidade: "Pelotas",
    },
    {
        matricula: null,
        nome: "Caio Lima",
        email: "caio@email.com",
        plano: "semanal",
        cidade: "Canguçu",
    },
];

describe("clean", () => {
    it("sem regras devolve as mesmas linhas", () => {
        const result = clean(ALUNOS);

        expect(result.rows).toEqual(ALUNOS);
        expect(result.pending).toEqual([]);
    });

    it("aplica preparação, validação e merge, e conta os motivos", () => {
        const steps: string[] = [];
        const result = clean(
            ALUNOS,
            defineRules({
                fillEmpty: [{ column: "cidade", default: "não informada" }],
                validation: {
                    rules: [
                        {
                            column: "matricula",
                            rule: "required",
                            message: "sem matrícula",
                        },
                        {
                            column: "email",
                            rule: "pattern",
                            pattern: "^\\s*[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
                            message: "e-mail fora do formato",
                        },
                    ],
                },
                merge: {
                    key: "matricula",
                    normalizer: "digitsOnly",
                    columns: [
                        { column: "nome", strategy: "extra-column" },
                        { column: "plano", strategy: "overwrite" },
                        {
                            column: "cidade",
                            strategy: "concat",
                            separator: " | ",
                        },
                    ],
                },
            }),
            { onStep: (report: StepReport) => steps.push(report.name) },
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toMatchObject({
            matricula: "2024-0042",
            nome: "Lia Martins",
            nome_2: "Lia M.",
            plano: "Mensal",
            cidade: "Pelotas | não informada",
        });
        expect(result.pending).toHaveLength(2);
        expect(result.pendingByReason).toEqual([
            { reason: "e-mail fora do formato", count: 1 },
            { reason: "sem matrícula", count: 1 },
        ]);
        expect(steps).toEqual(["fillEmpty", "validation", "merge"]);
    });

    it("explica em português quando a regra está errada", () => {
        expect(() =>
            clean(ALUNOS, {
                dedupe: { column: "email" },
                merge: {
                    key: "x",
                    columns: [{ column: "a", strategy: "concat" }],
                },
            }),
        ).toThrow("Escolha dedupe ou merge");
        expect(() => clean(ALUNOS, { validation: { rules: [] } })).toThrow(
            "As regras com problema",
        );
    });
});

describe("funções de uma etapa só", () => {
    it("fillEmpty e combineColumns", () => {
        const filled = fillEmpty(ALUNOS, [
            { column: "cidade", default: "não informada" },
        ]);
        expect(filled[1]?.cidade).toBe("não informada");

        const combined = combineColumns(ALUNOS.slice(0, 1), [
            { into: "contato", columns: ["nome", "email"], separator: " - " },
        ]);
        expect(combined[0]?.contato).toBe("Lia Martins - lia@email.com");
    });

    it("validate separa as válidas das pendências", () => {
        const { valid, pending } = validate(ALUNOS, [
            { column: "matricula", rule: "required" },
        ]);

        expect(valid).toHaveLength(3);
        expect(pending).toHaveLength(1);
        expect(pending[0]?.nome).toBe("Caio Lima");
    });

    it("dedupe com normalizador junta e-mails com maiúscula e espaço", () => {
        const rows = dedupe(ALUNOS, "email", { normalizer: "lowercase" });

        expect(rows.map((row) => row.nome)).toEqual([
            "Lia Martins",
            "Nina Rocha",
            "Caio Lima",
        ]);
    });

    it("dedupe pode ficar com a última", () => {
        const rows = dedupe(ALUNOS, "email", {
            normalizer: "lowercase",
            keep: "last",
        });

        expect(rows[0]?.nome).toBe("Lia M.");
    });

    it("merge sem colunas junta todas com concat", () => {
        const rows = merge(ALUNOS.slice(0, 2), "matricula", {
            normalizer: "digitsOnly",
            overwrite: ["plano"],
        });

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            nome: "Lia Martins | Lia M.",
            plano: "Mensal",
        });
    });

    it("mergeColumnsFor monta as colunas a partir das linhas", () => {
        expect(
            mergeColumnsFor(ALUNOS, "matricula", {
                extraColumn: ["nome"],
                overwrite: ["plano"],
            }),
        ).toEqual([
            { column: "nome", strategy: "extra-column" },
            { column: "email", strategy: "concat", separator: " | " },
            { column: "plano", strategy: "overwrite" },
            { column: "cidade", strategy: "concat", separator: " | " },
        ]);
    });
});

describe("clean não carrega código", () => {
    it("ignora normalizerModules nas regras, sem carregar arquivo nenhum", () => {
        const result = clean(ALUNOS, {
            normalizerModules: ["./qualquer.cjs"],
        } as never);

        expect(result.rows).toEqual(ALUNOS);
    });
});
