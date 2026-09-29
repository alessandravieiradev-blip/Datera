import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { SqliteSink } from "../../io/sqlite/sqliteSink";
import { SqliteSource } from "../../io/sqlite/sqliteSource";
import {
    checkColumns,
    columnKind,
    SqlSession,
    SqlValue,
    writeTable,
} from "../../io/sql/writer";
import { POSTGRES_DIALECT } from "../../io/postgres/postgresSink";
import { SQLSERVER_DIALECT } from "../../io/sqlserver/sqlServerSink";
import { MysqlSink, MYSQL_DIALECT } from "../../io/mysql/mysqlSink";
import { silentLogger } from "../../logger";
import { TableRow } from "../../types";

const ALUNOS: TableRow[] = [
    {
        matricula: "2024-0042",
        nome: "Lia Martins",
        aulas: 12,
        mensalidade: 180.5,
        cidade: "Pelotas",
    },
    {
        matricula: "2024-0051",
        nome: "Theo Souza",
        aulas: 8,
        mensalidade: 150,
        cidade: null,
    },
];

const PENDENCIAS: TableRow[] = [
    { Motivo: "sem matrícula", matricula: null, nome: "Caio Lima" },
];

function tempDb(): string {
    return path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), "datera-db-")),
        "saida",
        "escola.db",
    );
}

function columnsOf(file: string, table: string): Record<string, string> {
    const database = new DatabaseSync(file, { readOnly: true });
    try {
        const info = database
            .prepare(`PRAGMA table_info("${table}")`)
            .all() as { name: string; type: string }[];
        return Object.fromEntries(info.map((item) => [item.name, item.type]));
    } finally {
        database.close();
    }
}

function tablesOf(file: string): string[] {
    const database = new DatabaseSync(file, { readOnly: true });
    try {
        return database
            .prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
            )
            .all()
            .map((row) => String(row.name));
    } finally {
        database.close();
    }
}

describe("SqliteSink", () => {
    it("cria a tabela com os tipos certos e grava o resultado", async () => {
        const file = tempDb();
        const sink = new SqliteSink(
            { path: file, table: "alunos" },
            silentLogger,
        );

        await sink.write(ALUNOS);

        expect(columnsOf(file, "alunos")).toEqual({
            matricula: "TEXT",
            nome: "TEXT",
            aulas: "INTEGER",
            mensalidade: "REAL",
            cidade: "TEXT",
        });
        expect(
            await new SqliteSource({ path: file, table: "alunos" }).read(),
        ).toEqual(ALUNOS);
    });

    it("as pendências vão pra outra tabela, com _pendencias no nome", async () => {
        const file = tempDb();
        const sink = new SqliteSink(
            { path: file, table: "alunos" },
            silentLogger,
        );

        await sink.write(ALUNOS);
        await sink.write(PENDENCIAS, { name: "Pendências" });

        expect(tablesOf(file)).toEqual([
            "alunos",
            "alunos_pendencias",
            "datera_tabelas",
        ]);
        expect(
            await new SqliteSource({
                path: file,
                table: "alunos_pendencias",
            }).read(),
        ).toEqual(PENDENCIAS);
    });

    it("usa o nome do pendingTable quando ele existe", async () => {
        const file = tempDb();
        const sink = new SqliteSink(
            { path: file, table: "alunos", pendingTable: "revisar" },
            silentLogger,
        );

        await sink.write(PENDENCIAS, { name: "Pendências" });

        expect(tablesOf(file)).toContain("revisar");
    });

    it("rodar de novo troca as linhas em vez de repetir", async () => {
        const file = tempDb();
        const sink = new SqliteSink(
            { path: file, table: "alunos" },
            silentLogger,
        );

        await sink.write(ALUNOS);
        await sink.write([{ matricula: "2024-0077", nome: "Duda Alves" }]);

        expect(
            await new SqliteSource({ path: file, table: "alunos" }).read(),
        ).toEqual([{ matricula: "2024-0077", nome: "Duda Alves" }]);
    });

    it("não mexe em tabela que não foi o Datera que criou", async () => {
        const file = tempDb();
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const database = new DatabaseSync(file);
        database.exec("CREATE TABLE Alunos (nome TEXT)");
        database.exec("INSERT INTO Alunos VALUES ('Lia')");
        database.close();

        await expect(
            new SqliteSink({ path: file, table: "alunos" }, silentLogger).write(
                ALUNOS,
            ),
        ).rejects.toThrow("não foi o Datera que criou");
        expect(
            await new SqliteSource({ path: file, table: "Alunos" }).read(),
        ).toEqual([{ nome: "Lia" }]);
    });

    it("sem linhas não cria tabela, e esvazia a que ele criou antes", async () => {
        const file = tempDb();
        const sink = new SqliteSink(
            { path: file, table: "alunos" },
            silentLogger,
        );

        await sink.write([], { name: "Pendências" });
        expect(tablesOf(file)).toEqual(["datera_tabelas"]);

        await sink.write(PENDENCIAS, { name: "Pendências" });
        await sink.write([], { name: "Pendências" });
        expect(
            await new SqliteSource({
                path: file,
                table: "alunos_pendencias",
            }).read(),
        ).toEqual([]);
    });
});

