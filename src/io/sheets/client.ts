import { google, sheets_v4 } from "googleapis";
import { TableRow } from "../../types";
import { buildHeader } from "../header";

export function createSheetsClient(credentialsPath: string): sheets_v4.Sheets {
    const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    return google.sheets({ version: "v4", auth });
}

interface TargetSheet {
    title: string;
    sheetId: number;
}

export interface WriteOptions {
    sheetName?: string | undefined;
}

function quoteSheetTitle(title: string): string {
    return `'${title.replace(/'/g, "''")}'`;
}

async function listSheets(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
): Promise<TargetSheet[]> {
    const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties(sheetId,title)",
    });
    const found: TargetSheet[] = [];
    for (const sheet of response.data.sheets ?? []) {
        const { title, sheetId } = sheet.properties ?? {};
        if (title && sheetId !== null && sheetId !== undefined) {
            found.push({ title, sheetId });
        }
    }
    return found;
}

async function resolveSheet(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetName: string | undefined,
): Promise<TargetSheet> {
    const existing = await listSheets(sheets, spreadsheetId);
    const found =
        sheetName === undefined
            ? existing[0]
            : existing.find((sheet) => sheet.title === sheetName);

    if (found) return found;

    if (sheetName === undefined) {
        throw new Error("A planilha não tem nenhuma aba pra escrever.");
    }

    const created = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
    });
    const sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (sheetId === null || sheetId === undefined) {
        throw new Error(`Não consegui criar a aba "${sheetName}".`);
    }

    console.log(`Aba "${sheetName}" criada.`);
    return { title: sheetName, sheetId };
}

export async function readSheet(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetName?: string,
): Promise<unknown[][]> {
    const existing = await listSheets(sheets, spreadsheetId);
    const target =
        sheetName === undefined
            ? existing[0]
            : existing.find((sheet) => sheet.title === sheetName);

    if (!target) {
        const names = existing.map((sheet) => sheet.title).join(", ");
        throw new Error(
            sheetName === undefined
                ? "A planilha não tem nenhuma aba pra ler."
                : `Aba "${sheetName}" não encontrada na planilha. Abas: ${names}`,
        );
    }

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: quoteSheetTitle(target.title),
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "FORMATTED_STRING",
    });
    return response.data.values ?? [];
}

async function formatSheet(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetId: number,
    columnCount: number,
) {
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [
                {
                    updateSheetProperties: {
                        properties: {
                            sheetId,
                            gridProperties: { frozenRowCount: 1 },
                        },
                        fields: "gridProperties.frozenRowCount",
                    },
                },
                {
                    repeatCell: {
                        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                        cell: {
                            userEnteredFormat: {
                                textFormat: { bold: true },
                                backgroundColor: {
                                    red: 0.9,
                                    green: 0.9,
                                    blue: 0.9,
                                },
                            },
                        },
                        fields: "userEnteredFormat(textFormat,backgroundColor)",
                    },
                },
                {
                    autoResizeDimensions: {
                        dimensions: {
                            sheetId,
                            dimension: "COLUMNS",
                            startIndex: 0,
                            endIndex: columnCount,
                        },
                    },
                },
            ],
        },
    });
}

export async function writeData(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    data: TableRow[],
    options: WriteOptions = {},
) {
    const target = await resolveSheet(sheets, spreadsheetId, options.sheetName);
    const range = quoteSheetTitle(target.title);

    await sheets.spreadsheets.values.clear({ spreadsheetId, range });

    if (data.length === 0) {
        console.log(`Nenhum dado pra escrever na aba "${target.title}".`);
        return;
    }

    const header = buildHeader(data);
    const rows = data.map((row) => header.map((column) => row[column] ?? ""));

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${range}!A1`,
        valueInputOption: "RAW",
        requestBody: {
            values: [header, ...rows],
        },
    });

    await formatSheet(sheets, spreadsheetId, target.sheetId, header.length);

    console.log(`${data.length} linhas escritas na aba "${target.title}".`);
}
