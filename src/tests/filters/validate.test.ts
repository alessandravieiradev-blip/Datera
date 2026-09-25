import { describe, it, expect } from "vitest";
import { RowValidator } from "../../filters/validate";
import { registerKeyNormalizer } from "../../normalizers/registry";

describe("RowValidator", () => {
    it("separa as linhas válidas das pendentes", () => {
        const { valid, pending } = new RowValidator([
            { column: "email", rule: "required" },
        ]).split([
            { nome: "Lia", email: "lia@email.com" },
            { nome: "Theo", email: "" },
        ]);

        expect(valid).toEqual([{ nome: "Lia", email: "lia@email.com" }]);
        expect(pending).toEqual([
            { Motivo: "email vazio", nome: "Theo", email: "" },
        ]);
    });

    it("coloca o motivo na primeira coluna", () => {
        const { pending } = new RowValidator([
            { column: "email", rule: "required" },
        ]).split([{ nome: "Theo", email: null }]);

        expect(Object.keys(pending[0]!)).toEqual(["Motivo", "nome", "email"]);
    });

    it("aceita nome de coluna de motivo e mensagem próprios", () => {
        const { pending } = new RowValidator(
            [{ column: "email", rule: "required", message: "falta o e-mail" }],
            "Problema",
        ).split([{ email: "  " }]);

        expect(pending[0]).toEqual({ Problema: "falta o e-mail", email: "  " });
    });

    it("pattern testa o formato e ignora célula vazia", () => {
        const { valid, pending } = new RowValidator([
            {
                column: "email",
                rule: "pattern",
                pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
            },
        ]).split([
            { email: "lia@email.com" },
            { email: "lia.email.com" },
            { email: null },
        ]);

        expect(valid).toHaveLength(2);
        expect(pending).toEqual([
            { Motivo: "email fora do formato", email: "lia.email.com" },
        ]);
    });

    it("pattern com flag g não muda o resultado de uma linha pra outra", () => {
        const { valid } = new RowValidator([
            { column: "codigo", rule: "pattern", pattern: "^AB", flags: "gi" },
        ]).split([{ codigo: "ab1" }, { codigo: "ab2" }, { codigo: "AB3" }]);

        expect(valid).toHaveLength(3);
    });

    it("oneOf aceita só os valores da lista, com ou sem diferença de maiúscula", () => {
        const sensivel = new RowValidator([
            { column: "plano", rule: "oneOf", values: ["mensal", "anual"] },
        ]).split([
            { plano: "mensal" },
            { plano: "Mensal" },
            { plano: "semanal" },
        ]);
        const semDiferenca = new RowValidator([
            {
                column: "plano",
                rule: "oneOf",
                values: ["mensal", "anual"],
                ignoreCase: true,
            },
        ]).split([{ plano: "Mensal" }, { plano: "ANUAL " }]);

        expect(sensivel.valid).toHaveLength(1);
        expect(sensivel.pending[1]!.Motivo).toBe(
            "plano com valor não permitido",
        );
        expect(semDiferenca.pending).toHaveLength(0);
    });

    it("normalizer usa um normalizador registrado e reprova quando ele devolve null", () => {
        registerKeyNormalizer("soNumeroDeOitoDigitos", (raw) => {
            const digitos = String(raw).replace(/\D/g, "");
            return digitos.length === 8 ? { key: digitos } : null;
        });

        const { valid, pending } = new RowValidator([
            {
                column: "matricula",
                rule: "normalizer",
                normalizer: "soNumeroDeOitoDigitos",
            },
        ]).split([
            { matricula: "2024-0042" },
            { matricula: 20240042 },
            { matricula: "pendente" },
        ]);

        expect(valid).toHaveLength(2);
        expect(pending[0]!.Motivo).toBe("matricula inválido");
    });

    it("normalizador que não existe dá erro na hora de montar, antes de ler qualquer linha", () => {
        expect(
            () =>
                new RowValidator([
                    {
                        column: "x",
                        rule: "normalizer",
                        normalizer: "naoExiste",
                    },
                ]),
        ).toThrow("não encontrado");
    });

    it("junta todos os motivos de uma linha, sem repetir", () => {
        const { pending } = new RowValidator([
            { column: "nome", rule: "required" },
            { column: "email", rule: "required", message: "sem contato" },
            { column: "telefone", rule: "required", message: "sem contato" },
        ]).split([{ nome: "", email: "", telefone: null }]);

        expect(pending[0]!.Motivo).toBe("nome vazio; sem contato");
    });

    it("sem regra reprovada, a linha passa do jeito que veio", () => {
        const row = { nome: "Lia", plano: "mensal" };
        const { valid } = new RowValidator([
            { column: "nome", rule: "required" },
        ]).split([row]);

        expect(valid[0]).toBe(row);
    });
});
