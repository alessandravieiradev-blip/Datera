import fs from "fs";
import { build } from "esbuild";
import { copyHtml, nodeOptions, outDir, rendererOptions } from "./esbuild";

async function main(): Promise<void> {
    fs.rmSync(outDir, { recursive: true, force: true });
    await build(nodeOptions());
    await build(rendererOptions(false));
    copyHtml();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
