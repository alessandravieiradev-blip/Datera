import { describe, it, expect } from "vitest";
import { sheets_v4 } from "@googleapis/sheets";
import { writeData } from "../../io/sheets/client";

type Call = { method: string; params: any };

function fakeSheets(existingTabs: { title: string; sheetId: number }[]) {
    const calls: Call[] = [];
    let nextId = 100;
    const client = {
        spreadsheets: {
            get: async (params: any) => {
                calls.push({ method: "get", params });
                return {
                    data: {
                        sheets: existingTabs.map((properties) => ({
                            properties,
                        })),
                    },
                };
            },
            batchUpdate: async (params: any) => {
                calls.push({ method: "batchUpdate", params });
                const addSheet = params.requestBody.requests[0].addSheet;
                if (addSheet) {
                    const properties = {
                        title: addSheet.properties.title,
                        sheetId: nextId++,
                    };
                    existingTabs.push(properties);
                    return {
                        data: { replies: [{ addSheet: { properties } }] },
                    };
                }
                return { data: {} };
            },
            values: {
                clear: async (params: any) => {
                    calls.push({ method: "clear", params });
                    return { data: {} };
                },
                update: async (params: any) => {
                    calls.push({ method: "update", params });
                    return { data: {} };
                },
            },
        },
    };
    return { client: client as unknown as sheets_v4.Sheets, calls };
}

const rows = [{ nome: "Lia", email: "lia@email.com" }];

describe("writeData", () => {
    it("sem nome de aba escreve na primeira aba, limpando antes", async () => {
        const { client, calls } = fakeSheets([
            { title: "Clientes", sheetId: 7 },
            { title: "Outra", sheetId: 8 },
        ]);

        await writeData(client, "id", rows);

        expect(calls.map((c) => c.method)).toEqual([
            "get",
            "clear",
            "update",
            "batchUpdate",
        ]);
        expect(calls[1]!.params.range).toBe("'Clientes'");
        expect(calls[2]!.params.range).toBe("'Clientes'!A1");
        expect(calls[2]!.params.requestBody.values).toEqual([
            ["nome", "email"],
            ["Lia", "lia@email.com"],
        ]);
        expect(
            calls[3]!.params.requestBody.requests[0].updateSheetProperties
                .properties.sheetId,
        ).toBe(7);
    });

    it("com nome de aba que já existe, usa ela sem criar outra", async () => {
        const { client, calls } = fakeSheets([
            { title: "Clientes", sheetId: 7 },
            { title: "Pendências", sheetId: 9 },
        ]);

        await writeData(client, "id", rows, { sheetName: "Pendências" });

        expect(calls.filter((c) => c.method === "batchUpdate")).toHaveLength(1);
        expect(calls[1]!.params.range).toBe("'Pendências'");
    });

    it("cria a aba quando ela não existe", async () => {
        const { client, calls } = fakeSheets([
            { title: "Clientes", sheetId: 7 },
        ]);

        await writeData(client, "id", rows, { sheetName: "Pendências" });

        expect(calls[1]!.method).toBe("batchUpdate");
        expect(
            calls[1]!.params.requestBody.requests[0].addSheet.properties.title,
        ).toBe("Pendências");
        expect(calls[2]!.params.range).toBe("'Pendências'");
        expect(
            calls[4]!.params.requestBody.requests[0].updateSheetProperties
                .properties.sheetId,
        ).toBe(100);
    });

    it("sem linhas só limpa a aba, pra não sobrar pendência velha", async () => {
        const { client, calls } = fakeSheets([
            { title: "Clientes", sheetId: 7 },
            { title: "Pendências", sheetId: 9 },
        ]);

        await writeData(client, "id", [], { sheetName: "Pendências" });

        expect(calls.map((c) => c.method)).toEqual(["get", "clear"]);
    });

    it("põe aspas certinhas em nome de aba com apóstrofo", async () => {
        const { client, calls } = fakeSheets([
            { title: "D'Ávila", sheetId: 3 },
        ]);

        await writeData(client, "id", rows, { sheetName: "D'Ávila" });

        expect(calls[1]!.params.range).toBe("'D''Ávila'");
    });
});
