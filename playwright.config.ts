import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "e2e",
    globalSetup: "./e2e/build.ts",
    outputDir: "e2e/resultados",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI
        ? [["list"], ["html", { open: "never", outputFolder: "e2e/relatorio" }]]
        : "list",
    use: {
        viewport: { width: 1366, height: 820 },
        locale: "pt-BR",
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "claro",
            metadata: { tema: "light" },
            use: { colorScheme: "light" },
        },
        {
            name: "escuro",
            metadata: { tema: "dark" },
            use: { colorScheme: "dark" },
        },
    ],
});
