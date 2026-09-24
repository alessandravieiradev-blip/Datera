import { describe, it, expect } from "vitest";
import { FillEmptyFilter } from "../filters/fillEmpty";

describe("FillEmptyFilter", () => {
    it("não mexe em célula que já tem valor", () => {
        const rows = [{ sala: "Sala 1", hora: "19:00" }];

        expect(
            new FillEmptyFilter([
                { column: "sala", default: "a definir" },
            ]).apply(rows),
        ).toEqual(rows);
    });

    it("usa a primeira coluna reserva que tiver valor", () => {
        const result = new FillEmptyFilter([
            {
                column: "sala",
                fallbackColumns: ["sala_reserva", "sala_antiga"],
            },
        ]).apply([{ sala_antiga: "Sala 3", sala_reserva: " ", sala: null }]);

        expect(result[0]!.sala).toBe("Sala 3");
    });

    it("usa o default quando a reserva também está vazia", () => {
        const result = new FillEmptyFilter([
            {
                column: "sala",
                fallbackColumns: ["sala_reserva"],
                default: "a definir",
            },
        ]).apply([{ sala_reserva: "", sala: null }]);

        expect(result[0]!.sala).toBe("a definir");
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
        ]).apply([{ a: 42, b: null }]);

        expect(result[0]!.b).toBe(42);
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
        ).toEqual({
            a: "padrão",
            b: "nenhum",
        });
    });
});
