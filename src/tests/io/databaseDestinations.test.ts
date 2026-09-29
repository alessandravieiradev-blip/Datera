import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { etlConfigSchema, EtlConfig } from "../../config";
import { withEnv } from "../../config/load";
import { checkConfigText } from "../../config/check";
import { createSink } from "../../io/factory";
import { serverOf } from "../../io/servers";
import { tableProblem } from "../../io/safety";
import { SqliteSink } from "../../io/sqlite/sqliteSink";
import { PostgresSink } from "../../io/postgres/postgresSink";
import { SqlServerSink } from "../../io/sqlserver/sqlServerSink";
import { MysqlSink } from "../../io/mysql/mysqlSink";
import { convert, readRows, writeRows } from "../../api";
import { parseCli } from "../../cli";

function config(value: object): EtlConfig {
    return etlConfigSchema.parse(value);
}

const CSV = { type: "csv", path: "./alunos.csv" };

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "datera-destino-"));
}

describe("destino em banco", () => {
    it("a config aceita os quatro bancos como destino", () => {
        expect(
            createSink(
                config({
                    mode: "raw",
                    source: CSV,
                    destination: {
                        type: "sqlite",
                        path: "./escola.db",
                        table: "alunos",
                    },
                }),
            ),
        ).toBeInstanceOf(SqliteSink);

        const servidor = {
            host: "localhost",
            user: "escola",
            database: "musica",
            table: "alunos_limpos",
        };
        for (const [type, Sink] of [
            ["mysql", MysqlSink],
            ["postgres", PostgresSink],
            ["sqlserver", SqlServerSink],
        ] as const) {
            expect(
                createSink(
                    config({
                        mode: "raw",
                        source: CSV,
                        destination: { type, ...servidor },
                    }),
                ),
            ).toBeInstanceOf(Sink);
        }
    });

    it("SQLite como destino precisa da tabela", () => {
        expect(
            etlConfigSchema.safeParse({
                mode: "raw",
                source: CSV,
                destination: { type: "sqlite", path: "./escola.db" },
            }).success,
        ).toBe(false);
    });

    it("avisa o que falta pra gravar no banco", () => {
        expect(() =>
            createSink(
                config({
                    mode: "raw",
                    source: CSV,
                    destination: { type: "postgres", host: "localhost" },
                }),
            ),
        ).toThrow("o usuário do PostgreSQL de destino");
    });

    it("no mesmo servidor da fonte, completa com os dados da fonte", () => {
        const mesmoServidor = config({
            mode: "raw",
            source: {
                type: "postgres",
                host: "banco.escola",
                port: 5433,
                user: "escola",
                password: "segredo",
                database: "musica",
                table: "alunos",
            },
            destination: { type: "postgres", table: "alunos_limpos" },
        });

        expect(serverOf(mesmoServidor, "destination")).toEqual({
            type: "postgres",
            host: "banco.escola",
            port: 5433,
            user: "escola",
            password: "segredo",
            database: "musica",
            table: "alunos_limpos",
        });
    });

    it("a senha e o servidor do destino vêm do .env com DEST_DB_", () => {
        const keys = ["DEST_DB_PASSWORD", "DEST_DB_HOST", "DEST_DB_TABLE"];
        const before = keys.map((key) => process.env[key]);
        process.env.DEST_DB_PASSWORD = "segredo";
        process.env.DEST_DB_HOST = "relatorios.escola";
        process.env.DEST_DB_TABLE = "alunos_limpos";
        try {
            const final = withEnv(
                config({
                    mode: "raw",
                    source: CSV,
                    destination: { type: "mysql", user: "escola" },
                }),
            );
            expect(final.destination).toMatchObject({
                host: "relatorios.escola",
                password: "segredo",
                table: "alunos_limpos",
            });
        } finally {
            keys.forEach((key, index) => {
                const value = before[index];
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            });
        }
    });
});

describe("proteção das tabelas", () => {
    it("não grava na tabela de onde lê, nem com as pendências", () => {
        const fonte = {
            type: "mysql",
            host: "localhost",
            user: "escola",
            database: "musica",
            table: "alunos",
        };
        expect(
            tableProblem(
                config({
                    mode: "raw",
                    source: fonte,
                    destination: { type: "mysql", table: "Alunos" },
                }),
            ),
        ).toContain('A tabela "alunos" é de onde o Datera lê');
        expect(
            tableProblem(
                config({
                    mode: "raw",
                    source: fonte,
                    destination: {
                        type: "mysql",
                        table: "alunos_limpos",
                        pendingTable: "alunos",
                    },
                    validation: {
                        rules: [{ column: "email", rule: "required" }],
                    },
                }),
            ),
        ).toContain("é de onde o Datera lê");
        expect(
            tableProblem(
                config({
                    mode: "raw",
                    source: fonte,
                    destination: {
                        type: "mysql",
                        host: "outro.servidor",
                        table: "alunos",
                    },
                }),
            ),
        ).toBeNull();
    });

    it("pendências e resultado precisam de nomes diferentes", () => {
        expect(
            tableProblem(
                config({
                    mode: "raw",
                    source: CSV,
                    destination: {
                        type: "sqlite",
                        path: "./escola.db",
                        table: "alunos",
                        pendingTable: "ALUNOS",
                    },
                    validation: {
                        rules: [{ column: "email", rule: "required" }],
                    },
                }),
            ),
        ).toContain("nome diferente");
    });

    it("não deixa usar o nome da tabela onde ele anota o que criou", () => {
        expect(
            tableProblem(
                config({
                    mode: "raw",
                    source: CSV,
                    destination: {
                        type: "sqlite",
                        path: "./escola.db",
                        table: "datera_tabelas",
                    },
                }),
            ),
        ).toContain("datera_tabelas");
    });

    it("o validate também mostra o problema", () => {
        const check = checkConfigText(
            JSON.stringify({
                mode: "raw",
                source: {
                    type: "sqlite",
                    path: "./escola.db",
                    table: "alunos",
                },
                destination: {
                    type: "sqlite",
                    path: "./escola.db",
                    table: "alunos",
                },
            }),
            tempDir(),
        );
        expect(
            check.problems.some(
                (problem) =>
                    problem.where === "destination.table" &&
                    problem.message.includes("é de onde o Datera lê"),
            ),
        ).toBe(true);
    });
});

