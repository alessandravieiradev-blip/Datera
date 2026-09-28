import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import {
    PostgresClient,
    PostgresConnection,
    PostgresSource,
} from "../../io/postgres/postgresSource";
import {
    SqlServerConnection,
    SqlServerSource,
} from "../../io/sqlserver/sqlServerSource";
import { SqliteSource } from "../../io/sqlite/sqliteSource";
import { toCell } from "../../io/sql/cell";
import { quoteTable } from "../../io/sql/names";
import { loadDriver } from "../../io/sql/driver";
import { withEnv } from "../../config/load";
import { etlConfigSchema } from "../../config";

const ALUNOS = [
    {
        matricula: "2024-0042",
        nome: "Lia Martins",
        plano: "mensal",
        aulas: 12,
        ativo: true,
        inicio: new Date("2024-03-10T00:00:00.000Z"),
        cidade: null,
    },
];

const LINHA = {
    matricula: "2024-0042",
    nome: "Lia Martins",
    plano: "mensal",
    aulas: 12,
    ativo: "true",
    inicio: "2024-03-10",
    cidade: null,
};

describe("PostgresSource", () => {
    it("lê a tabela inteira, converte os valores e fecha a conexão", async () => {
        const queries: string[] = [];
        let used: PostgresConnection | undefined;
        let ended = false;
        const source = new PostgresSource(
            {
                host: "localhost",
                port: 5432,
                user: "escola",
                database: "musica",
            },
            "public.alunos",
            (connection): PostgresClient => {
                used = connection;
                return {
                    connect: async () => undefined,
                    query: async (text) => {
                        queries.push(text);
                        return { rows: ALUNOS };
                    },
                    end: async () => {
                        ended = true;
                    },
                };
            },
        );

        expect(await source.read()).toEqual([LINHA]);
        expect(queries).toEqual(['SELECT * FROM "public"."alunos"']);
        expect(used?.database).toBe("musica");
        expect(ended).toBe(true);
    });

    it("fecha a conexão mesmo quando a consulta dá erro", async () => {
        let ended = false;
        const source = new PostgresSource(
            {
                host: "localhost",
                port: 5432,
                user: "escola",
                database: "musica",
            },
            "alunos",
            () => ({
                connect: async () => undefined,
                query: async () => {
                    throw new Error('relation "alunos" does not exist');
                },
                end: async () => {
                    ended = true;
                },
            }),
        );

        await expect(source.read()).rejects.toThrow("does not exist");
        expect(ended).toBe(true);
    });
});

describe("SqlServerSource", () => {
    it("lê a tabela com o nome entre colchetes e fecha a conexão", async () => {
        const queries: string[] = [];
        let used: SqlServerConnection | undefined;
        let closed = false;
        const source = new SqlServerSource(
            {
                host: "localhost",
                port: 1433,
                user: "escola",
                database: "musica",
                trustServerCertificate: true,
            },
            "dbo.alunos",
            async (connection) => {
                used = connection;
                return {
                    query: async (text) => {
                        queries.push(text);
                        return ALUNOS;
                    },
                    close: async () => {
                        closed = true;
                    },
                };
            },
        );

        expect(await source.read()).toEqual([LINHA]);
        expect(queries).toEqual(["SELECT * FROM [dbo].[alunos]"]);
        expect(used?.trustServerCertificate).toBe(true);
        expect(closed).toBe(true);
    });
});

function sqliteFile(): string {
    const file = path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), "etl-sqlite-")),
        "escola.db",
    );
    const database = new DatabaseSync(file);
    database.exec(
        "CREATE TABLE alunos (matricula TEXT, nome TEXT, aulas INTEGER, cidade TEXT)",
    );
    database.exec(
        "INSERT INTO alunos VALUES ('2024-0042', 'Lia Martins', 12, 'Pelotas'), ('2024-0051', 'Theo Souza', 8, NULL)",
    );
    database.exec("CREATE TABLE professores (nome TEXT)");
    database.close();
    return file;
}

