import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { sheets_v4 } from "@googleapis/sheets";
import { SheetsSource } from "../../io/sheets/sheetsSource";
import { ExcelSource } from "../../io/excel/excelSource";
import { createWorkbook, saveWorkbook } from "../../io/excel/workbook";
import { convertMany, readRows, readSheets } from "../../api";
import { etlConfigSchema } from "../../config";
import { createSink } from "../../io/factory";

async function matriculas(): Promise<string> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "datera-abas-"));
    const file = path.join(dir, "matriculas.xlsx");
    const workbook = createWorkbook();
    const meses: [string, string[]][] = [
        ["Janeiro", ["Lia Martins", "Theo Souza"]],
        ["Fevereiro", ["Duda Alves"]],
        ['Turma "A"', ["Nina Rocha"]],
    ];
    for (const [mes, nomes] of meses) {
        const sheet = workbook.addWorksheet(mes);
        sheet.addRow(["matricula", "nome"]);
        nomes.forEach((nome, index) => sheet.addRow([`2024-00${index}`, nome]));
    }
    const listas = workbook.addWorksheet("listas");
    listas.state = "hidden";
    listas.addRow(["plano"]);
    listas.addRow(["mensal"]);
    await saveWorkbook(workbook, file);
    return file;
}

describe("Excel com todas as abas", () => {
    it("junta as abas visíveis com a coluna aba na frente", async () => {
        const file = await matriculas();

        const rows = await new ExcelSource({
            path: file,
            allSheets: true,
        }).read();

        expect(rows).toEqual([
            { aba: "Janeiro", matricula: "2024-000", nome: "Lia Martins" },
            { aba: "Janeiro", matricula: "2024-001", nome: "Theo Souza" },
            { aba: "Fevereiro", matricula: "2024-000", nome: "Duda Alves" },
            { aba: 'Turma "A"', matricula: "2024-000", nome: "Nina Rocha" },
        ]);
        expect(Object.keys(rows[0]!)[0]).toBe("aba");
    });

    it("usa o nome de coluna pedido e avisa quando ele já existe", async () => {
        const file = await matriculas();

        expect(
            (await readRows(file, { allSheets: true, sheetColumn: "mes" }))[0],
        ).toEqual({
            mes: "Janeiro",
            matricula: "2024-000",
            nome: "Lia Martins",
        });
        await expect(
            readRows(file, { allSheets: true, sheetColumn: "nome" }),
        ).rejects.toThrow('já tem uma coluna "nome"');
    });

    it("readSheets devolve aba por aba", async () => {
        const tabs = await readSheets(await matriculas());

        expect(tabs.map((tab) => [tab.sheet, tab.rows.length])).toEqual([
            ["Janeiro", 2],
            ["Fevereiro", 1],
            ['Turma "A"', 1],
        ]);
    });

    it("com --to, cada aba vira um arquivo com nome que o Windows aceita", async () => {
        const file = await matriculas();
        const saida = path.join(path.dirname(file), "abas");

        const feitos = await convertMany(file, {
            to: "csv",
            outDir: saida,
            read: { allSheets: true },
        });

        expect(
            feitos.map((item) => [item.sheet, path.basename(item.output)]),
        ).toEqual([
            ["Janeiro", "matriculas-Janeiro.csv"],
            ["Fevereiro", "matriculas-Fevereiro.csv"],
            ['Turma "A"', "matriculas-Turma _A_.csv"],
        ]);
        expect(
            await readRows(path.join(saida, "matriculas-Janeiro.csv")),
        ).toEqual([
            { matricula: "2024-000", nome: "Lia Martins" },
            { matricula: "2024-001", nome: "Theo Souza" },
        ]);
    });

    it("na config, não aceita sheet e allSheets juntos", () => {
        const result = etlConfigSchema.safeParse({
            mode: "raw",
            source: {
                type: "excel",
                path: "./matriculas.xlsx",
                sheet: "Janeiro",
                allSheets: true,
            },
            destination: { type: "csv", path: "./saida.csv" },
        });

        expect(result.success).toBe(false);
    });
});

function fakeSheets(tabs: Record<string, unknown[][]>, hidden: string[] = []) {
    const client = {
        spreadsheets: {
            get: async () => ({
                data: {
                    sheets: Object.keys(tabs).map((title, index) => ({
                        properties: {
                            title,
                            sheetId: index,
                            hidden: hidden.includes(title),
                        },
                    })),
                },
            }),
            values: {
                get: async (params: { range: string }) => {
                    const title = params.range.slice(1, -1).replace(/''/g, "'");
                    return { data: { values: tabs[title] } };
                },
            },
        },
    };
    return client as unknown as sheets_v4.Sheets;
}

describe("Google Planilhas com todas as abas", () => {
    it("lê todas as abas visíveis e pula a escondida", async () => {
        const client = fakeSheets(
            {
                Janeiro: [["nome"], ["Lia Martins"]],
                Fevereiro: [["nome"], ["Theo Souza"]],
                listas: [["plano"], ["mensal"]],
            },
            ["listas"],
        );

        expect(
            await new SheetsSource(client, "id", undefined, {
                allSheets: true,
                sheetColumn: "mes",
            }).read(),
        ).toEqual([
            { mes: "Janeiro", nome: "Lia Martins" },
            { mes: "Fevereiro", nome: "Theo Souza" },
        ]);
    });

    it("não deixa gravar na mesma planilha de onde lê todas as abas", () => {
        const config = etlConfigSchema.parse({
            mode: "raw",
            source: { type: "sheets", spreadsheetId: "mesma", allSheets: true },
            destination: {
                type: "sheets",
                spreadsheetId: "mesma",
                sheet: "Resultado",
            },
            credentialsPath: "./credentials.json",
        });

        expect(() => createSink(config)).toThrow("outra planilha");
    });
});
