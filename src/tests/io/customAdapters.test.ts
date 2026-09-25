import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { loadAdapterModules } from "../../io/custom/loader";
import {
    createCustomSink,
    createCustomSource,
    registerSourceAdapter,
} from "../../io/custom/registry";
import { createSink, createSource } from "../../io/factory";
import { etlConfigSchema } from "../../config";

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

describe("adapters próprios", () => {
    it("carrega fonte e destino de um arquivo e usa pelo nome", async () => {
        loadAdapterModules([fixture("customAdapters.cjs")]);
        const txt = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), "etl-custom-")),
            "alunos.txt",
        );
        fs.writeFileSync(txt, "Lia\n\nTheo\r\nNina\n");

        const rows = await createCustomSource("linhasDeTexto", {
            path: txt,
            column: "nome",
        }).read();
        await createCustomSink("memoria", {}).write(rows, {
            name: "Pendências",
        });

        expect(rows).toEqual([
            { nome: "Lia" },
            { nome: "Theo" },
            { nome: "Nina" },
        ]);
        const { escritas } = require(fixture("customAdapters.cjs"));
        expect(escritas.at(-1)).toEqual({ name: "Pendências", rows });
    });

    it("a config com type custom passa pela fábrica", () => {
        loadAdapterModules([fixture("customAdapters.cjs")]);
        const config = etlConfigSchema.parse({
            mode: "raw",
            adapterModules: ["./x.cjs"],
            source: {
                type: "custom",
                adapter: "linhasDeTexto",
                options: { path: "a.txt" },
            },
            destination: { type: "custom", adapter: "memoria" },
        });

        expect(typeof createSource(config).read).toBe("function");
        expect(typeof createSink(config).write).toBe("function");
    });

    it("avisa quando o nome não existe, listando os que existem", () => {
        loadAdapterModules([fixture("customAdapters.cjs")]);

        expect(() => createCustomSource("naoExiste", {})).toThrow(
            "linhasDeTexto",
        );
    });

    it("reclama de módulo sem sources nem sinks, de arquivo que não existe e de função errada", () => {
        expect(() => loadAdapterModules([fixture("semAdapters.cjs")])).toThrow(
            "sources",
        );
        expect(() => loadAdapterModules([fixture("naoExiste.cjs")])).toThrow(
            "Não consegui carregar",
        );
        expect(() =>
            loadAdapterModules([fixture("adaptersQuebrados.cjs")]),
        ).toThrow("naoFuncao");
    });

    it("reclama quando a fonte não devolve um objeto com read()", () => {
        registerSourceAdapter("semRead", () => ({}) as never);

        expect(() => createCustomSource("semRead", {})).toThrow("read()");
    });
});