describe("SqliteSource", () => {
    it("lê a tabela do arquivo", async () => {
        const file = sqliteFile();

        expect(
            await new SqliteSource({ path: file, table: "alunos" }).read(),
        ).toEqual([
            {
                matricula: "2024-0042",
                nome: "Lia Martins",
                aulas: 12,
                cidade: "Pelotas",
            },
            {
                matricula: "2024-0051",
                nome: "Theo Souza",
                aulas: 8,
                cidade: null,
            },
        ]);
    });

    it("diz quais tabelas existem quando a tabela não existe", async () => {
        const file = sqliteFile();

        await expect(
            new SqliteSource({ path: file, table: "aluno" }).read(),
        ).rejects.toThrow("As que existem são: alunos, professores.");
    });

    it("não altera o arquivo", async () => {
        const file = sqliteFile();
        const before = fs.readFileSync(file);

        await new SqliteSource({ path: file, table: "alunos" }).read();

        expect(fs.readFileSync(file).equals(before)).toBe(true);
    });

    it("avisa quando o arquivo não existe", async () => {
        await expect(
            new SqliteSource({ path: "nao-existe.db", table: "alunos" }).read(),
        ).rejects.toThrow("Arquivo não encontrado");
    });
});

describe("valores e nomes", () => {
    it("toCell converte o que vem do banco pro formato das linhas", () => {
        expect(toCell(null)).toBe(null);
        expect(toCell("")).toBe(null);
        expect(toCell(3.5)).toBe(3.5);
        expect(toCell(BigInt(42))).toBe(42);
        expect(toCell(BigInt("9007199254740993"))).toBe("9007199254740993");
        expect(toCell(false)).toBe("false");
        expect(toCell(new Date("2024-03-10T14:30:00.000Z"))).toBe(
            "2024-03-10T14:30:00.000Z",
        );
        expect(toCell({ instrumentos: ["violão"] })).toBe(
            '{"instrumentos":["violão"]}',
        );
    });

    it("quoteTable protege o nome da tabela", () => {
        expect(quoteTable('alunos"; DROP TABLE x; --', '"')).toBe(
            '"alunos""; DROP TABLE x; --"',
        );
        expect(quoteTable("dbo.alu]nos", "[", "]")).toBe("[dbo].[alu]]nos]");
        expect(() => quoteTable("public.", '"')).toThrow("inválido");
    });
});

describe("config dos bancos", () => {
    it("aceita postgres, sqlserver e sqlite", () => {
        for (const source of [
            { type: "postgres", host: "localhost", table: "alunos", ssl: true },
            {
                type: "sqlserver",
                host: "localhost",
                trustServerCertificate: true,
            },
            { type: "sqlite", path: "./escola.db", table: "alunos" },
        ]) {
            const result = etlConfigSchema.safeParse({
                mode: "raw",
                source,
                destination: { type: "csv", path: "./saida.csv" },
            });
            expect(result.success).toBe(true);
        }
    });

    it("sqlite sem tabela não passa", () => {
        const result = etlConfigSchema.safeParse({
            mode: "raw",
            source: { type: "sqlite", path: "./escola.db" },
            destination: { type: "csv", path: "./saida.csv" },
        });

        expect(result.success).toBe(false);
    });

    it("a senha do .env também vale pro postgres e pro sqlserver", () => {
        const before = process.env.DB_PASSWORD;
        process.env.DB_PASSWORD = "segredo";
        try {
            for (const type of ["postgres", "sqlserver"]) {
                const config = withEnv(
                    etlConfigSchema.parse({
                        mode: "raw",
                        source: { type, host: "localhost" },
                        destination: { type: "csv", path: "./saida.csv" },
                    }),
                );
                expect(config.source).toMatchObject({ password: "segredo" });
            }
        } finally {
            if (before === undefined) delete process.env.DB_PASSWORD;
            else process.env.DB_PASSWORD = before;
        }
    });
});

describe("loadDriver", () => {
    it("explica como instalar quando o pacote do banco não está instalado", () => {
        expect(() =>
            loadDriver(
                () => require("pacote-que-nao-existe-no-datera"),
                "pg",
                "PostgreSQL",
            ),
        ).toThrow("npm install pg");
    });
});
