import path from "path";
import { pathToFileURL } from "url";
import { test as base, expect, Page } from "@playwright/test";
import { PASTA } from "./build";
import type { Cenario } from "./mock";

type App = "gestores" | "dev";

interface Apoio {
    erros: string[];
    abrir: (app: App, cenario?: Cenario) => Promise<Page>;
    foto: (nome: string) => Promise<void>;
}

export const test = base.extend<Apoio>({
    erros: async ({ page }, use) => {
        const erros: string[] = [];
        page.on("pageerror", (erro) => erros.push(erro.message));
        page.on("console", (mensagem) => {
            if (mensagem.type() === "error") erros.push(mensagem.text());
        });
        await use(erros);
        expect(erros, "a tela não pode ter erro no console").toEqual([]);
    },

    abrir: async ({ page, erros }, use, testInfo) => {
        void erros;
        const tema = String(testInfo.project.metadata.tema ?? "light");
        await use(async (app, cenario = "cheio") => {
            const url = pathToFileURL(path.join(PASTA, app, "index.html"));
            url.search = new URLSearchParams({ cenario, tema }).toString();
            await page.goto(url.href);
            return page;
        });
    },

    foto: async ({ page }, use, testInfo) => {
        await use(async (nome) => {
            await page.screenshot({
                path: testInfo.outputPath(`${nome}.png`),
                fullPage: true,
            });
        });
    },
});

export { expect };
