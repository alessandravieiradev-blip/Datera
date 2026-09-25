import fs from "fs";
import path from "path";
import { app, BrowserWindow } from "electron";
import { registerIpc } from "./ipc";

const isDev = process.env.DATERA_DEV === "1";
const rendererDir = path.join(__dirname, "..", "renderer");
const iconPath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "docs",
    "assets",
    "datera-icon.png",
);

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
        width: 1360,
        height: 860,
        minWidth: 1100,
        minHeight: 700,
        title: "Datera",
        backgroundColor: "#F8FAFC",
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

app.setAppUserModelId("io.github.alessandravieiradev.datera");

app.whenReady().then(() => {
    registerIpc();
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