describe("API e terminal", () => {
    it("writeRows grava no .db com a tabela dados e as pendências do lado", async () => {
        const file = path.join(tempDir(), "escola.db");

        await writeRows([{ nome: "Lia Martins" }], file, {
            pending: [{ Motivo: "sem matrícula", nome: "Caio Lima" }],
        });

        expect(await readRows(file, { table: "dados" })).toEqual([
            { nome: "Lia Martins" },
        ]);
        expect(await readRows(file, { table: "dados_pendencias" })).toEqual([
            { Motivo: "sem matrícula", nome: "Caio Lima" },
        ]);
    });

    it("convert copia de uma tabela pra outra no mesmo .db, mas não pra ela mesma", async () => {
        const file = path.join(tempDir(), "escola.db");
        const database = new DatabaseSync(file);
        database.exec("CREATE TABLE alunos (nome TEXT, aulas INTEGER)");
        database.exec("INSERT INTO alunos VALUES ('Lia Martins', 12)");
        database.close();

        expect(
            await convert(file, file, {
                read: { table: "alunos" },
                write: { table: "alunos_copia" },
            }),
        ).toBe(1);
        expect(await readRows(file, { table: "alunos_copia" })).toEqual([
            { nome: "Lia Martins", aulas: 12 },
        ]);
        await expect(
            convert(file, file, {
                read: { table: "alunos" },
                write: { table: "alunos" },
            }),
        ).rejects.toThrow("é de onde o Datera lê");
    });

    it("o terminal aceita --output-table", () => {
        expect(
            parseCli([
                "node",
                "datera",
                "convert",
                "alunos.csv",
                "escola.db",
                "--output-table",
                "alunos",
            ]),
        ).toMatchObject({
            command: "convert",
            write: { table: "alunos" },
        });
    });
});

describe("nome comprido", () => {
    it("avisa antes de gravar se o nome das pendências passar do limite", () => {
        expect(
            tableProblem(
                config({
                    mode: "raw",
                    source: CSV,
                    destination: {
                        type: "postgres",
                        host: "localhost",
                        user: "escola",
                        database: "musica",
                        table: "alunos_da_escola_de_musica_organizados_por_instrumento",
                    },
                    validation: {
                        rules: [{ column: "email", rule: "required" }],
                    },
                }),
            ),
        ).toContain("comprido demais");
    });
});

describe("segurança das conexões", () => {
    it("não manda a senha da fonte pra outro servidor", () => {
        const fonte = {
            type: "postgres",
            host: "banco.escola",
            user: "escola",
            password: "segredo",
            database: "musica",
            table: "alunos",
        };
        const outroServidor = serverOf(
            config({
                mode: "raw",
                source: fonte,
                destination: {
                    type: "postgres",
                    host: "servidor.de.outra.pessoa",
                    table: "copia",
                },
            }),
            "destination",
        );
        const outraPorta = serverOf(
            config({
                mode: "raw",
                source: fonte,
                destination: { type: "postgres", port: 6543, table: "copia" },
            }),
            "destination",
        );
        const mesmoServidor = serverOf(
            config({
                mode: "raw",
                source: fonte,
                destination: {
                    type: "postgres",
                    host: "BANCO.escola",
                    table: "copia",
                },
            }),
            "destination",
        );

        expect(outroServidor?.password).toBeUndefined();
        expect(outroServidor?.user).toBeUndefined();
        expect(outraPorta?.password).toBeUndefined();
        expect(mesmoServidor?.password).toBe("segredo");
    });
});

describe("nomes reservados", () => {
    it("não aceita datera_tabelas nem os nomes temporários, mesmo com schema", () => {
        for (const table of [
            "outro.datera_tabelas",
            "alunos__datera_novo",
            "relatorios.alunos__DATERA_VELHO",
        ]) {
            expect(
                tableProblem(
                    config({
                        mode: "raw",
                        source: CSV,
                        destination: {
                            type: "mysql",
                            host: "localhost",
                            user: "escola",
                            database: "musica",
                            table,
                        },
                    }),
                ),
            ).toContain("usados pelo próprio Datera");
        }
    });
});
