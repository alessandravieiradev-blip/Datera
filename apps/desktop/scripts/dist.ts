import path from "path";
import { Arch, build, Configuration, Platform } from "electron-builder";
import { buildForProduction } from "./build";

const appDir = path.resolve(__dirname, "..");
const electronVersion = (
    require("electron/package.json") as { version: string }
).version;

const config: Configuration = {
    appId: "io.github.alessandravieiradev.datera",
    productName: "Datera",
    electronVersion,
    directories: { output: "release", buildResources: "resources" },
    files: ["out/**/*", "!out/**/*.map", "package.json"],
    asar: true,
    npmRebuild: false,
    win: {
        icon: "resources/icon.ico",
        artifactName: "Datera-Setup-${version}.${ext}",
    },
    nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: "Datera",
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

async function main(): Promise<void> {
    await buildForProduction();
    await build({
        projectDir: appDir,
        targets: Platform.WINDOWS.createTarget("nsis", Arch.x64),
        config,
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
