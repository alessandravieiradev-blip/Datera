import "dotenv/config";
import { writeData, createSheetsClient } from "../src/sheets";
import { requireEnv } from "../src/env";

async function main() {
    try {
        const fakeData = [
            { id: 1, nome: "João Fernando", email: "joaoteste@gmail.com" },
            { id: 2, nome: "Maria Antonia", email: "mariaantonia@gmail.com" },
        ];

        const sheets = createSheetsClient({
            credentialsPath: requireEnv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH"),
            spreadsheetId: requireEnv("GOOGLE_SPREADSHEET_ID"),
            tableName: "",
            dbHost: "",
            dbPort: 0,
            dbUser: "",
            dbPassword: "",
            dbName: "",
            mode: "raw",
            dedupeStrategy: "keep-first",
        });

        const spreadsheetId = requireEnv("GOOGLE_SPREADSHEET_ID");

        await writeData(sheets, spreadsheetId, fakeData);

        console.log("Fluxo do Google Funcionou!");
    } catch (error) {
        console.error("Deu erro: ", error);
    }
}

main();