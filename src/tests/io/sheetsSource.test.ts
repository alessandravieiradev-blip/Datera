import { describe, it, expect } from "vitest";
import { sheets_v4 } from "googleapis";
import { SheetsSource } from "../../io/sheets/sheetsSource";

function fakeSheets(tabs: Record<string, unknown[][]>) {
    const ranges: string[] = [];
    const client = {
        spreadsheets: {
            get: async () => ({
                data: {
                    sheets: Object.keys(tabs).map((title, index) => ({
                        properties: { title, sheetId: index },
                    })),
                },
            }),
            values: {
                get: async (params: { range: string }) => {
                    ranges.push(params.range);
                    const title = params.range.slice(1, -1).replace(/''/g, "'");
                    return { data: { values: tabs[title] } };
                },
            },
        },
    };
    return { client: client as unknown as sheets_v4.Sheets, ranges };
}

describe("SheetsSource", () => {
    it("lê a primeira aba usando a primeira linha como cabeçalho", async () => {
        const { client, ranges } = fakeSheets({
            Alunos: [
                ["nome", "matricula", "ativo"],
                ["Lia", 42, true],
                ["Theo", "", false],
            ],
            Outra: [["x"]],
        });

        expect(await new SheetsSource(client, "id").read()).toEqual([
            { nome: "Lia", matricula: 42, ativo: "true" },
            { nome: "Theo", matricula: null, ativo: "false" },
        ]);
        expect(ranges).toEqual(["'Alunos'"]);
    });

    it("linha mais curta que o cabeçalho completa com null e linha vazia é pulada", async () => {
        const { client } = fakeSheets({
            Alunos: [
                ["nome", "oficina", "plano"],
                ["Lia"],
                [],
                ["", ""],
                ["Theo", "Bateria"],
            ],
        });

        expect(await new SheetsSource(client, "id").read()).toEqual([
            { nome: "Lia", oficina: null, plano: null },
            { nome: "Theo", oficina: "Bateria", plano: null },
        ]);
    });

    it("lê a aba pelo nome, ignora coluna sem nome e avisa quando a aba não existe", async () => {
        const { client, ranges } = fakeSheets({
            Capa: [["nada"]],
            "D'Ávila": [
                ["nome", "", "cidade"],
                ["Lia", "sobra", "Pelotas"],
            ],
        });

        expect(await new SheetsSource(client, "id", "D'Ávila").read()).toEqual([
            { nome: "Lia", cidade: "Pelotas" },
        ]);
        expect(ranges).toEqual(["'D''Ávila'"]);
        await expect(
            new SheetsSource(client, "id", "Outra").read(),
        ).rejects.toThrow("Abas: Capa, D'Ávila");
    });

    it("aba vazia devolve lista vazia", async () => {
        const { client } = fakeSheets({ Alunos: [] });

        expect(await new SheetsSource(client, "id").read()).toEqual([]);
    });
});
