import { describe, it, expect } from "vitest";
import { CombineFilter } from "../filters/combine";

describe("CombineFilter", () => {
    it("junta as colunas com espaço e remove as colunas de origem", () => {
        const result = new CombineFilter([
            { into: "quando", columns: ["data", "hora"] },
        ]).apply([{ aula: "Violão", data: "10/03", hora: "19:00" }]);

        expect(result).toEqual([{ aula: "Violão", quando: "10/03 19:00" }]);
    });

    it("se falta alguma coluna a combinação fica nula", () => {
        const result = new CombineFilter([
            { into: "quando", columns: ["data", "hora"] },
        ]).apply([
            { data: "10/03", hora: null },
            { data: "  ", hora: "19:00" },
        ]);

        expect(result[0]!.quando).toBeNull();
        expect(result[1]!.quando).toBeNull();
    });

    it("aceita números, separador próprio e keepSources", () => {
        const result = new CombineFilter([
            {
                into: "turma",
                columns: ["ano", "numero"],
                separator: "-",
                keepSources: true,
            },
        ]).apply([{ ano: 2024, numero: 3 }]);

        expect(result[0]).toEqual({ ano: 2024, numero: 3, turma: "2024-3" });
    });

    it("coloca a coluna combinada no lugar da primeira coluna de origem", () => {
        const result = new CombineFilter([
            { into: "quando 1", columns: ["data 1", "hora 1"] },
            { into: "quando 2", columns: ["data 2", "hora 2"] },
        ]).apply([
            {
                aula: "Violão",
                "data 1": "10/03",
                "hora 1": "18:00",
                "data 2": "17/03",
                "hora 2": "18:00",
                sala: "Sala 1",
            },
        ]);

        expect(Object.keys(result[0]!)).toEqual([
            "aula",
            "quando 1",
            "quando 2",
            "sala",
        ]);
    });

    it("uma combinação pode usar a coluna de origem de outra", () => {
        const result = new CombineFilter([
            { into: "completo", columns: ["nome", "sobrenome"] },
            { into: "curto", columns: ["nome"] },
        ]).apply([{ nome: "Lia", sobrenome: "Martins" }]);

        expect(result[0]).toEqual({ completo: "Lia Martins", curto: "Lia" });
    });

    it("não apaga uma coluna de origem que é o destino de outra combinação", () => {
        const result = new CombineFilter([
            { into: "a", columns: ["a", "b"] },
        ]).apply([{ a: "x", b: "y" }]);

        expect(result[0]).toEqual({ a: "x y" });
    });
});
