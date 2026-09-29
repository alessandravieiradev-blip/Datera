import { test, expect } from "./apoio";

test.describe("Datera Dev", () => {
    test("abre com a config no editor", async ({ abrir, foto }) => {
        const page = await abrir("dev");

        await expect(
            page.getByRole("textbox", { name: "Configuração" }),
        ).toHaveValue(/"dedupeColumn"/);
        await foto("dev-editor");
    });

    test("a paleta de comandos abre com Ctrl+K e fecha com Esc", async ({
        abrir,
        foto,
    }) => {
        const page = await abrir("dev");
        await expect(
            page.getByRole("textbox", { name: "Configuração" }),
        ).toHaveValue(/"dedupeColumn"/);

        await page.keyboard.press("Control+K");
        const paleta = page.getByRole("dialog");
        await expect(paleta).toBeVisible();
        await foto("dev-paleta");

        await page.keyboard.press("Escape");
        await expect(paleta).toBeHidden();
    });

    test("a prévia mostra o resultado e as abas da saída", async ({
        abrir,
        foto,
    }) => {
        const page = await abrir("dev");
        await expect(
            page.getByRole("textbox", { name: "Configuração" }),
        ).toHaveValue(/"dedupeColumn"/);

        await page.keyboard.press("Control+Enter");

        await expect(
            page.getByRole("cell", { name: "Lia Martins" }),
        ).toBeVisible();
        await foto("dev-previa");

        const abas = page.getByRole("tablist").last();
        for (const aba of await abas.getByRole("tab").all()) {
            await aba.click();
            await expect(aba).toHaveAttribute("aria-selected", "true");
        }
    });
});
