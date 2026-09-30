import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import {
    compareFiles,
    compareRows,
    comparisonRows,
    readRows,
    readSheets,
    summarize,
    summarizeFile,
} from "../../api";
import { etlConfigSchema, parseConfig } from "../../config";
import { checkConfigText } from "../../config/check";
import { runEtl } from "../../pipeline";
import { silentLogger } from "../../logger";
import { parseCli } from "../../cli";
import { runCommand } from "../../commands";
import { compareSourceOf } from "../../io/servers";

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
    {
        matricula: "2024-0080",
        nome: "Nina Rocha",
        plano: "mensal",
        cidade: "Pelotas",
    },
];

const AGOSTO =
    "matricula;nome;plano;instrumento\n2024-0042;Lia Martins;mensal;violão\n2024-0051;Theo Souza;anual;piano\n2024-0077;Duda Alves;mensal;canto\n";
const SETEMBRO =
    "Matrícula;Nome;Plano;Instrumento\n2024-0042;Lia Martins;anual;violão\n2024-0051;Theo Souza;anual;piano\n2024-0090;Bia Lopes;mensal;ukulele\n";

function pasta(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "datera-resumo-"));
    fs.writeFileSync(path.join(dir, "agosto.csv"), AGOSTO);
    fs.writeFileSync(path.join(dir, "setembro.csv"), SETEMBRO);
    return dir;
}

describe("resumo por categoria", () => {
    it("conta por valor, do maior pro menor, com vazio num grupo só", () => {
        expect(summarize(ALUNOS, "Cidade")).toEqual([
            { cidade: "Pelotas", quantidade: 2 },
            { cidade: "(vazio)", quantidade: 1 },
            { cidade: "Rio Grande", quantidade: 1 },
        ]);
    });

    it("conta pela combinação de mais de uma coluna", () => {
        expect(summarize(ALUNOS, ["plano", "cidade"])).toEqual([
            { plano: "mensal", cidade: "Pelotas", quantidade: 2 },
            { plano: "anual", cidade: "Rio Grande", quantidade: 1 },
            { plano: "mensal", cidade: "(vazio)", quantidade: 1 },
        ]);
        expect(() => summarize(ALUNOS, "turma")).toThrow(
            'A coluna "turma" não existe',
        );
    });

    it("na config, grava o resumo como aba extra no Excel", async () => {
        const dir = pasta();
        const saida = path.join(dir, "setembro.xlsx");

        await runEtl(
            parseConfig({
                mode: "raw",
                source: { type: "csv", path: path.join(dir, "setembro.csv") },
                destination: { type: "excel", path: saida },
                summary: [
                    { by: "plano" },
                    { by: "instrumento", name: "Instrumentos" },
                ],
            }),
            { logger: silentLogger },
        );

        const abas = await readSheets(saida);
        expect(abas.map((aba) => aba.sheet)).toEqual([
            "Dados",
            "Por plano",
            "Instrumentos",
        ]);
        expect(abas[1]!.rows).toEqual([
            { Plano: "anual", quantidade: 2 },
            { Plano: "mensal", quantidade: 1 },
        ]);
    });

    it("em CSV vira outro arquivo, e no banco outra tabela", async () => {
        const dir = pasta();
        await runEtl(
            parseConfig({
                mode: "raw",
                source: { type: "csv", path: path.join(dir, "agosto.csv") },
                destination: { type: "csv", path: path.join(dir, "saida.csv") },
                summary: { by: "plano" },
            }),
            { logger: silentLogger },
        );
        expect(await readRows(path.join(dir, "saida.por-plano.csv"))).toEqual([
            { plano: "mensal", quantidade: "2" },
            { plano: "anual", quantidade: "1" },
        ]);

        const banco = path.join(dir, "escola.db");
        await runEtl(
            parseConfig({
                mode: "raw",
                source: { type: "csv", path: path.join(dir, "agosto.csv") },
                destination: { type: "sqlite", path: banco, table: "alunos" },
                summary: { by: "plano" },
            }),
            { logger: silentLogger },
        );
        const database = new DatabaseSync(banco, { readOnly: true });
        const linhas = database
            .prepare("SELECT plano, quantidade FROM alunos_por_plano")
            .all();
        database.close();
        expect(
            linhas.map((row) => [row.plano, Number(row.quantidade)]),
        ).toEqual([
            ["mensal", 2],
            ["anual", 1],
        ]);
    });

    it("recusa resumo com o mesmo nome de outra aba antes de gravar", async () => {
        const dir = pasta();
        const saida = path.join(dir, "saida.xlsx");
        await expect(
            runEtl(
                parseConfig({
                    mode: "raw",
                    source: { type: "csv", path: path.join(dir, "agosto.csv") },
                    destination: { type: "excel", path: saida },
                    summary: { by: "plano", name: "Dados" },
                }),
                { logger: silentLogger },
            ),
        ).rejects.toThrow('O resumo "Dados"');
        expect(fs.existsSync(saida)).toBe(false);
    });

    it("summarizeFile devolve o resumo e grava quando tem saída", async () => {
        const dir = pasta();
        const resumo = await summarizeFile(
            path.join(dir, "agosto.csv"),
            "plano",
            {
                output: path.join(dir, "resumo.json"),
            },
        );
        expect(resumo).toHaveLength(2);
        expect(await readRows(path.join(dir, "resumo.json"))).toEqual(resumo);
        await expect(
            summarizeFile(path.join(dir, "agosto.csv"), "plano", {
                output: path.join(dir, "agosto.csv"),
            }),
        ).rejects.toThrow("mesmo arquivo");
    });
});

