import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { parse } from "dotenv";
import {
    envLine,
    hasKey,
    isInsideFolder,
    isSamePage,
    previewSizeOf,
    setEnvLine,
    splitEnv,
} from "../../../apps/desktop/src/main/safe";

describe("splitEnv", () => {
    it("aceita só as variáveis do Datera", () => {
        const result = splitEnv({
            DB_PASSWORD: "segredo",
            GOOGLE_SPREADSHEET_ID: "abc",
            NODE_TLS_REJECT_UNAUTHORIZED: "0",
            HTTPS_PROXY: "http://proxy:8080",
        });
        expect(result.allowed).toEqual({
            DB_PASSWORD: "segredo",
            GOOGLE_SPREADSHEET_ID: "abc",
        });
        expect(result.ignored).toEqual([
            "NODE_TLS_REJECT_UNAUTHORIZED",
            "HTTPS_PROXY",
        ]);
    });
});

describe("isInsideFolder", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "datera-pasta-"));
    const vizinha = `${folder}-outra`;

    it("aceita arquivo na pasta e em subpasta", () => {
        expect(isInsideFolder(folder, "./normalizadores.cjs")).toBe(true);
        expect(isInsideFolder(folder, "codigo/adapters.cjs")).toBe(true);
    });

    it("recusa caminho que sai da pasta", () => {
        expect(isInsideFolder(folder, "../fora.cjs")).toBe(false);
        expect(isInsideFolder(folder, path.join(vizinha, "x.cjs"))).toBe(false);
        expect(isInsideFolder(folder, folder)).toBe(false);
    });

    it("aceita subpasta que ainda não existe, mesmo com a pasta escrita de outro jeito", () => {
        const real = fs.mkdtempSync(path.join(os.tmpdir(), "datera-real-"));
        const atalho = `${real}-atalho`;
        try {
            fs.symlinkSync(real, atalho, "dir");
        } catch {
            return;
        }
        const pasta = fs.mkdtempSync(path.join(atalho, "datera-"));
        expect(isInsideFolder(pasta, "codigo/novo/adapters.cjs")).toBe(true);
        expect(isInsideFolder(pasta, "codigo/../../fora.cjs")).toBe(false);
    });

    it("aceita nome que só começa com dois pontos", () => {
        expect(isInsideFolder(folder, "..normalizadores.cjs")).toBe(true);
    });

    it("recusa link que aponta pra fora da pasta", () => {
        const fora = fs.mkdtempSync(path.join(os.tmpdir(), "datera-fora-"));
        fs.writeFileSync(path.join(fora, "x.cjs"), "");
        const link = path.join(folder, "atalho");
        try {
            fs.symlinkSync(fora, link, "dir");
        } catch {
            return;
        }
        expect(isInsideFolder(folder, "atalho/x.cjs")).toBe(false);
    });
});

describe("previewSizeOf", () => {
    it("usa o padrão pra valor estranho", () => {
        expect(previewSizeOf(-1, 20, 500)).toBe(20);
        expect(previewSizeOf(Number.NaN, 20, 500)).toBe(20);
        expect(previewSizeOf(2.5, 20, 500)).toBe(20);
        expect(previewSizeOf("50", 20, 500)).toBe(20);
        expect(previewSizeOf(undefined, 20, 500)).toBe(20);
    });

    it("respeita o máximo", () => {
        expect(previewSizeOf(0, 20, 500)).toBe(0);
        expect(previewSizeOf(200, 20, 500)).toBe(200);
        expect(previewSizeOf(10_000, 20, 500)).toBe(500);
    });
});

describe("hasKey", () => {
    const anchors = { inicio: "gestores.md" };

    it("só aceita chave que o objeto tem", () => {
        expect(hasKey(anchors, "inicio")).toBe(true);
        expect(hasKey(anchors, "constructor")).toBe(false);
        expect(hasKey(anchors, "toString")).toBe(false);
        expect(hasKey(anchors, 1)).toBe(false);
    });
});

describe("envLine", () => {
    const senhas = [
        "simples",
        "com espaço",
        "tem#cerquilha",
        "tem'aspas",
        "tem'aspas`e crase",
        "barra\\n",
        "  espaço nas pontas  ",
    ];

    it("o dotenv lê de volta a mesma senha", () => {
        for (const senha of senhas) {
            const line = envLine("DB_PASSWORD", senha);
            expect(line).not.toBeNull();
            expect(parse(line ?? "").DB_PASSWORD).toBe(senha);
        }
    });

    it("desiste quando não dá pra guardar sem mudar a senha", () => {
        expect(envLine("DB_PASSWORD", "quebra\nde linha")).toBeNull();
        expect(envLine("DB_PASSWORD", `'\`"`)).toBeNull();
        expect(envLine("DB_PASSWORD", "termina com barra\\")).toBeNull();
    });
});

describe("setEnvLine", () => {
    it("troca a linha que já existe", () => {
        const content = "DB_HOST=localhost\nDB_PASSWORD='velha'\n";
        expect(setEnvLine(content, "DB_PASSWORD", "DB_PASSWORD='nova'")).toBe(
            "DB_HOST=localhost\nDB_PASSWORD='nova'\n",
        );
    });

    it("acrescenta no fim quando não existe", () => {
        expect(setEnvLine("DB_HOST=localhost\n\n", "DB_PASSWORD", "X")).toBe(
            "DB_HOST=localhost\nX\n",
        );
        expect(setEnvLine("", "DB_PASSWORD", "X")).toBe("X\n");
    });
});

describe("isSamePage", () => {
    const page = path.join(os.tmpdir(), "renderer", "index.html");

    it("reconhece a página do app", () => {
        expect(isSamePage(pathToFileURL(page).href, page)).toBe(true);
        expect(isSamePage(`${pathToFileURL(page).href}#regras`, page)).toBe(
            true,
        );
    });

    it("recusa qualquer outra página", () => {
        const other = path.join(os.tmpdir(), "baixados", "pagina.html");
        expect(isSamePage(pathToFileURL(other).href, page)).toBe(false);
        expect(isSamePage("https://exemplo.com/", page)).toBe(false);
        expect(isSamePage("não é url", page)).toBe(false);
    });
});
