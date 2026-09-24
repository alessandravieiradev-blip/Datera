import { google, sheets_v4 } from "googleapis";
import { EtlConfig } from "./config";
import { TableRow } from "./types";

export function createSheetsClient(config: EtlConfig): sheets_v4.Sheets {
  const auth = new google.auth.GoogleAuth({
    keyFile: config.credentialsPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

function buildHeader(data: TableRow[]): string[] {
  const seen = new Set<string>();
  const orderedKeys: string[] = [];

  for (const row of data) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        orderedKeys.push(key);
      }
    }
  }

  const suffixPattern = /^(.+)_(\d+)$/;
  const variantsByBase = new Map<string, number[]>();
  const baseKeys: string[] = [];

for (const key of orderedKeys) {
    const match = key.match(suffixPattern);
    if (match && seen.has(match[1]!)) {
        const base = match[1]!;
        const n = Number(match[2]!);
        if (!variantsByBase.has(base)) variantsByBase.set(base, []);
        variantsByBase.get(base)!.push(n);
    } else {
        baseKeys.push(key);
    }
}

  const header: string[] = [];
  for (const base of baseKeys) {
    header.push(base);
    const variants = variantsByBase.get(base);
    if (variants) {
      variants.sort((a, b) => a - b);
      for (const n of variants) header.push(`${base}_${n}`);
    }
  }

  return header;
}

async function formatSheet(sheets: sheets_v4.Sheets, spreadsheetId: string, columnCount: number) {
  const sheetId = 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
              },
            },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: columnCount },
          },
        },
      ],
    },
  });
}

export async function writeData(sheets: sheets_v4.Sheets, spreadsheetId: string, data: TableRow[]) {
  if (data.length === 0) {
    console.log("Nenhum dado pra escrever.");
    return;
  }

  const header = buildHeader(data);
  const rows = data.map((row) => header.map((column) => row[column] ?? ""));

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [header, ...rows],
    },
  });

  await formatSheet(sheets, spreadsheetId, header.length);

  console.log(`${data.length} linhas escritas na planilha.`);
}
