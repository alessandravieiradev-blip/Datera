import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { checkConfigFile, checkConfigText, formatCheck } from "../../config";
import { parseCli } from "../../cli";

const EXAMPLES = path.resolve(__dirname, "../../../examples");

function tempFolder(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "datera-check-"));
}

describe("checkConfigFile", () => {
    it("aceita a config de exemplo", () => {
        const check = checkConfigFile(path.join(EXAMPLES, "config.csv.json"));
        expect(check.problems).toEqual([]);
        expect(check.ok).toBe(true);
    });

    it("avisa quando o arquivo da config não existe", () => {
        const check = checkConfigFile(path.join(tempFolder(), "nada.json"));
        expect(check.ok).toBe(false);
        expect(check.problems[0]?.message).toContain("Arquivo não encontrado");
    });
});

describe("checkConfigText", () => {
    it("mostra onde o JSON quebrou", () => {
        const check = checkConfigText('{ "mode": "raw", }', tempFolder());
        expect(check.ok).toBe(false);
        expect(check.problems[0]?.message).toContain("JSON inválido");
    });

    it("explica em português o que está errado e onde", () => {
        const text = JSON.stringify({
            source: { type: "csv" },
            destination: { type: "csv", path: "./saida/resultado.csv" },
            mode: "junta",
        });
        const check = checkConfigText(text, tempFolder());
        expect(check.ok).toBe(false);
        const source = check.problems.find((problem) =>
            problem.where.startsWith("source"),
        );
        expect(source?.message).toContain("obrigatório");
        const mode = check.problems.find((problem) => problem.where === "mode");
        expect(mode?.message).toContain("Use um destes");
    });

    it("confere se os arquivos citados existem, contando da pasta da config", () => {
        const folder = tempFolder();
        fs.writeFileSync(path.join(folder, "alunos.csv"), "matricula\n");
        const text = JSON.stringify({
            source: { type: "csv", path: "./alunos.csv" },
            destination: { type: "csv", path: "./saida/resultado.csv" },
            mode: "raw",
            normalizerModules: ["./normalizadores.cjs"],
        });
        const check = checkConfigText(text, folder);
        expect(check.problems).toEqual([
            {
                where: "normalizerModules[0]",
                message: "Arquivo não encontrado: ./normalizadores.cjs",
            },
        ]);
    });
});

describe("formatCheck", () => {
    it("resume em uma linha quando está tudo certo", () => {
        expect(formatCheck("config.json", { ok: true, problems: [] })).toEqual([
            "config.json: configuração válida.",
        ]);
    });

    it("lista cada problema com o lugar", () => {
        const lines = formatCheck("config.json", {
            ok: false,
            problems: [
                { where: "mode", message: "Valor não aceito." },
                { where: "", message: "JSON inválido: fim inesperado" },
            ],
        });
        expect(lines).toEqual([
            "config.json: 2 problemas.",
            "  mode: Valor não aceito.",
            "  JSON inválido: fim inesperado",
        ]);
    });
});

describe("parseCli validate", () => {
    it("reconhece o comando validate com o caminho", () => {
        expect(
            parseCli(["node", "main.ts", "validate", "./escola/config.json"]),
        ).toEqual({
            command: "validate",
            config: "./escola/config.json",
        });
    });

    it("usa ./config.json quando o caminho não vem", () => {
        expect(parseCli(["node", "main.ts", "validate"])).toEqual({
            command: "validate",
            config: "./config.json",
        });
    });
});