describe("comparar dois arquivos", () => {
    it("acha quem entrou, saiu e mudou, mesmo com o cabeçalho diferente", async () => {
        const dir = pasta();
        const comparacao = await compareFiles(
            path.join(dir, "agosto.csv"),
            path.join(dir, "setembro.csv"),
            { key: "matricula" },
        );

        expect(comparacao.added.map((row) => row["Nome"])).toEqual([
            "Bia Lopes",
        ]);
        expect(comparacao.removed.map((row) => row["nome"])).toEqual([
            "Duda Alves",
        ]);
        expect(
            comparacao.changed.map((item) => [item.key, item.changes]),
        ).toEqual([
            [
                "2024-0042",
                [{ column: "Plano", before: "mensal", after: "anual" }],
            ],
        ]);
        expect(comparacao.unchanged).toHaveLength(1);
    });

    it("gera as linhas com situação e mudanças", () => {
        const antes = [
            { matricula: "1", plano: "mensal", valor: "10" },
            { matricula: "2", plano: "anual", valor: "20" },
        ];
        const depois = [
            { matricula: "1", plano: "anual", valor: 10 },
            { matricula: "3", plano: "mensal", valor: "30" },
        ];
        const comparacao = compareRows(antes, depois, "matricula");

        expect(comparisonRows(comparacao)).toEqual([
            {
                situação: "entrou",
                matricula: "3",
                plano: "mensal",
                valor: "30",
                mudanças: null,
            },
            {
                situação: "saiu",
                matricula: "2",
                plano: "anual",
                valor: "20",
                mudanças: null,
            },
            {
                situação: "mudou",
                matricula: "1",
                plano: "anual",
                valor: 10,
                mudanças: "plano: mensal → anual",
            },
        ]);
        expect(
            compareRows(antes, depois, "matricula", { ignore: ["plano"] })
                .changed,
        ).toHaveLength(0);
    });

    it("avisa chave repetida e deixa de fora chave vazia", () => {
        expect(() =>
            compareRows(
                [{ matricula: "1" }, { matricula: "1" }],
                [{ matricula: "1" }],
                "matricula",
            ),
        ).toThrow('A chave "1" aparece mais de uma vez no arquivo de antes');
        const comparacao = compareRows(
            [
                { matricula: "1", nome: "Lia" },
                { matricula: "", nome: "?" },
            ],
            [{ matricula: "1", nome: "Lia", turma: "B" }],
            "matricula",
        );
        expect(comparacao.skippedBefore).toBe(1);
        expect(comparacao.columnsOnlyAfter).toEqual(["turma"]);
    });

    it("com saída e sheetBy, uma aba por situação", async () => {
        const dir = pasta();
        const saida = path.join(dir, "diferencas.xlsx");
        await compareFiles(
            path.join(dir, "agosto.csv"),
            path.join(dir, "setembro.csv"),
            { key: "matricula", output: saida, sheetBy: "situação" },
        );
        expect((await readSheets(saida)).map((aba) => aba.sheet)).toEqual([
            "entrou",
            "saiu",
            "mudou",
        ]);
    });

    it("na config, compara com a fonte do compare e conta no relatório", async () => {
        const dir = pasta();
        const saida = path.join(dir, "diferencas.csv");
        const report = await runEtl(
            parseConfig({
                mode: "raw",
                source: { type: "csv", path: path.join(dir, "setembro.csv") },
                compare: {
                    with: { type: "csv", path: path.join(dir, "agosto.csv") },
                    key: "matricula",
                    keepUnchanged: true,
                },
                destination: { type: "csv", path: saida },
                summary: { by: "situação" },
            }),
            { logger: silentLogger },
        );

        expect(report.comparison).toEqual({
            added: 1,
            removed: 1,
            changed: 1,
            unchanged: 1,
        });
        expect(report.rowsOut).toBe(4);
        expect(
            (await readRows(path.join(dir, "diferencas.por-situacao.csv")))
                .length,
        ).toBe(4);
    });

    it("não deixa o destino ser o arquivo do compare", async () => {
        const dir = pasta();
        const config = {
            mode: "raw",
            source: { type: "csv", path: path.join(dir, "setembro.csv") },
            compare: {
                with: { type: "csv", path: path.join(dir, "agosto.csv") },
                key: "matricula",
            },
            destination: { type: "csv", path: path.join(dir, "agosto.csv") },
        };
        await expect(
            runEtl(parseConfig(config), { logger: silentLogger }),
        ).rejects.toThrow("mesmo arquivo");
        expect(fs.readFileSync(path.join(dir, "agosto.csv"), "utf-8")).toBe(
            AGOSTO,
        );

        const faltando = checkConfigText(
            JSON.stringify({
                ...config,
                compare: {
                    with: { type: "csv", path: "./sumiu.csv" },
                    key: "matricula",
                },
                destination: { type: "csv", path: "./x.csv" },
            }),
            dir,
        );
        expect(
            faltando.problems.filter(
                (item) => item.where === "compare.with.path",
            ),
        ).toEqual([
            {
                where: "compare.with.path",
                message: "Arquivo não encontrado: ./sumiu.csv",
            },
        ]);
    });

    it("a fonte do compare só herda a senha no mesmo servidor", () => {
        const base = {
            mode: "raw" as const,
            source: {
                type: "postgres" as const,
                host: "banco.escola.local",
                user: "leitura",
                password: "segredo",
                database: "escola",
                table: "alunos",
            },
            destination: { type: "csv" as const, path: "./x.csv" },
        };
        const mesmo = compareSourceOf(
            etlConfigSchema.parse({
                ...base,
                compare: {
                    with: { type: "postgres", table: "alunos_agosto" },
                    key: "matricula",
                },
            }),
        );
        expect(mesmo).toMatchObject({
            host: "banco.escola.local",
            password: "segredo",
            table: "alunos_agosto",
        });
        const outro = compareSourceOf(
            etlConfigSchema.parse({
                ...base,
                compare: {
                    with: {
                        type: "postgres",
                        host: "outro.servidor.com",
                        table: "alunos",
                    },
                    key: "matricula",
                },
            }),
        );
        expect(outro).toMatchObject({ host: "outro.servidor.com" });
        expect((outro as { password?: string }).password).toBe(undefined);
    });

    it("a config do compare precisa de chave", () => {
        expect(
            etlConfigSchema.safeParse({
                mode: "raw",
                source: { type: "csv", path: "./a.csv" },
                compare: { with: { type: "csv", path: "./b.csv" } },
                destination: { type: "csv", path: "./x.csv" },
            }).success,
        ).toBe(false);
    });
});

