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

export async function writeData(sheets: sheets_v4.Sheets, spreadsheetId: string, data: TableRow[]) {
  const firstRow = data[0];

  if (!firstRow) {
    console.log("Nenhum dado pra escrever.");
    return;
  }

  const header = Object.keys(firstRow);
  const rows = data.map((row) => header.map((column) => row[column]));

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [header, ...rows],
    },
  });

  console.log(`${data.length} linhas escritas na planilha.`);
}