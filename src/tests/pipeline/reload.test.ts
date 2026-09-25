import { describe, it, expect } from "vitest";
import { parseConfig } from "../../config";
import {
    clearKeyNormalizers,
    getKeyNormalizer,
    registerKeyNormalizer,
} from "../../normalizers/registry";
import {
    clearCustomAdapters,
    createCustomSource,
    registerSourceAdapter,
} from "../../io/custom/registry";

describe("parseConfig", () => {
    it("valida um objeto que não veio de arquivo, igual ao loadConfig", () => {
        const config = parseConfig({
            mode: "raw",
            source: { type: "csv", path: "./alunos.csv" },
            destination: { type: "json", path: "./saida.json" },
        });

        expect(config.source).toEqual({ type: "csv", path: "./alunos.csv" });
    });

    it("explica o erro quando falta alguma coisa", () => {
        expect(() => parseConfig({ mode: "raw" })).toThrow(
            "Faltou dizer de onde ler",
        );
    });
});

describe("recarregar normalizadores e adapters", () => {
    it("depois de limpar, aceita uma versão nova com o mesmo nome", () => {
        registerKeyNormalizer("versaoTeste", () => ({ key: "velho" }));
        expect(() =>
            registerKeyNormalizer("versaoTeste", () => ({ key: "novo" })),
        ).toThrow("Já existe");

        clearKeyNormalizers();
        registerKeyNormalizer("versaoTeste", () => ({ key: "novo" }));

        expect(getKeyNormalizer("versaoTeste")("x")).toEqual({ key: "novo" });
    });

    it("limpa as fontes e destinos próprios", () => {
        registerSourceAdapter("fonteTemporaria", () => ({
            read: async () => [],
        }));
        clearCustomAdapters();

        expect(() => createCustomSource("fonteTemporaria", {})).toThrow(
            "não encontrado",
        );
    });
});
