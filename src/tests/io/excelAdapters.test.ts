import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Workbook } from "exceljs";
import { ExcelSource } from "../../io/excel/excelSource";
import { ExcelSink, safeSheetName } from "../../io/excel/excelSink";
import { fromExcelCell } from "../../io/excel/excelCell";
import { saveWorkbook, openWorkbook } from "../../io/excel/workbook";

function tempFile(name: string): string {
    return path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), "etl-excel-")),
        name,
    );
}

describe("fromExcelCell", () => {
    it("deixa texto e número como estão e vazio vira null", () => {
        expect(fromExcelCell("Lia")).toBe("Lia");
        expect(fromExcelCell(42)).toBe(42);
        expect(fromExcelCell("")).toBeNull();
        expect(fromExcelCell(null)).toBeNull();
        expect(fromExcelCell(undefined)).toBeNull();
    });

    it("usa o resultado da fórmula e o texto do link", () => {
        expect(fromExcelCell({ formula: "A1+1", result: 3 })).toBe(3);
        expect(
            fromExcelCell({ text: "site", hyperlink: "https://exemplo.com" }),
        ).toBe("site");
    });

    it("junta texto com formatação e converte data e booleano", () => {
        expect(
            fromExcelCell({
                richText: [
                    { text: "Vio" },
                    { text: "lão", font: { bold: true } },
                ],
            }),
        ).toBe("Violão");
        expect(fromExcelCell(new Date(Date.UTC(2024, 2, 10)))).toBe(
            "2024-03-10",
        );
        expect(fromExcelCell(true)).toBe("true");
    });
});

describe("ExcelSource", () => {
    it("lê a primeira aba, pula linha vazia e ignora coluna sem nome", async () => {
        const file = tempFile("alunos.xlsx");
        const workbook = new Workbook();
        const ws = workbook.addWorksheet("Alunos");
        ws.addRow(["nome", "matricula", null, "total"]);
        ws.addRow(["Lia", 42, "sobra", { formula: "B2*2", result: 84 }]);
        ws.addRow([]);
        ws.addRow(["Theo", null, null, null]);
        await saveWorkbook(workbook, file);

        expect(await new ExcelSource({ path: file }).read()).toEqual([
            { nome: "Lia", matricula: 42, total: 84 },
            { nome: "Theo", matricula: null, total: null },
        ]);
    });

    it("lê a aba pelo nome e avisa quando ela não existe", async () => {
        const file = tempFile("dados.xlsx");
        const workbook = new Workbook();
        workbook.addWorksheet("Capa").addRow(["nada"]);
        const ws = workbook.addWorksheet("Alunos");
        ws.addRow(["nome"]);
        ws.addRow(["Lia"]);
        await saveWorkbook(workbook, file);

        expect(
            await new ExcelSource({ path: file, sheet: "Alunos" }).read(),
        ).toEqual([{ nome: "Lia" }]);
        await expect(
            new ExcelSource({ path: file, sheet: "Outra" }).read(),
        ).rejects.toThrow("Abas: Capa, Alunos");
    });
});

describe("ExcelSink", () => {
    const rows = [
        { nome: "Lia", instrumento: "violão", instrumento_2: "voz" },
        { nome: "Theo", instrumento: "bateria", instrumento_2: null },
    ];

    it("escreve e lê de volta igual", async () => {
        const file = tempFile("saida/resultado.xlsx");

        await new ExcelSink({ path: file }).write(rows);

        expect(await new ExcelSource({ path: file }).read()).toEqual(rows);
    });

    it("as pendências viram outra aba no mesmo arquivo", async () => {
        const file = tempFile("resultado.xlsx");
        const sink = new ExcelSink({ path: file });

        await sink.write(rows);
        await sink.write([{ Motivo: "sem matrícula", nome: "Caio" }], {
            name: "Pendências",
        });

        const workbook = await openWorkbook(file);
        expect(workbook.worksheets.map((ws) => ws.name)).toEqual([
            "Dados",
            "Pendências",
        ]);
        expect(
            await new ExcelSource({ path: file, sheet: "Pendências" }).read(),
        ).toEqual([{ Motivo: "sem matrícula", nome: "Caio" }]);
    });

    it("rodar de novo recria o arquivo e não deixa pendência velha", async () => {
        const file = tempFile("resultado.xlsx");
        const sink = new ExcelSink({ path: file, sheet: "Alunos" });

        await sink.write(rows);
        await sink.write([{ Motivo: "x" }], { name: "Pendências" });
        await sink.write(rows);

        const workbook = await openWorkbook(file);
        expect(workbook.worksheets.map((ws) => ws.name)).toEqual(["Alunos"]);
    });

    it("arruma nome de aba que o excel não aceita", () => {
        expect(safeSheetName("Pendências: março/2024")).toBe(
            "Pendências  março 2024",
        );
        expect(safeSheetName("[]")).toBe("Dados");
        expect(safeSheetName("x".repeat(40))).toHaveLength(31);
    });
});