describe("colunas", () => {
    it("descobre o tipo de cada coluna", () => {
        expect(columnKind(ALUNOS, "aulas")).toBe("integer");
        expect(columnKind(ALUNOS, "mensalidade")).toBe("number");
        expect(columnKind(ALUNOS, "cidade")).toBe("text");
        expect(columnKind([{ a: null }, { a: "" }], "a")).toBe("text");
        expect(columnKind([{ a: 1 }, { a: "2" }], "a")).toBe("text");
    });

    it("recusa coluna sem nome, repetida nas maiúsculas ou comprida demais", () => {
        expect(() => checkColumns(POSTGRES_DIALECT, [""])).toThrow(
            "coluna sem nome",
        );
        expect(() =>
            checkColumns(POSTGRES_DIALECT, ["Email", "email"]),
        ).toThrow("só mudam nas maiúsculas");
        expect(() =>
            checkColumns(POSTGRES_DIALECT, ["instrumento".repeat(6)]),
        ).toThrow("até 63 caracteres");
    });
});

interface Call {
    sql: string;
    params: SqlValue[];
}

function fakeSession(existing: string[], owned: string[] = existing) {
    const calls: Call[] = [];
    const tables = new Set(existing);
    const clean = (name: SqlValue | undefined) =>
        String(name ?? "").replace(/[[\]"`]/g, "");
    const session: SqlSession = {
        run: async (sql, params = []) => {
            calls.push({ sql, params });
            const created = sql.match(/^CREATE TABLE (\S+) \(/);
            if (created) tables.add(clean(created[1]));
            if (sql.includes("INSERT INTO") && sql.includes("quebra")) {
                throw new Error("falhou no meio");
            }
        },
        all: async (sql, params = []) => {
            calls.push({ sql, params });
            const id = (name: SqlValue | undefined) => `datera:${clean(name)}`;
            if (sql.includes("TABLE_COMMENT")) {
                return [
                    { id: tables.has(clean(params[1])) ? id(params[1]) : null },
                ];
            }
            if (sql.includes("information_schema")) {
                return [{ total: tables.has(clean(params[1])) ? 1 : 0 }];
            }
            if (sql.includes("relowner")) return [{ dono: true }];
            if (sql.includes("::oid") || sql.includes("OBJECT_ID(@p1, 'U')")) {
                return [
                    { id: tables.has(clean(params[0])) ? id(params[0]) : null },
                ];
            }
            if (sql.includes("to_regclass")) {
                return [{ nome: tables.has(clean(params[0])) ? "x" : null }];
            }
            if (sql.includes("OBJECT_ID")) {
                return [{ id: tables.has(clean(params[0])) ? 1 : null }];
            }
            return owned.includes(String(params[0]))
                ? [{ identificador: id(params[0]) }]
                : [];
        },
        begin: async () => {
            calls.push({ sql: "BEGIN", params: [] });
        },
        commit: async () => {
            calls.push({ sql: "COMMIT", params: [] });
        },
        rollback: async () => {
            calls.push({ sql: "ROLLBACK", params: [] });
        },
    };
    return { session, calls, sqls: () => calls.map((call) => call.sql) };
}

describe("PostgreSQL", () => {
    it("troca a tabela inteira dentro de uma transação", async () => {
        const fake = fakeSession(["datera_tabelas", "public.alunos"]);

        await writeTable(
            fake.session,
            POSTGRES_DIALECT,
            "public.alunos",
            ALUNOS,
            silentLogger,
        );

        const sqls = fake.sqls();
        expect(sqls[0]).toBe("BEGIN");
        expect(sqls[sqls.length - 1]).toBe("COMMIT");
        expect(sqls).toContain('DROP TABLE "public"."alunos"');
        expect(sqls).toContain(
            'CREATE TABLE "public"."alunos" ("matricula" TEXT, "nome" TEXT, "aulas" BIGINT, "mensalidade" DOUBLE PRECISION, "cidade" TEXT)',
        );
        const insert = fake.calls.find((call) =>
            call.sql.startsWith('INSERT INTO "public"."alunos"'),
        )!;
        expect(insert.sql).toContain(
            "($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)",
        );
        expect(insert.params).toEqual([
            "2024-0042",
            "Lia Martins",
            12,
            180.5,
            "Pelotas",
            "2024-0051",
            "Theo Souza",
            8,
            150,
            null,
        ]);
    });

    it("desfaz tudo se der erro no meio", async () => {
        const fake = fakeSession(["datera_tabelas"]);

        await expect(
            writeTable(
                fake.session,
                POSTGRES_DIALECT,
                "quebra",
                ALUNOS,
                silentLogger,
            ),
        ).rejects.toThrow("falhou no meio");

        const sqls = fake.sqls();
        expect(sqls[sqls.length - 1]).toBe("ROLLBACK");
        expect(sqls).not.toContain("COMMIT");
    });

    it("recusa tabela que já existe e não é dele", async () => {
        const fake = fakeSession(["datera_tabelas", "alunos"], []);

        await expect(
            writeTable(
                fake.session,
                POSTGRES_DIALECT,
                "alunos",
                ALUNOS,
                silentLogger,
            ),
        ).rejects.toThrow("não foi o Datera que criou");
        expect(fake.sqls().some((sql) => sql.startsWith("DROP"))).toBe(false);
    });
});

describe("SQL Server", () => {
    it("usa colchetes, @p e divide as linhas pra caber no limite de parâmetros", async () => {
        const fake = fakeSession([]);
        const rows = Array.from({ length: 450 }, (_, index) => ({
            matricula: `2024-${index}`,
            nome: "Aluno",
            aulas: index,
            cidade: "Pelotas",
            plano: "mensal",
        }));

        await writeTable(
            fake.session,
            SQLSERVER_DIALECT,
            "dbo.alunos",
            rows,
            silentLogger,
        );

        const inserts = fake.calls.filter((call) =>
            call.sql.startsWith("INSERT INTO [dbo].[alunos]"),
        );
        expect(inserts).toHaveLength(2);
        expect(inserts[0]!.params).toHaveLength(2000);
        expect(inserts[0]!.sql).toContain("(@p1, @p2, @p3, @p4, @p5)");
        expect(fake.sqls()).toContain(
            "CREATE TABLE [datera_tabelas] ([tabela] NVARCHAR(450) COLLATE Latin1_General_BIN2 PRIMARY KEY, [identificador] NVARCHAR(MAX), [atualizada_em] NVARCHAR(MAX))",
        );
    });
});

describe("MySQL", () => {
    it("grava numa tabela nova e troca de nome no fim, porque o MySQL não desfaz CREATE", async () => {
        const fake = fakeSession(["datera_tabelas", "alunos"]);

        await writeTable(
            fake.session,
            MYSQL_DIALECT,
            "alunos",
            ALUNOS,
            silentLogger,
        );

        const sqls = fake.sqls();
        const create = sqls.findIndex((sql) =>
            sql.startsWith("CREATE TABLE `alunos__datera_novo`"),
        );
        const rename = sqls.indexOf(
            "RENAME TABLE `alunos` TO `alunos__datera_velho`, `alunos__datera_novo` TO `alunos`",
        );
        expect(create >= 0).toBe(true);
        expect(rename > create).toBe(true);
        expect(sqls[create]).toContain("DEFAULT CHARSET=utf8mb4");
        expect(sqls.slice(create, rename)).toContain("COMMIT");
        expect(sqls).not.toContain("DROP TABLE `alunos`");
    });

    it("fecha a conexão mesmo quando dá erro", async () => {
        let closed = false;
        const fake = fakeSession(["datera_tabelas", "alunos"], []);
        const sink = new MysqlSink(
            {
                host: "localhost",
                port: 3306,
                user: "escola",
                database: "musica",
            },
            { table: "alunos" },
            silentLogger,
            async () => ({
                ...fake.session,
                close: async () => {
                    closed = true;
                },
            }),
        );

        await expect(sink.write(ALUNOS)).rejects.toThrow("não foi o Datera");
        expect(closed).toBe(true);
    });
});

describe("nomes perigosos", () => {
    it("aspas e comandos no nome da coluna e da tabela viram só nome", async () => {
        const file = tempDb();
        const perigoso = 'nome"; DROP TABLE alunos; --';
        const sink = new SqliteSink(
            { path: file, table: 'alunos"; DROP TABLE x; --' },
            silentLogger,
        );

        await sink.write([
            { [perigoso]: "Lia Martins", email: "lia@email.com" },
        ]);

        expect(tablesOf(file)).toContain('alunos"; DROP TABLE x; --');
        expect(
            await new SqliteSource({
                path: file,
                table: 'alunos"; DROP TABLE x; --',
            }).read(),
        ).toEqual([{ [perigoso]: "Lia Martins", email: "lia@email.com" }]);
    });

    it("recusa caractere invisível no nome", () => {
        expect(() => checkColumns(POSTGRES_DIALECT, ["nome\u0000x"])).toThrow(
            "caractere invisível",
        );
    });

    it("escapa o fechamento do nome em cada banco", async () => {
        for (const [dialect, esperado] of [
            [MYSQL_DIALECT, "`a``b`"],
            [SQLSERVER_DIALECT, "[a]]b]"],
            [POSTGRES_DIALECT, '"a""b"'],
        ] as const) {
            const fake = fakeSession([]);
            const close = dialect.close;
            await writeTable(
                fake.session,
                dialect,
                "t",
                [{ [`a${close}b`]: "x" }],
                silentLogger,
            );
            expect(
                fake.sqls().some((sql) => sql.includes(`(${esperado} `)),
            ).toBe(true);
        }
    });

    it("no MySQL, não apaga tabela temporária que não é do Datera", async () => {
        const fake = fakeSession(
            ["datera_tabelas", "alunos", "alunos__datera_novo"],
            ["alunos"],
        );

        await expect(
            writeTable(
                fake.session,
                MYSQL_DIALECT,
                "alunos",
                ALUNOS,
                silentLogger,
            ),
        ).rejects.toThrow("não foi o Datera que criou");
        expect(fake.sqls().some((sql) => sql.startsWith("DROP"))).toBe(false);
    });
});

describe("identidade das tabelas", () => {
    it("tabela apagada e criada de novo por outra pessoa com o mesmo nome não é mais do Datera", async () => {
        const file = tempDb();
        const sink = new SqliteSink(
            { path: file, table: "alunos" },
            silentLogger,
        );
        await sink.write(ALUNOS);

        const database = new DatabaseSync(file);
        database.exec('DROP TABLE "alunos"');
        database.exec('CREATE TABLE "alunos" (nome TEXT)');
        database.exec("INSERT INTO alunos VALUES ('dado de outra pessoa')");
        database.close();

        await expect(sink.write(ALUNOS)).rejects.toThrow(
            "não foi o Datera que criou",
        );
        expect(
            await new SqliteSource({ path: file, table: "alunos" }).read(),
        ).toEqual([{ nome: "dado de outra pessoa" }]);
    });
});
