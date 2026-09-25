import { describe, it, expect } from "vitest";
import { etlConfigSchema, EtlConfig } from "../../config";
import { createSink, createSource } from "../../io/factory";
import { MysqlSource } from "../../io/mysql/mysqlSource";
import { CsvSource } from "../../io/csv/csvSource";
import { JsonSource } from "../../io/json/jsonSource";
import { SheetsSink } from "../../io/sheets/sheetsSink";
import { CsvSink } from "../../io/csv/csvSink";
import { JsonSink } from "../../io/json/jsonSink";
import { ExcelSource } from "../../io/excel/excelSource";
import { ExcelSink } from "../../io/excel/excelSink";

const legacy = {
    mode: "raw",
    tableName: "alunos",
    spreadsheetId: "id",
    credentialsPath: "./credentials.json",
    dbHost: "localhost",
    dbPort: 3306,
    dbUser: "root",
    dbPassword: "senha",
    dbName: "escola",
};

function config(value: object): EtlConfig {
    return etlConfigSchema.parse(value);
}

describe("createSource e createSink", () => {
    it("config antiga continua virando mysql e sheets", () => {
        expect(createSource(config(legacy))).toBeInstanceOf(MysqlSource);
        expect(createSink(config(legacy))).toBeInstanceOf(SheetsSink);
    });

    it("escolhe o adapter pelo type", () => {
        const csv = config({
            mode: "raw",
            source: { type: "csv", path: "a.csv" },
            destination: { type: "json", path: "b.json" },
        });
        const json = config({
            mode: "raw",
            source: { type: "json", path: "a.json" },
            destination: { type: "csv", path: "b.csv" },
        });

        expect(createSource(csv)).toBeInstanceOf(CsvSource);
        expect(createSink(csv)).toBeInstanceOf(JsonSink);
        expect(createSource(json)).toBeInstanceOf(JsonSource);
        expect(createSink(json)).toBeInstanceOf(CsvSink);
    });

    it("escolhe o excel pra ler e escrever", () => {
        const excel = config({
            mode: "raw",
            source: { type: "excel", path: "a.xlsx", sheet: "Alunos" },
            destination: { type: "excel", path: "b.xlsx" },
        });

        expect(createSource(excel)).toBeInstanceOf(ExcelSource);
        expect(createSink(excel)).toBeInstanceOf(ExcelSink);
    });

    it("source mysql pode completar o que falta com os campos antigos", () => {
        const misto = config({
            ...legacy,
            source: { type: "mysql", table: "outra_tabela" },
        });

        expect(createSource(misto)).toBeInstanceOf(MysqlSource);
    });

    it("avisa o que falta quando o mysql não tem tudo", () => {
        const semHost = config({
            mode: "raw",
            source: { type: "mysql", table: "alunos" },
            destination: { type: "csv", path: "b.csv" },
        });

        expect(() => createSource(semHost)).toThrow("host do MySQL");
    });
});

describe("etlConfigSchema com source e destination", () => {
    it("aceita config só com source e destination, sem os campos antigos", () => {
        const result = etlConfigSchema.safeParse({
            mode: "merge",
            source: {
                type: "csv",
                path: "a.csv",
                delimiter: ";",
                encoding: "latin1",
            },
            destination: { type: "csv", path: "b.csv", bom: false },
        });

        expect(result.success).toBe(true);
    });

    it("rejeita type desconhecido e encoding que não existe", () => {
        const tipo = etlConfigSchema.safeParse({
            mode: "raw",
            source: { type: "xml", path: "a" },
            destination: { type: "csv", path: "b" },
        });
        const encoding = etlConfigSchema.safeParse({
            mode: "raw",
            source: { type: "csv", path: "a", encoding: "ascii" },
            destination: { type: "csv", path: "b" },
        });

        expect(tipo.success).toBe(false);
        expect(encoding.success).toBe(false);
    });

    it("rejeita config sem fonte ou sem destino", () => {
        const semFonte = etlConfigSchema.safeParse({
            mode: "raw",
            destination: { type: "csv", path: "b" },
        });
        const semDestino = etlConfigSchema.safeParse({
            mode: "raw",
            source: { type: "csv", path: "a" },
        });

        expect(semFonte.success).toBe(false);
        expect(semDestino.success).toBe(false);
    });
});
