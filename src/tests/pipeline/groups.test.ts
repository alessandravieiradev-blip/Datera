import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import {
    blockRows,
    groupRows,
    MAX_GROUPS,
    tableSuffix,
} from "../../pipeline/groups";
import {
    joinFiles,
    readRows,
    readSheets,
    splitFile,
    splitRows,
} from "../../api";
import { etlConfigSchema, parseConfig } from "../../config";
import { runEtl } from "../../pipeline";
import { silentLogger } from "../../logger";
import { parseCli } from "../../cli";

const ALUNOS = [
    {
        matricula: "2024-0042",
        nome: "Lia Martins",
        plano: "mensal",
        cidade: "Pelotas",
    },
    {
        matricula: "2024-0051",
        nome: "Theo Souza",
        plano: "anual",
        cidade: "Rio Grande",
    },
    {
        matricula: "2024-0077",
        nome: "Duda Alves",
        plano: "mensal",
        cidade: null,
    },
];

function pasta(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "datera-juntar-"));
    fs.mkdirSync(path.join(dir, "meses"));
    fs.writeFileSync(
        path.join(dir, "meses", "01-janeiro.csv"),
        "matricula;nome;plano\n2024-0042;Lia Martins;mensal\n2024-0051;Theo Souza;anual\n",
    );
    fs.writeFileSync(
        path.join(dir, "meses", "02-fevereiro.csv"),
        "Matrícula;Nome;Plano\n2024-0077;Duda Alves;mensal\n",
    );
    return dir;
}

describe("separar em grupos", () => {
    it("agrupa pelo valor, com vazio num grupo só e sem ligar pra maiúscula no nome da coluna", () => {
        expect(
            splitRows(ALUNOS, "Cidade").map((group) => [
                group.value,
                group.rows.length,
            ]),
        ).toEqual([
            ["Pelotas", 1],
            ["Rio Grande", 1],
            ["(vazio)", 1],
        ]);
        expect(() => groupRows(ALUNOS, "bairro")).toThrow(
            'A coluna "bairro" não existe',
        );
    });

    it("recusa separar em grupos demais", () => {
        const muitos = Array.from({ length: MAX_GROUPS + 1 }, (_, index) => ({
            email: `aluno${index}@email.com`,
        }));
        expect(() => groupRows(muitos, "email")).toThrow("O limite é");
    });

    it("blocos colocam uma linha de título antes de cada grupo e tiram a coluna", () => {
        expect(blockRows(ALUNOS, "plano").map((row) => row.matricula)).toEqual([
            "mensal",
            "2024-0042",
            "2024-0077",
            "anual",
            "2024-0051",
        ]);
        expect(tableSuffix("Rio Grande")).toBe("rio_grande");
        expect(tableSuffix("Março/Abril!")).toBe("marco_abril");
        expect(tableSuffix("???")).toBe("vazio");
    });
});

describe("juntar arquivos", () => {
    it("junta com a coluna de origem e alinha as colunas sozinho", async () => {
        const dir = pasta();
        const saida = path.join(dir, "todos.json");

        await joinFiles(path.join(dir, "meses", "*.csv"), saida);

        expect(await readRows(saida)).toEqual([
            {
                origem: "01-janeiro",
                matricula: "2024-0042",
                nome: "Lia Martins",
                plano: "mensal",
            },
            {
                origem: "01-janeiro",
                matricula: "2024-0051",
                nome: "Theo Souza",
                plano: "anual",
            },
            {
                origem: "02-fevereiro",
                matricula: "2024-0077",
                nome: "Duda Alves",
                plano: "mensal",
            },
        ]);
    });

    it("em blocos, cada arquivo ganha uma linha de título", async () => {
        const dir = pasta();
        const saida = path.join(dir, "blocos.csv");

        await joinFiles(path.join(dir, "meses"), saida, { blocks: true });

        expect(
            fs.readFileSync(saida, "utf-8").split("\r\n").slice(0, 3),
        ).toEqual([
            "﻿matricula,nome,plano",
            "01-janeiro,,",
            "2024-0042,Lia Martins,mensal",
        ]);
        await expect(
            joinFiles(path.join(dir, "meses"), saida, {
                blocks: true,
                originColumn: false,
            }),
        ).rejects.toThrow("não pode ser desligada");
    });

    it("com sheetBy, uma aba do Excel por valor", async () => {
        const dir = pasta();
        const saida = path.join(dir, "por-plano.xlsx");

        await joinFiles(path.join(dir, "meses", "*.csv"), saida, {
            sheetBy: "Plano",
        });

        expect(
            (await readSheets(saida)).map((tab) => [
                tab.sheet,
                tab.rows.length,
            ]),
        ).toEqual([
            ["mensal", 2],
            ["anual", 1],
        ]);
    });

    it("não deixa a saída ser uma das entradas", async () => {
        const dir = pasta();
        await expect(
            joinFiles(
                path.join(dir, "meses", "*.csv"),
                path.join(dir, "meses", "01-janeiro.csv"),
            ),
        ).rejects.toThrow("é uma das fontes e também o destino");
    });
});

