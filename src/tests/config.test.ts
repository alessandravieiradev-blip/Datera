    import { describe, it, expect } from "vitest";
    import { etlConfigSchema } from "../config";

    describe("etlConfigSchema", () => {
        it("Aceita uma config válida com todos os campos corretos", () => {
            const validConfig = {
                tableName: "Clientes",
                spreadsheetId:  "1fQycp0FJZJPObYZvWDu8l4U5otfBD4kXDyPEsYmxMk8",
                credentialsPath: "./credentials.json",
                mode: "raw",
                dbHost: "localhost",
                dbPort: 3306,
                dbUser: "root",
                dbPassword: "senha123",
                dbName: "loja",
            };
            
            const result = etlConfigSchema.safeParse(validConfig);

            expect (result.success).toBe(true);
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
                    unkeyed: { strategy: "collapse-column", into: "Nomes sem chave", separator: " | " },
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
            mergeColumns: [{ column: "nome", strategy: "concat", unkeyed: { strategy: "outra" } }],
        });

        expect(result.success).toBe(false);
    });
});

