import fs from "fs";
import { build } from "esbuild";
import { copyHtml, nodeOptions, outDir, rendererOptions } from "./esbuild";

export async function buildForProduction(): Promise<void> {
    fs.rmSync(outDir, { recursive: true, force: true });
    await build(nodeOptions(true));
    await build(rendererOptions(false));
    copyHtml();
}

if (require.main === module) {
    buildForProduction().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
