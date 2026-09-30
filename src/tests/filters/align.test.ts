import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
    alignRows,
    columnKey,
    columnMapping,
    similarColumns,
} from "../../filters/align";
import {
    alignColumns,
    clean,
    convert,
    findSimilarColumns,
    readRows,
} from "../../api";
import { etlConfigSchema } from "../../config";
import { parseCli } from "../../cli";

const MESES = [
    { Matrícula: "2024-0042", "E-mail": "lia@email.com" },
    { matricula: "2024-0051", email: "theo@email.com" },
    { MATRICULA: "2024-0077", "Email do aluno": "duda@email.com" },
];

describe("alinhar colunas", () => {
    it("acha a mesma coluna escrita de jeitos diferentes", () => {
        expect(columnKey("E-mail")).toBe(columnKey(" email "));
        expect(columnKey("Matrícula")).toBe(columnKey("MATRICULA"));
        expect(columnKey("Nome do aluno")).toBe(columnKey("nome_do_aluno"));
        expect(columnKey("#")).toBe("=#");
        expect(
            similarColumns([
                "E-mail",
                "email",
                "nome",
                "Matrícula",
                "matricula",
            ]),
        ).toEqual([
            ["E-mail", "email"],
            ["Matrícula", "matricula"],
        ]);
    });

    it("junta sozinho usando o primeiro nome que apareceu", () => {
        expect(alignRows(MESES.slice(0, 2))).toEqual([
            { Matrícula: "2024-0042", "E-mail": "lia@email.com" },
            { Matrícula: "2024-0051", "E-mail": "theo@email.com" },
        ]);
    });

    it("o rename manda no nome final, e junta com o automático", () => {
        expect(
            alignRows(MESES, { rename: { "email do aluno": "email" } }),
        ).toEqual([
            { Matrícula: "2024-0042", email: "lia@email.com" },
            { Matrícula: "2024-0051", email: "theo@email.com" },
            { Matrícula: "2024-0077", email: "duda@email.com" },
        ]);
    });

    it("sem o automático, só troca o que está no rename", () => {
        expect(
            columnMapping(["E-mail", "Email do aluno"], {
                auto: false,
                rename: { "Email do aluno": "email" },
            }),
        ).toEqual(
            new Map([
                ["E-mail", "E-mail"],
                ["Email do aluno", "email"],
            ]),
        );
    });

    it("quando a mesma linha tem as duas com valores diferentes, não perde nenhum", () => {
        expect(
            alignRows([
                { email: "lia@email.com", "E-mail": "lia.martins@email.com" },
                { email: "", "E-mail": "theo@email.com" },
                { email: "duda@email.com", "E-mail": "duda@email.com" },
            ]),
        ).toEqual([
            { email: "lia@email.com | lia.martins@email.com" },
            { email: "theo@email.com" },
            { email: "duda@email.com" },
        ]);
    });

    it("avisa quando o rename manda a mesma coluna pra dois lugares", () => {
        expect(() =>
            columnMapping(["E-mail"], {
                rename: { "E-mail": "email", email: "contato" },
            }),
        ).toThrow("está no rename duas vezes");
    });

    it("não deixa uma coluna __proto__ sumir", () => {
        const row: Record<string, string> = {};
        Object.defineProperty(row, "__proto__", {
            value: "x",
            enumerable: true,
            writable: true,
            configurable: true,
        });
        row.Email = "lia@email.com";
        row.email = "";
        expect(Object.keys(alignRows([row])[0]!)).toEqual([
            "__proto__",
            "Email",
        ]);
    });
});

describe("alinhar colunas pelo resto do Datera", () => {
    it("vira a primeira etapa do clean, antes das regras", () => {
        const result = clean(MESES, {
            alignColumns: { rename: { "Email do aluno": "email" } },
            validation: { rules: [{ column: "email", rule: "required" }] },
        });

        expect(result.pending).toEqual([]);
        expect(result.steps[0]!.name).toBe("alignColumns");
        expect(alignColumns(MESES.slice(0, 2))[1]).toEqual({
            Matrícula: "2024-0051",
            "E-mail": "theo@email.com",
        });
        expect(findSimilarColumns(MESES)).toHaveLength(2);
    });

    it("a config aceita true ou o objeto com rename", () => {
        for (const alignColumns of [
            true,
            { rename: { "Email do aluno": "email" } },
            { auto: false, rename: { "E-mail": "email" } },
        ]) {
            expect(
                etlConfigSchema.safeParse({
                    mode: "raw",
                    source: { type: "csv", path: "./a.csv" },
                    destination: { type: "csv", path: "./b.csv" },
                    alignColumns,
                }).success,
            ).toBe(true);
        }
        expect(
            etlConfigSchema.safeParse({
                mode: "raw",
                source: { type: "csv", path: "./a.csv" },
                destination: { type: "csv", path: "./b.csv" },
                alignColumns: { rename: { "E-mail": " " } },
            }).success,
        ).toBe(false);
    });

    it("readRows e convert alinham quando pede", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "datera-alinhar-"));
        const file = path.join(dir, "alunos.json");
        fs.writeFileSync(file, JSON.stringify(MESES));

        expect(
            await readRows(file, {
                alignColumns: { rename: { "Email do aluno": "email" } },
            }),
        ).toHaveLength(3);
        await convert(file, path.join(dir, "alunos.csv"), {
            read: { alignColumns: true },
        });
        expect(
            fs
                .readFileSync(path.join(dir, "alunos.csv"), "utf-8")
                .split("\r\n")[0],
        ).toBe("﻿Matrícula,E-mail,Email do aluno");
    });

    it("o terminal aceita --align-columns e --rename repetido", () => {
        expect(
            parseCli([
                "node",
                "datera",
                "preview",
                "matriculas.xlsx",
                "--align-columns",
                "--rename",
                "Email do aluno=email",
                "--rename",
                "Nome completo = nome",
            ]),
        ).toMatchObject({
            read: {
                alignColumns: {
                    auto: true,
                    rename: {
                        "Email do aluno": "email",
                        "Nome completo": "nome",
                    },
                },
            },
        });
        expect(
            parseCli([
                "node",
                "datera",
                "preview",
                "a.csv",
                "--rename",
                "E-mail=email",
            ]),
        ).toMatchObject({
            read: {
                alignColumns: { auto: false, rename: { "E-mail": "email" } },
            },
        });
    });
});
