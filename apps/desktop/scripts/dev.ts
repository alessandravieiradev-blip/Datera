import path from "path";
import { ChildProcess, spawn } from "child_process";
import { context, Plugin } from "esbuild";
import { copyHtml, nodeOptions, rendererOptions } from "./esbuild";

const appDir = path.resolve(__dirname, "..");
const electronPath = require("electron") as unknown as string;

let electron: ChildProcess | undefined;
let restarting = false;

function startElectron(): void {
    electron = spawn(electronPath, ["."], {
        cwd: appDir,
        stdio: "inherit",
        env: { ...process.env, DATERA_DEV: "1" },
    });
    electron.on("exit", (code) => {
        if (!restarting) process.exit(code ?? 0);
    });
}

function restartElectron(): void {
    if (!electron) return;
    restarting = true;
    electron.once("exit", () => {
        restarting = false;
        startElectron();
    });
    electron.kill();
}

function afterEachBuild(onChange: () => void): {
    plugin: Plugin;
    firstBuild: Promise<void>;
} {
    let resolveFirst: () => void = () => {};
    const firstBuild = new Promise<void>((resolve) => {
        resolveFirst = resolve;
    });
    let built = false;

    const plugin: Plugin = {
        name: "depois-de-compilar",
        setup(build) {
            build.onEnd((result) => {
                if (result.errors.length > 0) return;
                if (!built) {
                    built = true;
                    resolveFirst();
                    return;
                }
                onChange();
            });
        },
    };
    return { plugin, firstBuild };
}

async function main(): Promise<void> {
    const renderer = afterEachBuild(() => {});
    const node = afterEachBuild(restartElectron);

    const rendererContext = await context({
        ...rendererOptions(true),
        plugins: [
            {
                name: "copia-html",
                setup(build) {
                    build.onEnd(() => copyHtml());
                },
            },
            renderer.plugin,
        ],
    });
    const nodeContext = await context({
        ...nodeOptions(),
        plugins: [node.plugin],
    });

    await Promise.all([rendererContext.watch(), nodeContext.watch()]);
    await Promise.all([renderer.firstBuild, node.firstBuild]);
    startElectron();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
