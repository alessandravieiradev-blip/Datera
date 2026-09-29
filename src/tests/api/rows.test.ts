import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import {
    convert,
    describeColumns,
    detectFormat,
    listNormalizers,
    normalize,
    readRows,
    writeRows,
} from "../../api";

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "etl-api-"));
}

function alunosCsv(dir: string): string {
    const file = path.join(dir, "alunos.csv");
    fs.writeFileSync(
        file,
        "matricula;nome;plano\n2024-0042;Lia Martins;mensal\n2024-0051;Theo Souza;\n",
    );
    return file;
}

describe("detectFormat", () => {
    it("descobre o formato pela extensão", () => {
        expect(detectFormat("alunos.csv")).toBe("csv");
        expect(detectFormat("alunos.TSV")).toBe("csv");
        expect(detectFormat("alunos.xlsx")).toBe("excel");
        expect(detectFormat("escola.sqlite3")).toBe("sqlite");
        expect(() => detectFormat("alunos.pdf")).toThrow("As que eu conheço");
    });
});

describe("readRows e writeRows", () => {
    it("lê um arquivo só pelo caminho", async () => {
        const file = alunosCsv(tempDir());

        expect(await readRows(file)).toEqual([
            { matricula: "2024-0042", nome: "Lia Martins", plano: "mensal" },
            { matricula: "2024-0051", nome: "Theo Souza", plano: null },
        ]);
    });

    it("aceita a config completa da fonte e explica quando está errada", async () => {
        const file = alunosCsv(tempDir());

        expect(await readRows({ type: "csv", path: file })).toHaveLength(2);
        await expect(
            readRows({ type: "csv" } as unknown as string),
        ).rejects.toThrow("A fonte com problema");
    });

    it("SQLite precisa da tabela", async () => {
        const file = path.join(tempDir(), "escola.db");
        const database = new DatabaseSync(file);
        database.exec("CREATE TABLE alunos (nome TEXT)");
        database.exec("INSERT INTO alunos VALUES ('Lia')");
        database.close();

        await expect(readRows(file)).rejects.toThrow("diga qual tabela");
        expect(await readRows(file, { table: "alunos" })).toEqual([
            { nome: "Lia" },
        ]);
    });

    it("grava o resultado e as pendências do lado", async () => {
        const dir = tempDir();
        const file = path.join(dir, "saida", "resultado.json");
        await writeRows([{ nome: "Lia" }], file, {
            pending: [{ Motivo: "sem matrícula", nome: "Caio" }],
        });

        expect(JSON.parse(fs.readFileSync(file, "utf-8"))).toEqual([
            { nome: "Lia" },
        ]);
        expect(
            JSON.parse(
                fs.readFileSync(
                    path.join(dir, "saida", "resultado.pendencias.json"),
                    "utf-8",
                ),
            ),
        ).toEqual([{ Motivo: "sem matrícula", nome: "Caio" }]);
    });
});

describe("convert", () => {
    it("converte CSV em XML e devolve quantas linhas passaram", async () => {
        const dir = tempDir();
        const output = path.join(dir, "alunos.xml");

        expect(
            await convert(alunosCsv(dir), output, {
                write: { root: "alunos", record: "aluno" },
            }),
        ).toBe(2);
        expect(fs.readFileSync(output, "utf-8")).toContain(
            "<aluno>\n    <matricula>2024-0042</matricula>",
        );
    });

    it("não deixa a saída ser o mesmo arquivo da entrada", async () => {
        const file = alunosCsv(tempDir());

        await expect(convert(file, file)).rejects.toThrow("o mesmo arquivo");
    });
});

describe("describeColumns e normalizadores", () => {
    it("conta preenchidos, vazios e valores diferentes", () => {
        expect(
            describeColumns([
                { nome: "Lia", aulas: 12, plano: "mensal" },
                { nome: "Theo", aulas: 8, plano: null },
                { nome: "Lia", aulas: "?", plano: "" },
            ]),
        ).toEqual([
            {
                name: "nome",
                filled: 3,
                empty: 0,
                distinct: 2,
                kind: "texto",
                examples: ["Lia", "Theo"],
            },
            {
                name: "aulas",
                filled: 3,
                empty: 0,
                distinct: 3,
                kind: "misto",
                examples: ["12", "8", "?"],
            },
            {
                name: "plano",
                filled: 1,
                empty: 2,
                distinct: 1,
                kind: "texto",
                examples: ["mensal"],
            },
        ]);
    });

    it("lista e testa os normalizadores prontos", () => {
        expect(listNormalizers()).toEqual(
            expect.arrayContaining(["digitsOnly", "lowercase"]),
        );
        expect(normalize("digitsOnly", "2024-0042")).toBe("20240042");
        expect(normalize("lowercase", " LIA@email.com")).toBe("lia@email.com");
        expect(normalize("digitsOnly", "sem número")).toBe(null);
    });
});
