import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ParquetSource } from "../../io/parquet/parquetSource";
import { ParquetSink } from "../../io/parquet/parquetSink";
import { createMemoryLogger } from "../../logger";

describe("Parquet de verdade", () => {
    it("o que ele escreve, ele lê de volta igual", async () => {
        const file = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), "etl-parquet-")),
            "saida",
            "resultado.parquet",
        );
        const rows = [
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
                aulas: null,
                mensalidade: 90,
                cidade: null,
            },
        ];

        await new ParquetSink({ path: file }, createMemoryLogger()).write(rows);

        expect(await new ParquetSource({ path: file }).read()).toEqual(rows);
    });
});
