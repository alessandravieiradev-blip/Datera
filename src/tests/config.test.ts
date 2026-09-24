import { describe, it, expect } from "vitest";
import { etlConfigSchema } from "../config";

describe("etlConfigSchema", () => {
    it("Aceita uma config válida com todos os campos corretos", () => {
        const validConfig = {
            tableName: "Clientes",
            spreadsheetId: "1fQycp0FJZJPObYZvWDu8l4U5otfBD4kXDyPEsYmxMk8",
            credentialsPath: "./credentials.json",
            mode: "raw",
            dbHost: "localhost",
            dbPort: 3306,
            dbUser: "root",
            dbPassword: "senha123",
            dbName: "loja",
        };

        const result = etlConfigSchema.safeParse(validConfig);

        expect(result.success).toBe(true);
    });

    it("rejeita config com campo obrigatório faltando", () => {
        const configSemTabela = {
            spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUv",
            credentialsPath: "./credentials.json",
            mode: "raw",
            dbHost: "localhost",
            dbPort: 3306,
            dbUser: "root",
            dbPassword: "senha123",
            dbName: "loja",
        };

        const result = etlConfigSchema.safeParse(configSemTabela);

        expect(result.success).toBe(false);
    });

    it("rejeita config com dbPort como texto em vez de número", () => {
        const configComPortaErrada = {
            tableName: "clientes",
            spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUv",
            credentialsPath: "./credentials.json",
            mode: "raw",
            dbHost: "localhost",
            dbPort: "3306",
            dbUser: "root",
            dbPassword: "senha123",
            dbName: "loja",
        };

        const result = etlConfigSchema.safeParse(configComPortaErrada);

        expect(result.success).toBe(false);
    });

    it("rejeita mode com valor fora do enum permitido", () => {
        const configComModoInvalido = {
            tableName: "clientes",
            spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUv",
            credentialsPath: "./credentials.json",
            mode: "modo-que-nao-existe",
            dbHost: "localhost",
            dbPort: 3306,
            dbUser: "root",
            dbPassword: "senha123",
            dbName: "loja",
        };

        const result = etlConfigSchema.safeParse(configComModoInvalido);

        expect(result.success).toBe(false);
    });
});