describe("terminal", () => {
    it("summary e compare leem as opções", () => {
        expect(
            parseCli([
                "node",
                "datera",
                "summary",
                "alunos.xlsx",
                "--by",
                "plano,cidade",
            ]),
        ).toMatchObject({
            command: "summary",
            input: "alunos.xlsx",
            output: undefined,
            by: ["plano", "cidade"],
        });
        expect(
            parseCli([
                "node",
                "datera",
                "compare",
                "agosto.xlsx",
                "setembro.xlsx",
                "--key",
                "matricula",
                "--ignore",
                "telefone",
                "--out",
                "diferencas.xlsx",
                "--sheet-by",
                "situação",
            ]),
        ).toMatchObject({
            command: "compare",
            before: "agosto.xlsx",
            after: "setembro.xlsx",
            key: ["matricula"],
            ignore: ["telefone"],
            output: "diferencas.xlsx",
            sheetBy: "situação",
            keepUnchanged: false,
        });
    });

    it("compare mostra o resumo na tela", async () => {
        const dir = pasta();
        const linhas: string[] = [];
        const logger = {
            info: (text: string) => linhas.push(text),
            warn: (text: string) => linhas.push(text),
            error: (text: string) => linhas.push(text),
        };
        const code = await runCommand(
            parseCli([
                "node",
                "datera",
                "compare",
                path.join(dir, "agosto.csv"),
                path.join(dir, "setembro.csv"),
                "--key",
                "matricula",
            ]),
            logger,
        );
        expect(code).toBe(0);
        expect(linhas).toContain("1 entrou, 1 saiu, 1 mudou e 1 ficou igual.");
        expect(linhas).toContain("  2024-0042: Plano: mensal → anual");
        expect(linhas).toContain("  2024-0077");
    });
});
