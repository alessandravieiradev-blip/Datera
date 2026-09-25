import fs from "fs";
import path from "path";
import { app, BrowserWindow, Menu } from "electron";
import { registerIpc } from "../../../desktop/src/main/ipc";
import {
    readSettings,
    setDefaultTheme,
} from "../../../desktop/src/main/settings";
import { applyTheme, backgroundColor } from "../../../desktop/src/main/theme";

const isDev = process.env.DATERA_DEV === "1";
const rendererDir = path.join(__dirname, "..", "renderer");
const iconPath = path.join(__dirname, "..", "..", "resources", "icon.png");

setDefaultTheme("dark");

function reloadOnRendererChange(window: BrowserWindow): void {
    let timer: NodeJS.Timeout | undefined;
    const watcher = fs.watch(rendererDir, { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => window.webContents.reloadIgnoringCache(), 200);
    });
    window.on("closed", () => watcher.close());
}

function createWindow(): void {
    const window = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1000,
        minHeight: 640,
        title: "Datera Dev",
        backgroundColor: backgroundColor(),
        ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "..", "preload", "index.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    window.once("ready-to-show", () => window.show());
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.loadFile(path.join(rendererDir, "index.html"));

    if (isDev) reloadOnRendererChange(window);
}

if (app.isPackaged)
    app.setAppUserModelId("io.github.alessandravieiradev.datera.dev");

app.whenReady().then(() => {
    if (!isDev) Menu.setApplicationMenu(null);
    applyTheme(readSettings().theme);
    registerIpc();
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
