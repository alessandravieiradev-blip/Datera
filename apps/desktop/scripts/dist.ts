import fs from "fs";
import path from "path";
import { Arch, build, Configuration, Platform } from "electron-builder";
import { buildForProduction } from "./build";
import { appDir } from "./esbuild";

const electronVersion = (
    require("electron/package.json") as { version: string }
).version;

interface AppInfo {
    appId: string;
    productName: string;
    artifactName: string;
    shortcutName: string;
}

function appInfo(): AppInfo {
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(appDir, "package.json"), "utf-8"),
    ) as { datera?: AppInfo };
    if (!packageJson.datera) {
        throw new Error('Faltou o campo "datera" no package.json do app.');
    }
    return packageJson.datera;
}

function configFor(info: AppInfo): Configuration {
    return {
        appId: info.appId,
        productName: info.productName,
        electronVersion,
        directories: { output: "release", buildResources: "resources" },
        files: ["out/**/*", "!out/**/*.map", "package.json"],
        asar: true,
        npmRebuild: false,
        win: {
            icon: "resources/icon.ico",
            artifactName: info.artifactName,
        },
        nsis: {
            oneClick: false,
            perMachine: false,
            allowToChangeInstallationDirectory: true,
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: info.shortcutName,
            installerIcon: "resources/icon.ico",
            uninstallerIcon: "resources/icon.ico",
            installerSidebar: "resources/installerSidebar.bmp",
            uninstallerSidebar: "resources/installerSidebar.bmp",
            installerHeader: "resources/installerHeader.bmp",
            installerHeaderIcon: "resources/icon.ico",
            include: "resources/installer.nsh",
            language: "1046",
        },
    };
}

async function main(): Promise<void> {
    await buildForProduction();
    await build({
        projectDir: appDir,
        targets: Platform.WINDOWS.createTarget("nsis", Arch.x64),
        config: configFor(appInfo()),
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
