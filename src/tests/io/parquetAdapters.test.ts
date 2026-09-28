import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ParquetSource, parquetRow } from "../../io/parquet/parquetSource";
import { ParquetSink, parquetColumns } from "../../io/parquet/parquetSink";
import { ParquetColumn, ParquetLibrary } from "../../io/parquet/parquetLibrary";
import { createMemoryLogger } from "../../logger";

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "etl-parquet-"));
}

function fakeLibrary(records: Record<string, unknown>[] = []) {
    const written = new Map<string, ParquetColumn[]>();
    const library: ParquetLibrary = {
        read: async () => records,
        write: async (filePath, columns) => {
            written.set(filePath, columns);
        },
    };
    return { library, written };
}

describe("ParquetSource", () => {
    it("converte os tipos do Parquet pro formato das linhas", async () => {
        const file = path.join(tempDir(), "alunos.parquet");
        fs.writeFileSync(file, "");
        const { library } = fakeLibrary([
            {
                matricula: "2024-0042",
                aulas: BigInt(12),
                mensalidade: 180.5,
                ativo: true,
                inicio: new Date("2024-03-10T00:00:00.000Z"),
                instrumentos: ["violão", "ukulele"],
                endereco: { cidade: "Pelotas", bairro: null },
                cidade: null,
            },
        ]);

        expect(await new ParquetSource({ path: file }, library).read()).toEqual(
            [
                {
                    matricula: "2024-0042",
                    aulas: 12,
                    mensalidade: 180.5,
                    ativo: "true",
                    inicio: "2024-03-10",
                    instrumentos: "violão, ukulele",
                    "endereco.cidade": "Pelotas",
                    "endereco.bairro": null,
                    cidade: null,
                },
            ],
        );
    });

    it("lista de objetos vira texto em JSON, sem quebrar com número grande", () => {
        expect(
            parquetRow({ aulas: [{ dia: "seg", sala: BigInt(3) }] }),
        ).toEqual({ aulas: '[{"dia":"seg","sala":"3"}]' });
    });

    it("avisa quando o arquivo não existe", async () => {
        await expect(
            new ParquetSource({ path: "nao-existe.parquet" }).read(),
        ).rejects.toThrow("Arquivo não encontrado");
    });

    it("explica quando não consegue ler o arquivo", async () => {
        const file = path.join(tempDir(), "quebrado.parquet");
        fs.writeFileSync(file, "isso não é parquet");
        const library: ParquetLibrary = {
            read: async () => {
                throw new Error("parquet file invalid");
            },
            write: async () => undefined,
        };

        await expect(
            new ParquetSource({ path: file }, library).read(),
        ).rejects.toThrow("Não consegui ler o Parquet em");
    });
});

describe("ParquetSink", () => {
    it("escolhe o tipo de cada coluna pelos valores", () => {
        expect(
            parquetColumns([
                { nome: "Lia", aulas: 12, mensalidade: 180.5, cidade: null },
                {
                    nome: "Theo",
                    aulas: null,
                    mensalidade: 90,
                    matricula: "2024-0051",
                },
            ]),
        ).toEqual([
            { name: "nome", type: "STRING", data: ["Lia", "Theo"] },
            { name: "aulas", type: "INT32", data: [12, null] },
            { name: "mensalidade", type: "DOUBLE", data: [180.5, 90] },
            { name: "cidade", type: "STRING", data: [null, null] },
            { name: "matricula", type: "STRING", data: [null, "2024-0051"] },
        ]);
    });

    it("coluna com número e texto misturados vira texto", () => {
        expect(parquetColumns([{ plano: 1 }, { plano: "anual" }])[0]).toEqual({
            name: "plano",
            type: "STRING",
            data: ["1", "anual"],
        });
    });

    it("número inteiro grande demais vira DOUBLE", () => {
        expect(parquetColumns([{ total: 3_000_000_000 }])[0]?.type).toBe(
            "DOUBLE",
        );
    });

    it("grava as pendências num arquivo do lado", async () => {
        const dir = tempDir();
        const { library, written } = fakeLibrary();
        await new ParquetSink(
            { path: path.join(dir, "resultado.parquet") },
            createMemoryLogger(),
            library,
        ).write([{ nome: "Nina" }], { name: "Pendências" });

        expect([...written.keys()]).toEqual([
            path.join(dir, "resultado.pendencias.parquet"),
        ]);
    });

    it("sem linhas, apaga o arquivo antigo em vez de deixar ele lá", async () => {
        const file = path.join(tempDir(), "resultado.parquet");
        fs.writeFileSync(file, "antigo");
        const { library, written } = fakeLibrary();
        await new ParquetSink(
            { path: file },
            createMemoryLogger(),
            library,
        ).write([]);

        expect(fs.existsSync(file)).toBe(false);
        expect(written.size).toBe(0);
    });
});
