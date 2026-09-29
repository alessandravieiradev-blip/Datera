import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { parse } from "dotenv";
import { movePasswordToEnv } from "../../../apps/desktop/src/main/configFile";

function pasta(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "datera-env-"));
}

describe("senha do app no .env", () => {
    it("guarda a senha junto com o servidor, pra fonte e pro destino", () => {
        const dir = pasta();
        const config = movePasswordToEnv(path.join(dir, "config.json"), {
            source: {
                type: "mysql",
                host: "banco.escola",
                port: 3306,
                user: "escola",
                password: "segredo da fonte",
                table: "alunos",
            },
            destination: {
                type: "postgres",
                host: "relatorios.escola",
                user: "escola",
                password: "segredo do destino",
                table: "alunos_organizados",
            },
            mode: "raw",
        });

        expect(parse(fs.readFileSync(path.join(dir, ".env")))).toEqual({
            DB_HOST: "banco.escola",
            DB_PASSWORD: "segredo da fonte",
            DB_PORT: "3306",
            DEST_DB_HOST: "relatorios.escola",
            DEST_DB_PASSWORD: "segredo do destino",
        });
        expect(JSON.stringify(config).includes("segredo")).toBe(false);
    });

    it("não deixa a senha na config quando ela não cabe no .env", () => {
        expect(() =>
            movePasswordToEnv(path.join(pasta(), "config.json"), {
                source: {
                    type: "mysql",
                    host: "banco.escola",
                    password: "linha1\nDB_HOST=outro",
                },
                mode: "raw",
            }),
        ).toThrow("não dá para guardar");
    });
});
