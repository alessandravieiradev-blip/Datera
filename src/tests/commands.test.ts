import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runCommand } from "../commands";
import { createMemoryLogger } from "../logger";

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "etl-cmd-"));
}

function alunos(dir: string): string {
    const file = path.join(dir, "alunos.csv");
    fs.writeFileSync(
        file,
        "matricula;email\n2024-0042;lia@email.com\n20240042; LIA@email.com\n2024-0051;theo@email.com\n",
    );
    return file;
}

describe("runCommand", () => {
    it("init cria a config a partir do arquivo e não troca a que já existe", async () => {
        const dir = tempDir();
        const file = alunos(dir);
        const logger = createMemoryLogger();

        expect(
            await runCommand(
                { command: "init", folder: dir, from: file, force: false },
                logger,
            ),
        ).toBe(0);
        const config = JSON.parse(
            fs.readFileSync(path.join(dir, "config.json"), "utf-8"),
        );
        expect(config.source).toEqual({ type: "csv", path: "./alunos.csv" });
        expect(config.destination).toEqual({
            type: "csv",
            path: "./saida/resultado.csv",
        });

        expect(
            await runCommand(
                { command: "init", folder: dir, force: false },
                logger,
            ),
        ).toBe(1);
    });

    it("dedupe e merge gravam e contam o que fizeram", async () => {
        const dir = tempDir();
        const input = alunos(dir);
        const logger = createMemoryLogger();

        await runCommand(
            {
                command: "dedupe",
                input,
                output: path.join(dir, "sem.json"),
                by: "email",
                keep: "first",
                normalizer: "lowercase",
                read: {},
                write: {},
            },
            logger,
        );
        await runCommand(
            {
                command: "merge",
                input,
                output: path.join(dir, "juntos.json"),
                key: "matricula",
                normalizer: "digitsOnly",
                overwrite: ["email"],
                extraColumn: [],
                read: {},
                write: {},
            },
            logger,
        );

        expect(
            JSON.parse(fs.readFileSync(path.join(dir, "sem.json"), "utf-8")),
        ).toHaveLength(2);
        expect(
            JSON.parse(fs.readFileSync(path.join(dir, "juntos.json"), "utf-8")),
        ).toEqual([
            { matricula: "2024-0042", email: " LIA@email.com" },
            { matricula: "2024-0051", email: "theo@email.com" },
        ]);
        expect(logger.messages.join("\n")).toContain("1 repetida tirada");
        expect(logger.messages.join("\n")).toContain("juntadas em 2 registros");
    });

    it("run avisa quando a config não existe", async () => {
        await expect(
            runCommand(
                {
                    command: "run",
                    config: "convrt",
                    dryRun: false,
                },
                createMemoryLogger(),
            ),
        ).rejects.toThrow('veja a lista com "datera --help"');
    });
});

describe("cuidados com arquivos", () => {
    it("dedupe e merge não gravam por cima da entrada", async () => {
        const dir = tempDir();
        const input = alunos(dir);
        const before = fs.readFileSync(input, "utf-8");

        for (const command of ["dedupe", "merge"] as const) {
            await expect(
                runCommand(
                    command === "dedupe"
                        ? {
                              command,
                              input,
                              output: input,
                              by: "email",
                              keep: "first",
                              read: {},
                              write: {},
                          }
                        : {
                              command,
                              input,
                              output: input,
                              key: "matricula",
                              overwrite: [],
                              extraColumn: [],
                              read: {},
                              write: {},
                          },
                    createMemoryLogger(),
                ),
            ).rejects.toThrow("mesmo arquivo");
        }
        expect(fs.readFileSync(input, "utf-8")).toBe(before);
    });

    it("pega o mesmo arquivo escrito por outro caminho", async () => {
        const dir = tempDir();
        const input = alunos(dir);
        const other = path.join(
            dir,
            "..",
            path.basename(dir),
            ".",
            "alunos.csv",
        );

        await expect(
            runCommand(
                {
                    command: "convert",
                    input,
                    output: other,
                    read: {},
                    write: {},
                },
                createMemoryLogger(),
            ),
        ).rejects.toThrow("o mesmo arquivo");
    });
});
