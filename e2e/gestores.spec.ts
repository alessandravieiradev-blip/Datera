import { test, expect } from "./apoio";

const TELAS = [
    { menu: "Início", titulo: "Início" },
    { menu: "Exportar", titulo: "Exportar" },
    { menu: "Regras", titulo: "Regras" },
    { menu: "Histórico", titulo: "Histórico" },
    { menu: "Configurações", titulo: "Configurações" },
    { menu: "Atalhos", titulo: "Atalhos" },
];

test.describe("app de gestores", () => {
    test("todas as telas abrem pelo menu", async ({ abrir, foto }) => {
        const page = await abrir("gestores");
        const menu = page.getByRole("navigation");

        for (const tela of TELAS) {
            await menu.getByRole("button", { name: tela.menu }).click();
            await expect(
                page.getByRole("heading", { level: 1, name: tela.titulo }),
            ).toBeVisible();
            await foto(`gestores-${tela.menu}`);
        }
    });

    test("o Início mostra o resumo e as pendências por motivo", async ({
        abrir,
    }) => {
        const page = await abrir("gestores");

        await expect(page.getByText("Pendências por motivo")).toBeVisible();
        await expect(page.getByText("Últimas execuções")).toBeVisible();
        await expect(
            page.getByText('E-mail inválido em "email"').first(),
        ).toBeVisible();
    });

    test("sem configuração, o Início convida a criar uma", async ({
        abrir,
        foto,
    }) => {
        const page = await abrir("gestores", "novo");

        await expect(page.getByText("Primeiro passo")).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Criar configuração" }),
        ).toBeVisible();
        await foto("gestores-primeiro-acesso");
    });

    test("o passo a passo vai do começo até salvar", async ({
        abrir,
        foto,
    }) => {
        const page = await abrir("gestores", "novo");
        await page.getByRole("button", { name: "Criar configuração" }).click();

        await page.getByRole("radio", { name: /Arquivo CSV/ }).click();
        await page.getByRole("button", { name: /Próximo/ }).click();
        await page.getByRole("radio", { name: /Arquivo Excel/ }).click();
        await page.getByRole("button", { name: /Próximo/ }).click();

        await page.getByRole("button", { name: "Escolher arquivo" }).click();
        await page
            .getByRole("button", { name: "Escolher onde salvar" })
            .click();
        await foto("gestores-passo-a-passo-detalhes");
        await page.getByRole("button", { name: /Próximo/ }).click();

        await expect(page.getByText(/alunos\.csv/)).toBeVisible();
        await foto("gestores-passo-a-passo-pronto");
        await page.getByRole("button", { name: "Salvar configuração" }).click();

        await expect(
            page.getByRole("heading", { level: 1, name: "Regras" }),
        ).toBeVisible();
    });

    test("o passo a passo grava numa tabela nova do banco", async ({
        abrir,
        foto,
    }) => {
        const page = await abrir("gestores", "novo");
        await page.getByRole("button", { name: "Criar configuração" }).click();

        await page.getByRole("radio", { name: /Banco de dados/ }).click();
        await page.getByRole("button", { name: /Próximo/ }).click();
        await page.getByRole("radio", { name: /Banco de dados/ }).click();
        await page.getByRole("button", { name: /Próximo/ }).click();

        await page.getByLabel("Usuário").fill("escola");
        await page.getByLabel("Banco", { exact: true }).fill("musica");
        await page.getByLabel("Tabela", { exact: true }).fill("alunos");
        await page.getByLabel("Tabela do resultado").fill("Alunos");
        await expect(
            page.getByText("A tabela do resultado precisa ser diferente"),
        ).toBeVisible();

        await page.getByLabel("Tabela do resultado").fill("alunos_organizados");
        await page.getByRole("checkbox", { name: /mesmo servidor/ }).uncheck();
        await expect(page.getByLabel("Servidor", { exact: true })).toHaveCount(
            2,
        );
        await page.getByRole("checkbox", { name: /mesmo servidor/ }).check();
        await foto("gestores-destino-banco");
        await page.getByRole("button", { name: /Próximo/ }).click();

        await expect(page.getByText("tabela alunos_organizados")).toBeVisible();
        await page.getByRole("button", { name: "Salvar configuração" }).click();
        await expect(
            page.getByRole("heading", { level: 1, name: "Regras" }),
        ).toBeVisible();

        const salva = await page.evaluate(() => window.datera.readConfig());
        expect(salva).toMatchObject({
            ok: true,
            config: {
                destination: {
                    type: "mysql",
                    table: "alunos_organizados",
                },
            },
        });
    });

    test("o passo a passo lê todas as abas do Excel", async ({ abrir }) => {
        const page = await abrir("gestores", "novo");
        await page.getByRole("button", { name: "Criar configuração" }).click();

        await page.getByRole("radio", { name: /Arquivo Excel/ }).click();
        await page.getByRole("button", { name: /Próximo/ }).click();
        await page.getByRole("radio", { name: /Arquivo CSV/ }).click();
        await page.getByRole("button", { name: /Próximo/ }).click();

        await page.getByRole("button", { name: "Escolher arquivo" }).click();
        await page
            .getByRole("button", { name: "Escolher onde salvar" })
            .click();
        await expect(page.getByLabel("Aba (opcional)")).toBeVisible();
        await page.getByRole("checkbox", { name: "Ler todas as abas" }).check();
        await expect(page.getByLabel("Aba (opcional)")).toHaveCount(0);
        await page.getByRole("button", { name: /Próximo/ }).click();

        await expect(page.getByText("todas as abas")).toBeVisible();
        await page.getByRole("button", { name: "Salvar configuração" }).click();
        const salva = await page.evaluate(() => window.datera.readConfig());
        expect(salva).toMatchObject({
            ok: true,
            config: { source: { type: "excel", allSheets: true } },
        });
    });

    test("a prévia mostra o resultado sem gravar", async ({ abrir, foto }) => {
        const page = await abrir("gestores");
        await page
            .getByRole("navigation")
            .getByRole("button", { name: "Exportar" })
            .click();

        await page.getByRole("button", { name: "Ver prévia" }).click();

        await expect(
            page.getByText("Prévia pronta. Nada foi gravado."),
        ).toBeVisible();
        await expect(
            page.getByRole("cell", { name: "Lia Martins" }),
        ).toBeVisible();
        await foto("gestores-previa");
    });

    test("a janela de outra regra abre e fecha só com o teclado", async ({
        abrir,
        foto,
    }) => {
        const page = await abrir("gestores");
        await page
            .getByRole("navigation")
            .getByRole("button", { name: "Regras" })
            .click();

        await page.locator(".rule-row select").first().selectOption("outra");
        const janela = page.getByRole("dialog");
        await expect(janela).toBeVisible();
        await foto("gestores-janela-outra-regra");

        await page.keyboard.press("Escape");
        await expect(janela).toBeHidden();
    });
});
