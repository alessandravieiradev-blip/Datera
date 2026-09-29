import "dotenv/config";
import { writeData, createSheetsClient } from "../src/io/sheets/client";

function variavel(nome: string): string {
    const valor = process.env[nome];
    if (!valor) throw new Error(`Falta a variável ${nome} no .env`);
    return valor;
}

async function main() {
    try {
        const alunos = [
            {
                matricula: "2024-0042",
                nome: "Lia Martins",
                email: "lia@email.com",
                instrumento: "violão",
            },
            {
                matricula: "2024-0051",
                nome: "Theo Souza",
                email: "theo@email.com",
                instrumento: "bateria",
            },
        ];

        const sheets = createSheetsClient(
            variavel("GOOGLE_SERVICE_ACCOUNT_KEY_PATH"),
        );

        await writeData(sheets, variavel("GOOGLE_SPREADSHEET_ID"), alunos);

        console.log("Escrevi duas linhas de teste na planilha.");
    } catch (error) {
        console.error("Deu erro: ", error);
    }
}

main();
