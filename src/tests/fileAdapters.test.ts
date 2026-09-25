import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { CsvSource } from "../io/csvSource";
import { JsonSource } from "../io/jsonSource";
import { CsvSink } from "../io/csvSink";
import { JsonSink } from "../io/jsonSink";
import { extraOutputPath, slugify } from "../io/files";

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "etl-teste-"));
}

function writeFile(
    dir: string,
    name: string,
    content: string | Buffer,
): string {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, content);
    return filePath;
}

describe("CsvSource", () => {
    it("lê o csv virando uma linha por objeto, com célula vazia como null", async () => {
        const file = writeFile(
            tempDir(),
            "alunos.csv",
            "nome,oficina\nLia,Violão\nTheo,\n",
        );

        expect(await new CsvSource({ path: file }).read()).toEqual([
            { nome: "Lia", oficina: "Violão" },
            { nome: "Theo", oficina: null },
        ]);
    });

    it("descobre o ponto e vírgula sozinho e tira o bom do cabeçalho", async () => {
        const file = writeFile(
            tempDir(),
            "alunos.csv",
            "﻿nome;plano\nLia;mensal\n",
        );

        expect(await new CsvSource({ path: file }).read()).toEqual([
            { nome: "Lia", plano: "mensal" },
        ]);
    });

    it("lê arquivo em latin1 sem estragar os acentos", async () => {
        const file = writeFile(
            tempDir(),
            "alunos.csv",
            Buffer.from("nome;oficina\nJoão;Violão\n", "latin1"),
        );

        expect(
            await new CsvSource({ path: file, encoding: "latin1" }).read(),
        ).toEqual([{ nome: "João", oficina: "Violão" }]);
    });

    it("avisa quando o arquivo não existe", async () => {
        await expect(
            new CsvSource({ path: "/nao/existe.csv" }).read(),
        ).rejects.toThrow("não encontrado");
    });
});

describe("JsonSource", () => {
    it("achata objeto dentro de objeto e junta lista simples", async () => {
        const file = writeFile(
            tempDir(),
            "alunos.json",
            JSON.stringify([
                {
                    nome: "Lia",
                    idade: 20,
                    ativo: true,
                    endereco: { cidade: "Pelotas" },
                    instrumentos: ["violão", "voz"],
                },
            ]),
        );

        expect(await new JsonSource({ path: file }).read()).toEqual([
            {
                nome: "Lia",
                idade: 20,
                ativo: "true",
                "endereco.cidade": "Pelotas",
                instrumentos: "violão, voz",
            },
        ]);
    });

    it("pega a lista dentro de outras chaves com recordsPath", async () => {
        const file = writeFile(
            tempDir(),
            "dados.json",
            JSON.stringify({ dados: { alunos: [{ nome: "Lia" }] } }),
        );

        expect(
            await new JsonSource({
                path: file,
                recordsPath: "dados.alunos",
            }).read(),
        ).toEqual([{ nome: "Lia" }]);
    });

    it("reclama quando não é uma lista de objetos", async () => {
        const dir = tempDir();
        const naoLista = writeFile(
            dir,
            "a.json",
            JSON.stringify({ nome: "Lia" }),
        );
        const quebrado = writeFile(dir, "b.json", "{ nome: ");

        await expect(new JsonSource({ path: naoLista }).read()).rejects.toThrow(
            "lista de objetos",
        );
        await expect(new JsonSource({ path: quebrado }).read()).rejects.toThrow(
            "JSON inválido",
        );
    });
});

describe("CsvSink e JsonSink", () => {
    const rows = [
        { nome: "Lia", instrumento: "violão", instrumento_2: "voz" },
        { nome: "Theo", instrumento: "bateria", instrumento_2: null },
    ];

    it("escreve o csv com bom e lê de volta igual", async () => {
        const file = path.join(tempDir(), "saida", "resultado.csv");

        await new CsvSink({ path: file }).write(rows);

        expect(fs.readFileSync(file, "utf8").startsWith("﻿")).toBe(true);
        expect(await new CsvSource({ path: file }).read()).toEqual(rows);
    });

    it("sem bom e com ponto e vírgula quando pedir", async () => {
        const file = path.join(tempDir(), "resultado.csv");

        await new CsvSink({ path: file, delimiter: ";", bom: false }).write(
            rows,
        );

        expect(fs.readFileSync(file, "utf8").split("\r\n")[0]).toBe(
            "nome;instrumento;instrumento_2",
        );
    });

    it("a saída extra vira outro arquivo do lado da principal", async () => {
        const dir = tempDir();
        const file = path.join(dir, "resultado.json");

        await new JsonSink({ path: file }).write(rows);
        await new JsonSink({ path: file }).write([], { name: "Pendências" });

        expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(rows);
        expect(
            JSON.parse(
                fs.readFileSync(
                    path.join(dir, "resultado.pendencias.json"),
                    "utf8",
                ),
            ),
        ).toEqual([]);
    });

    it("monta o nome do arquivo extra sem acento nem espaço", () => {
        expect(slugify("Pendências do Mês")).toBe("pendencias-do-mes");
        expect(extraOutputPath("saida/resultado.csv", "Pendências")).toBe(
            "saida/resultado.pendencias.csv",
        );
        expect(extraOutputPath("saida/resultado.csv", undefined)).toBe(
            "saida/resultado.csv",
        );
    });
});