describe("etlConfigSchema: opções do merge", () => {
    const base = {
        tableName: "clientes",
        spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUv",
        credentialsPath: "./credentials.json",
        mode: "merge",
        dbHost: "localhost",
        dbPort: 3306,
        dbUser: "root",
        dbPassword: "senha123",
        dbName: "loja",
        mergeKeyColumn: "sku",
    };

    it("aceita normalizador, módulos de normalizadores, rótulo de rejeitada e collapse-column", () => {
        const result = etlConfigSchema.safeParse({
            ...base,
            mergeKeyNormalizer: "lowercase",
            normalizerModules: ["./local/meusNormalizers.ts"],
            mergeRejectedKeyLabel: "chave inválida",
            mergeColumns: [
                {
                    column: "nome",
                    strategy: "extra-column",
                    unkeyed: {
                        strategy: "collapse-column",
                        into: "Nomes sem chave",
                        separator: " | ",
                    },
                },
            ],
        });

        expect(result.success).toBe(true);
    });

    it("continua aceitando config de merge sem nenhuma das opções novas", () => {
        const result = etlConfigSchema.safeParse({
            ...base,
            mergeColumns: [{ column: "nome", strategy: "concat" }],
        });

        expect(result.success).toBe(true);
    });

    it("rejeita estratégia unkeyed desconhecida", () => {
        const result = etlConfigSchema.safeParse({
            ...base,
            mergeColumns: [
                {
                    column: "nome",
                    strategy: "concat",
                    unkeyed: { strategy: "outra" },
                },
            ],
        });

        expect(result.success).toBe(false);
    });

    it("aceita byGroup e rejeita estratégia inválida dentro dele", () => {
        const ok = etlConfigSchema.safeParse({
            ...base,
            mergeColumns: [
                {
                    column: "nome",
                    strategy: "extra-column",
                    byGroup: { AB: { strategy: "concat", into: "Nomes AB" } },
                },
            ],
        });
        const ruim = etlConfigSchema.safeParse({
            ...base,
            mergeColumns: [
                {
                    column: "nome",
                    strategy: "extra-column",
                    byGroup: { AB: { strategy: "outra" } },
                },
            ],
        });

        expect(ok.success).toBe(true);
        expect(ruim.success).toBe(false);
    });

    it("aceita distribute quando a estratégia é concat, na coluna e no byGroup", () => {
        const result = etlConfigSchema.safeParse({
            ...base,
            mergeColumns: [
                {
                    column: "cor",
                    strategy: "concat",
                    distribute: {
                        columns: ["cor_1", "cor_2"],
                        overflowInto: "outras_cores",
                    },
                    byGroup: {
                        AB: {
                            strategy: "concat",
                            distribute: { columns: ["cor_ab"] },
                        },
                    },
                },
            ],
        });

        expect(result.success).toBe(true);
    });

    it("rejeita distribute com estratégia diferente de concat, na coluna e no byGroup", () => {
        const naColuna = etlConfigSchema.safeParse({
            ...base,
            mergeColumns: [
                {
                    column: "cor",
                    strategy: "overwrite",
                    distribute: { columns: ["a", "b"] },
                },
            ],
        });
        const noGrupo = etlConfigSchema.safeParse({
            ...base,
            mergeColumns: [
                {
                    column: "cor",
                    strategy: "concat",
                    byGroup: {
                        AB: {
                            strategy: "extra-column",
                            distribute: { columns: ["a"] },
                        },
                    },
                },
            ],
        });

        expect(naColuna.success).toBe(false);
        expect(noGrupo.success).toBe(false);
        expect(naColuna.error?.issues[0]?.message).toBe(
            'distribute só é permitido quando strategy é "concat".',
        );
    });

    it("rejeita distribute com lista de colunas vazia", () => {
        const result = etlConfigSchema.safeParse({
            ...base,
            mergeColumns: [
                {
                    column: "cor",
                    strategy: "concat",
                    distribute: { columns: [] },
                },
            ],
        });

        expect(result.success).toBe(false);
    });

    it("aceita distribute.sources, fillEmpty e combineColumns", () => {
        const result = etlConfigSchema.safeParse({
            ...base,
            fillEmpty: [
                {
                    column: "sala",
                    fallbackColumns: ["sala_reserva"],
                    default: "a definir",
                },
            ],
            combineColumns: [
                {
                    into: "quando",
                    columns: ["data", "hora"],
                    separator: " ",
                },
            ],
            mergeColumns: [
                {
                    column: "instrumento 1",
                    strategy: "concat",
                    distribute: {
                        columns: ["instrumento 1", "instrumento 2"],
                        sources: ["instrumento 2"],
                    },
                },
            ],
        });

        expect(result.success).toBe(true);
    });

    it("rejeita fillEmpty sem column e combineColumns sem into ou sem colunas", () => {
        const fillSemColuna = etlConfigSchema.safeParse({
            ...base,
            fillEmpty: [{ default: "x" }],
        });
        const semInto = etlConfigSchema.safeParse({
            ...base,
            combineColumns: [{ columns: ["a"] }],
        });
        const semColunas = etlConfigSchema.safeParse({
            ...base,
            combineColumns: [{ into: "x", columns: [] }],
        });

        expect(fillSemColuna.success).toBe(false);
        expect(semInto.success).toBe(false);
        expect(semColunas.success).toBe(false);
    });

    it("rejeita into junto com distribute no byGroup", () => {
        const result = etlConfigSchema.safeParse({
            ...base,
            mergeColumns: [
                {
                    column: "cor",
                    strategy: "concat",
                    byGroup: {
                        AB: {
                            strategy: "concat",
                            into: "Cores",
                            distribute: { columns: ["cor_1"] },
                        },
                    },
                },
            ],
        });

        expect(result.success).toBe(false);
    });

    it("aceita validation com as quatro regras", () => {
        const result = etlConfigSchema.safeParse({
            ...base,
            validation: {
                pendingSheet: "Pendências",
                reasonColumn: "Motivo",
                rules: [
                    { column: "nome", rule: "required" },
                    {
                        column: "email",
                        rule: "pattern",
                        pattern: "@",
                        flags: "i",
                    },
                    {
                        column: "plano",
                        rule: "oneOf",
                        values: ["mensal"],
                        ignoreCase: true,
                    },
                    {
                        column: "matricula",
                        rule: "normalizer",
                        normalizer: "digitsOnly",
                        message: "matrícula inválida",
                    },
                ],
            },
        });

        expect(result.success).toBe(true);
    });

    it("rejeita regra desconhecida, regex inválida, oneOf sem valores e lista de regras vazia", () => {
        const configs = [
            { rules: [{ column: "a", rule: "outra" }] },
            { rules: [{ column: "a", rule: "pattern", pattern: "(" }] },
            { rules: [{ column: "a", rule: "oneOf", values: [] }] },
            { rules: [] },
        ];

        for (const validation of configs) {
            expect(
                etlConfigSchema.safeParse({ ...base, validation }).success,
            ).toBe(false);
        }
    });
});
