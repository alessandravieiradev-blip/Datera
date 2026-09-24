import { describe, it, expect } from "vitest";
import { CombineFilter } from "../filters/combine";
import { CombineColumnsConfig } from "../filters/combineTypes";

const phone = (n: number): CombineColumnsConfig => ({
    into: `Telefone ${n}`,
    parts: [
        {
            column: `DDD ${n}`,
            fallbackColumns: n === 1 ? [] : ["DDD 1"],
            default: "não tem",
        },
        { column: `Fone ${n}` },
    ],
});

describe("CombineFilter", () => {
    it("junta as partes com espaço e remove as colunas de origem", () => {
        const result = new CombineFilter([phone(1)]).apply([
            { Nome: "Ana", "DDD 1": "53", "Fone 1": "99999-0001" },
        ]);

        expect(result).toEqual([
            { Nome: "Ana", "Telefone 1": "53 99999-0001" },
        ]);
    });

    it("usa a coluna reserva quando a parte está vazia", () => {
        const result = new CombineFilter([phone(1), phone(2)]).apply([
            { "DDD 1": "53", "Fone 1": "1111", "DDD 2": "", "Fone 2": "2222" },
        ]);

        expect(result[0]).toEqual({
            "Telefone 1": "53 1111",
            "Telefone 2": "53 2222",
        });
    });

    it("usa o default quando nem a coluna nem a reserva têm valor", () => {
        const result = new CombineFilter([phone(1), phone(2)]).apply([
            {
                "DDD 1": null,
                "Fone 1": "1111",
                "DDD 2": "  ",
                "Fone 2": "2222",
            },
        ]);

        expect(result[0]).toEqual({
            "Telefone 1": "não tem 1111",
            "Telefone 2": "não tem 2222",
        });
    });

    it("parte sem default e sem valor deixa a combinação nula", () => {
        const result = new CombineFilter([phone(1), phone(2)]).apply([
            { "DDD 1": "53", "Fone 1": "1111", "DDD 2": "11", "Fone 2": null },
        ]);

        expect(result[0]!["Telefone 2"]).toBeNull();
    });

    it("aceita números, separador próprio e keepSources", () => {
        const result = new CombineFilter([
            {
                into: "tel",
                parts: [{ column: "ddd" }, { column: "fone" }],
                separator: "-",
                keepSources: true,
            },
        ]).apply([{ ddd: 53, fone: 999 }]);

        expect(result[0]).toEqual({ ddd: 53, fone: 999, tel: "53-999" });
    });

    it("coloca a coluna combinada no lugar da primeira coluna de origem", () => {
        const result = new CombineFilter([phone(1), phone(2)]).apply([
            {
                Nome: "Ana",
                "DDD 1": "53",
                "Fone 1": "1",
                "DDD 2": "53",
                "Fone 2": "2",
                Cidade: "Pelotas",
            },
        ]);

        expect(Object.keys(result[0]!)).toEqual([
            "Nome",
            "Telefone 1",
            "Telefone 2",
            "Cidade",
        ]);
    });

    it("não apaga uma coluna de origem que é o destino de outra combinação", () => {
        const result = new CombineFilter([
            { into: "a", parts: [{ column: "a" }, { column: "b" }] },
        ]).apply([{ a: "x", b: "y" }]);

        expect(result[0]).toEqual({ a: "x y" });
    });
});
