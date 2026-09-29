import { describe, it, expect } from "vitest";
import { dateraVersion, parseCli } from "../cli";

function cli(...args: string[]) {
    return parseCli(["node", "datera", ...args]);
}

describe("parseCli", () => {
    it("sem nada, roda a ./config.json", () => {
        expect(cli()).toEqual({
            command: "run",
            config: "./config.json",
            mode: undefined,
            dryRun: false,
        });
    });

    it("aceita a config direto depois do run", () => {
        expect(cli("run", "./escola/config.json", "--dry-run")).toEqual({
            command: "run",
            config: "./escola/config.json",
            mode: undefined,
            dryRun: true,
        });
    });

    it("aceita a config sem escrever run", () => {
        expect(cli("./escola/config.json", "--mode", "dedupe")).toEqual({
            command: "run",
            config: "./escola/config.json",
            mode: "dedupe",
            dryRun: false,
        });
    });

    it("continua aceitando o --config do jeito antigo", () => {
        expect(cli("--config", "./outra.json")).toMatchObject({
            command: "run",
            config: "./outra.json",
        });
    });

    it("reconhece o validate", () => {
        expect(cli("validate", "./escola/config.json")).toEqual({
            command: "validate",
            config: "./escola/config.json",
        });
    });

    it("lê a versão do package.json", () => {
        expect(/^\d+\.\d+\.\d+/.test(dateraVersion())).toBe(true);
    });
});

describe("parseCli dos comandos novos", () => {
    it("convert com opções de leitura e escrita", () => {
        expect(
            cli(
                "convert",
                "alunos.xml",
                "alunos.parquet",
                "--records-path",
                "escola.alunos.aluno",
            ),
        ).toMatchObject({
            command: "convert",
            input: "alunos.xml",
            output: "alunos.parquet",
            read: { recordsPath: "escola.alunos.aluno" },
        });
    });

    it("dedupe exige --by e aceita normalizador", () => {
        expect(
            cli(
                "dedupe",
                "a.csv",
                "b.csv",
                "--by",
                "email",
                "--normalizer",
                "lowercase",
            ),
        ).toMatchObject({
            command: "dedupe",
            by: "email",
            keep: "first",
            normalizer: "lowercase",
        });
    });

    it("merge junta as listas de colunas", () => {
        expect(
            cli(
                "merge",
                "a.csv",
                "b.xlsx",
                "--key",
                "matricula",
                "--overwrite",
                "plano,cidade",
                "--extra-column",
                "nome",
            ),
        ).toMatchObject({
            command: "merge",
            key: "matricula",
            overwrite: ["plano", "cidade"],
            extraColumn: ["nome"],
        });
    });

    it("preview, columns, init e normalize", () => {
        expect(cli("preview", "a.csv", "-n", "3")).toMatchObject({
            command: "preview",
            rows: 3,
        });
        expect(cli("columns", "a.db", "--table", "alunos")).toMatchObject({
            command: "columns",
            read: { table: "alunos" },
        });
        expect(cli("init", "escola", "--from", "alunos.csv")).toEqual({
            command: "init",
            folder: "escola",
            from: "alunos.csv",
            force: false,
        });
        expect(cli("normalize", "digitsOnly", "2024-0042")).toEqual({
            command: "normalize",
            name: "digitsOnly",
            value: "2024-0042",
        });
    });

    it("run aceita trocar a entrada e a saída", () => {
        expect(
            cli("run", "regras.json", "--input", "a.csv", "--output", "b.xlsx"),
        ).toMatchObject({ input: "a.csv", output: "b.xlsx" });
    });
});
