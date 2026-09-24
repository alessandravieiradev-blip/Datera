import { describe, it, expect } from "vitest";
import { CombineFilter } from "../filters/combine";

describe("CombineFilter", () => {
    it("junta as colunas com espaço e remove as colunas de origem", () => {
        const result = new CombineFilter([
            { into: "Telefone", columns: ["DDD", "Fone"] },
        ]).apply([{ Nome: "Ana", DDD: "53", Fone: "99999-0001" }]);

        expect(result).toEqual([{ Nome: "Ana", Telefone: "53 99999-0001" }]);
    });

    it("se falta alguma coluna a combinação fica nula", () => {
        const result = new CombineFilter([
            { into: "Telefone", columns: ["DDD", "Fone"] },
        ]).apply([
            { DDD: "53", Fone: null },
            { DDD: "  ", Fone: "1111" },
        ]);

        expect(result[0]!.Telefone).toBeNull();
        expect(result[1]!.Telefone).toBeNull();
    });

    it("aceita números, separador próprio e keepSources", () => {
        const result = new CombineFilter([
            {
                into: "tel",
                columns: ["ddd", "fone"],
                separator: "-",
                keepSources: true,
            },
        ]).apply([{ ddd: 53, fone: 999 }]);

        expect(result[0]).toEqual({ ddd: 53, fone: 999, tel: "53-999" });
    });

    it("coloca a coluna combinada no lugar da primeira coluna de origem", () => {
        const result = new CombineFilter([
            { into: "Telefone 1", columns: ["DDD 1", "Fone 1"] },
            { into: "Telefone 2", columns: ["DDD 2", "Fone 2"] },
        ]).apply([
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

    it("uma combinação pode usar a coluna de origem de outra", () => {
        const result = new CombineFilter([
            { into: "completo", columns: ["nome", "sobrenome"] },
            { into: "curto", columns: ["nome"] },
        ]).apply([{ nome: "Ana", sobrenome: "Souza" }]);

        expect(result[0]).toEqual({ completo: "Ana Souza", curto: "Ana" });
    });

    it("não apaga uma coluna de origem que é o destino de outra combinação", () => {
        const result = new CombineFilter([
            { into: "a", columns: ["a", "b"] },
        ]).apply([{ a: "x", b: "y" }]);

        expect(result[0]).toEqual({ a: "x y" });
    });
});