describe("separar um arquivo", () => {
    it("um arquivo por valor nos formatos sem aba", async () => {
        const dir = pasta();
        await splitFile(
            path.join(dir, "meses", "01-janeiro.csv"),
            path.join(dir, "planos.csv"),
            "plano",
        );

        expect(fs.readdirSync(dir).sort()).toEqual([
            "meses",
            "planos-anual.csv",
            "planos-mensal.csv",
        ]);
    });

    it("no Excel, abas por padrão ou arquivos com files", async () => {
        const dir = pasta();
        const entrada = path.join(dir, "meses", "01-janeiro.csv");
        await splitFile(entrada, path.join(dir, "planos.xlsx"), "plano");
        await splitFile(entrada, path.join(dir, "separados.xlsx"), "plano", {
            files: true,
        });

        expect(
            (await readSheets(path.join(dir, "planos.xlsx"))).map(
                (tab) => tab.sheet,
            ),
        ).toEqual(["mensal", "anual"]);
        expect(fs.existsSync(path.join(dir, "separados-mensal.xlsx"))).toBe(
            true,
        );
    });

    it("sheetBy em CSV explica que precisa do splitBy", async () => {
        const dir = pasta();
        await expect(
            runEtl(
                parseConfig({
                    mode: "raw",
                    source: {
                        type: "csv",
                        path: path.join(dir, "meses", "01-janeiro.csv"),
                    },
                    destination: { type: "csv", path: path.join(dir, "x.csv") },
                    sheetBy: "plano",
                }),
                { logger: silentLogger },
            ),
        ).rejects.toThrow('use "splitBy"');
    });
});

describe("pela config", () => {
    it("sources junta, e uma tabela por valor no banco", async () => {
        const dir = pasta();
        const banco = path.join(dir, "escola.db");

        const report = await runEtl(
            parseConfig({
                mode: "raw",
                sources: [
                    { type: "csv", path: path.join(dir, "meses", "*.csv") },
                ],
                originColumn: "mes",
                alignColumns: true,
                sheetBy: "plano",
                destination: { type: "sqlite", path: banco, table: "alunos" },
            }),
            { logger: silentLogger },
        );

        expect(report.rowsOut).toBe(3);
        const database = new DatabaseSync(banco, { readOnly: true });
        const tabelas = database
            .prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
            )
            .all()
            .map((row) => String(row.name));
        database.close();
        expect(tabelas).toEqual([
            "alunos_anual",
            "alunos_mensal",
            "datera_tabelas",
        ]);
    });

    it("não aceita source e sources juntos, nem dois jeitos de separar", () => {
        const base = {
            mode: "raw",
            destination: { type: "csv", path: "./x.csv" },
        };
        expect(
            etlConfigSchema.safeParse({
                ...base,
                source: { type: "csv", path: "./a.csv" },
                sources: [{ type: "csv", path: "./b.csv" }],
            }).success,
        ).toBe(false);
        expect(
            etlConfigSchema.safeParse({
                ...base,
                source: { type: "csv", path: "./a.csv" },
                splitBy: "cidade",
                sheetBy: "plano",
            }).success,
        ).toBe(false);
    });
});

describe("terminal", () => {
    it("join pega a última como saída e split exige --by", () => {
        expect(
            parseCli([
                "node",
                "datera",
                "join",
                "janeiro.csv",
                "fevereiro.csv",
                "todos.xlsx",
                "--sheet-by",
                "plano",
                "--no-align",
            ]),
        ).toMatchObject({
            command: "join",
            inputs: ["janeiro.csv", "fevereiro.csv"],
            output: "todos.xlsx",
            sheetBy: "plano",
            align: false,
            originColumn: "origem",
        });
        expect(
            parseCli([
                "node",
                "datera",
                "join",
                "a.csv",
                "b.csv",
                "--no-origin",
            ]),
        ).toMatchObject({ originColumn: false });
        expect(
            parseCli([
                "node",
                "datera",
                "split",
                "a.csv",
                "b.xlsx",
                "--by",
                "cidade",
                "--files",
            ]),
        ).toMatchObject({ command: "split", by: "cidade", files: true });
    });
});
