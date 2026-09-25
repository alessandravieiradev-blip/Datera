import { describe, it, expect } from "vitest";
import { detectDelimiter, parseCsv, stripBom, toCsv } from "../io/csvFormat";

describe("parseCsv", () => {
    it("lê linhas e colunas simples", () => {
        expect(parseCsv("nome,oficina\nLia,Violão\nTheo,Bateria", ",")).toEqual(
            [
                ["nome", "oficina"],
                ["Lia", "Violão"],
                ["Theo", "Bateria"],
            ],
        );
    });

    it("entende separador, quebra de linha e aspas dentro de aspas", () => {
        const text = 'nome;obs\n"Martins; Lia";"disse ""oi""\nna aula"';

        expect(parseCsv(text, ";")).toEqual([
            ["nome", "obs"],
            ["Martins; Lia", 'disse "oi"\nna aula'],
        ]);
    });

    it("aceita quebra de linha do windows e ignora linha vazia no fim", () => {
        expect(parseCsv("a,b\r\n1,2\r\n\r\n", ",")).toEqual([
            ["a", "b"],
            ["1", "2"],
        ]);
    });

    it("mantém célula vazia como texto vazio", () => {
        expect(parseCsv("a,b,c\n1,,3", ",")).toEqual([
            ["a", "b", "c"],
            ["1", "", "3"],
        ]);
    });

    it("dá erro quando uma aspa abre e nunca fecha", () => {
        expect(() => parseCsv('a\n"sem fim', ",")).toThrow("aspas abertas");
    });
});

describe("detectDelimiter", () => {
    it("acha o ponto e vírgula do excel brasileiro", () => {
        expect(detectDelimiter("nome;oficina;plano\nLia;Violão;mensal")).toBe(
            ";",
        );
    });

    it("ignora separador dentro de aspas", () => {
        expect(detectDelimiter('"a;b;c",d,e\n1,2,3')).toBe(",");
    });

    it("sem nenhum separador, usa vírgula", () => {
        expect(detectDelimiter("nome\nLia")).toBe(",");
    });
});

describe("toCsv e stripBom", () => {
    it("põe aspas só onde precisa", () => {
        expect(toCsv([["a", "b;c", 'x"y', " z"]], ";")).toBe(
            'a;"b;c";"x""y";" z"',
        );
    });

    it("o que o toCsv escreve o parseCsv lê igual", () => {
        const rows = [
            ["nome", "obs"],
            ["Lia", 'linha 1\nlinha 2, "com aspas"'],
        ];

        expect(parseCsv(toCsv(rows, ","), ",")).toEqual(rows);
    });

    it("tira o bom do começo", () => {
        expect(stripBom("﻿nome")).toBe("nome");
        expect(stripBom("nome")).toBe("nome");
    });
});
