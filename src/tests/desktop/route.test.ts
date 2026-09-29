import { describe, it, expect } from "vitest";
import path from "path";
import { etlConfigSchema } from "../../config";
import { describeRoute, routeKey } from "../../../apps/desktop/src/main/route";

const PASTA = path.resolve("escola");

function rota(value: object) {
    return describeRoute(etlConfigSchema.parse(value), PASTA);
}

function chave(value: object) {
    const config = etlConfigSchema.parse(value);
    return routeKey(describeRoute(config, PASTA), config);
}

describe("confirmação de para onde os dados vão", () => {
    it("mostra o arquivo de onde lê e o servidor onde grava, sem a senha", () => {
        const route = rota({
            mode: "raw",
            source: { type: "csv", path: "./alunos.csv" },
            destination: {
                type: "postgres",
                host: "relatorios.escola",
                user: "escola",
                password: "segredo",
                database: "musica",
                table: "alunos_organizados",
            },
        });

        expect(route.source).toBe(
            `Arquivo CSV ${path.join(PASTA, "alunos.csv")}`,
        );
        expect(route.destination).toBe(
            "Banco PostgreSQL no servidor relatorios.escola:5432, banco musica, tabela alunos_organizados",
        );
        expect(JSON.stringify(route).includes("segredo")).toBe(false);
    });

    it("muda a chave quando o destino muda, mas não quando só as regras mudam", () => {
        const base = {
            mode: "raw",
            source: { type: "csv", path: "./alunos.csv" },
            destination: { type: "excel", path: "./saida/alunos.xlsx" },
        };
        const mesmaRota = chave({
            ...base,
            mode: "dedupe",
            dedupeColumn: "email",
        });
        const outroDestino = chave({
            ...base,
            destination: {
                type: "sheets",
                spreadsheetId: "ID_DE_OUTRA_PESSOA",
            },
        });

        expect(mesmaRota).toBe(chave(base));
        expect(outroDestino === mesmaRota).toBe(false);
    });

    it("muda a chave quando só a aba de pendências muda, e esconde caractere invisível", () => {
        const base = {
            mode: "raw",
            source: { type: "csv", path: "./alunos.csv" },
            destination: { type: "sheets", spreadsheetId: "ID" },
            validation: { rules: [{ column: "email", rule: "required" }] },
        };
        const outraAba = {
            ...base,
            validation: { ...base.validation, pendingSheet: "Financeiro" },
        };
        expect(chave(base) === chave(outraAba)).toBe(false);

        const disfarce = rota({
            ...base,
            destination: {
                type: "sheets",
                spreadsheetId: "ID\n\nGrava em:\u202eX",
            },
        });
        expect(/[\n\u202e]/.test(disfarce.destination)).toBe(false);
    });
});
