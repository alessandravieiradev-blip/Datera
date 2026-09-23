import { describe, it, expect } from "vitest";
import path from "path";
import {
    alphanumericNormalizer,
    digitsOnlyNormalizer,
    lowercaseNormalizer,
    trimNormalizer,
} from "../filters/normalizers/builtin";
import { loadNormalizerModules, registerBuiltinKeyNormalizers } from "../filters/normalizers";
import { getKeyNormalizer, listKeyNormalizers } from "../filters/keyNormalizers";
import { MergeFilter } from "../filters/merge";

describe("normalizadores prontos", () => {
    it("trim tira espaços das pontas e mantém números como estão", () => {
        expect(trimNormalizer("  AB-1  ")).toEqual({ key: "AB-1" });
        expect(trimNormalizer(42)).toEqual({ key: 42 });
    });

    it("lowercase tira espaços e deixa tudo minúsculo", () => {
        expect(lowercaseNormalizer(" Ana@Email.COM ")).toEqual({ key: "ana@email.com" });
    });

    it("digitsOnly fica só com os números e rejeita quando não sobra nenhum", () => {
        expect(digitsOnlyNormalizer("(53) 99999-1234")).toEqual({ key: "53999991234" });
        expect(digitsOnlyNormalizer("sem numero")).toBeNull();
    });

    it("alphanumeric tira símbolos e espaços, deixa minúsculo e rejeita se não sobra nada", () => {
        expect(alphanumericNormalizer("AB-0042 / rev")).toEqual({ key: "ab0042rev" });
        expect(alphanumericNormalizer("Ação 7")).toEqual({ key: "ação7" });
        expect(alphanumericNormalizer("---")).toBeNull();
    });
});

describe("registro dos normalizadores prontos", () => {
    it("registra os quatro pelo nome e é seguro chamar duas vezes", () => {
        registerBuiltinKeyNormalizers();
        registerBuiltinKeyNormalizers();

        expect(listKeyNormalizers()).toEqual(
            expect.arrayContaining(["trim", "lowercase", "digitsOnly", "alphanumeric"])
        );
    });

    it("MergeFilter usa o normalizador pelo nome", () => {
        registerBuiltinKeyNormalizers();
        const filter = new MergeFilter("email", [{ column: "nome", strategy: "concat" }], {
            keyNormalizer: "lowercase",
        });

        const result = filter.apply([
            { email: "Ana@x.com", nome: "Ana" },
            { email: " ana@X.com", nome: "Ana P." },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0]!.nome).toBe("Ana; Ana P.");
    });
});

describe("loadNormalizerModules", () => {
    const fixture = (name: string) => path.join(__dirname, "fixtures", name);

    it("carrega e registra os normalizadores exportados pelo arquivo", () => {
        loadNormalizerModules([fixture("customNormalizers.cjs")]);

        const normalizer = getKeyNormalizer("skuFromFile");
        expect(normalizer("ab-0042")).toEqual({ key: "0042", group: "AB" });
    });

    it("avisa quando o arquivo não existe", () => {
        expect(() => loadNormalizerModules(["./nao/existe.js"])).toThrow(/nao\/existe/);
    });

    it("avisa quando o arquivo não exporta 'normalizers'", () => {
        expect(() => loadNormalizerModules([fixture("semNormalizers.cjs")])).toThrow(/normalizers/);
    });
});
