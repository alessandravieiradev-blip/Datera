import fs from "fs";
import path from "path";
import { BuildOptions } from "esbuild";

export const appDir = process.cwd();
export const outDir = path.join(appDir, "out");
const rendererSrc = path.join(appDir, "src", "renderer");
const rendererOut = path.join(outDir, "renderer");

export function nodeOptions(production: boolean = false): BuildOptions {
    const dependencies: BuildOptions = production
        ? { external: ["electron", "tsx", "tsx/*"], minify: true }
        : { packages: "external", sourcemap: true };
    return {
        ...dependencies,
        entryPoints: {
            "main/index": path.join(appDir, "src", "main", "index.ts"),
            "preload/index": path.join(appDir, "src", "preload", "index.ts"),
        },
        outdir: outDir,
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node22",
        logLevel: "info",
    };
}

export function rendererOptions(dev: boolean): BuildOptions {
    return {
        entryPoints: [path.join(rendererSrc, "main.tsx")],
        outdir: rendererOut,
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
        define: {
            "process.env.NODE_ENV": JSON.stringify(
                dev ? "development" : "production",
            ),
        },
        minify: !dev,
        sourcemap: dev,
        logLevel: "info",
    };
}

export function copyHtml(): void {
    fs.mkdirSync(rendererOut, { recursive: true });
    fs.copyFileSync(
        path.join(rendererSrc, "index.html"),
        path.join(rendererOut, "index.html"),
    );
}
