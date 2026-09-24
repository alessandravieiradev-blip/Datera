import { describe, it, expect } from "vitest";
import { FillEmptyFilter } from "../filters/fillEmpty";

describe("FillEmptyFilter", () => {
    it("não mexe em célula que já tem valor", () => {
        const rows = [{ DDD: "53", Fone: "1111" }];

        expect(
            new FillEmptyFilter([{ column: "DDD", default: "não tem" }]).apply(
                rows,
            ),
        ).toEqual(rows);
    });

    it("usa a primeira coluna reserva que tiver valor", () => {
        const result = new FillEmptyFilter([
            { column: "DDD 3", fallbackColumns: ["DDD 2", "DDD 1"] },
        ]).apply([{ "DDD 1": "53", "DDD 2": " ", "DDD 3": null }]);

        expect(result[0]!["DDD 3"]).toBe("53");
    });

    it("usa o default quando a reserva também está vazia", () => {
        const result = new FillEmptyFilter([
            { column: "DDD 2", fallbackColumns: ["DDD 1"], default: "não tem" },
        ]).apply([{ "DDD 1": "", "DDD 2": null }]);

        expect(result[0]!["DDD 2"]).toBe("não tem");
    });

    it("sem reserva nem default, deixa como veio", () => {
        const result = new FillEmptyFilter([{ column: "obs" }]).apply([
            { obs: null },
        ]);

        expect(result[0]!.obs).toBeNull();
    });

    it("mantém o tipo do valor que veio da reserva", () => {
        const result = new FillEmptyFilter([
            { column: "b", fallbackColumns: ["a"] },
        ]).apply([{ a: 53, b: null }]);

        expect(result[0]!.b).toBe(53);
    });

    it("lê sempre da linha original, então a ordem das regras não muda o resultado", () => {
        const rules = [
            { column: "a", default: "padrão" },
            { column: "b", fallbackColumns: ["a"], default: "nenhum" },
        ];
        const row = { a: null, b: null };

        expect(new FillEmptyFilter(rules).apply([row])[0]).toEqual({
            a: "padrão",
            b: "nenhum",
        });
        expect(
            new FillEmptyFilter([...rules].reverse()).apply([row])[0],
        ).toEqual({ a: "padrão", b: "nenhum" });
    });
});
