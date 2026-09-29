import fs from "fs";
import path from "path";
import { build } from "esbuild";

const raiz = path.resolve(__dirname, "..");
export const PASTA = path.join(__dirname, ".build");

const APPS = {
    gestores: path.join(
        raiz,
        "apps",
        "desktop",
        "src",
        "renderer",
        "index.html",
    ),
    dev: path.join(raiz, "apps", "dev", "src", "renderer", "index.html"),
};

export default async function montar(): Promise<void> {
    fs.rmSync(PASTA, { recursive: true, force: true });
    for (const [nome, html] of Object.entries(APPS)) {
        const saida = path.join(PASTA, nome);
        await build({
            entryPoints: {
                main: path.join(__dirname, "entries", `${nome}.ts`),
            },
            outdir: saida,
            bundle: true,
            platform: "browser",
            format: "iife",
            target: "chrome120",
            jsx: "automatic",
            loader: {
                ".png": "file",
                ".svg": "file",
                ".woff": "file",
                ".woff2": "file",
            },
            assetNames: "assets/[name]-[hash]",
            define: { "process.env.NODE_ENV": JSON.stringify("development") },
            logLevel: "warning",
        });
        const pagina = fs
            .readFileSync(html, "utf-8")
            .replace(
                /\s*<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
                "",
            );
        fs.writeFileSync(path.join(saida, "index.html"), pagina);
    }
}
