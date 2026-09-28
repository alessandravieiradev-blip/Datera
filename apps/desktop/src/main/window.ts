import { BrowserWindow, dialog } from "electron";
import { isSamePage } from "./safe";

const ALLOWED_PERMISSIONS = ["clipboard-sanitized-write"];

export function lockDown(window: BrowserWindow, pagePath: string): void {
    const contents = window.webContents;
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (event) => {
        if (!isSamePage(event.url, pagePath)) event.preventDefault();
    });
    contents.on("will-redirect", (event) => {
        if (!isSamePage(event.url, pagePath)) event.preventDefault();
    });
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.on("will-prevent-unload", (event) => {
        const choice = dialog.showMessageBoxSync(window, {
            type: "warning",
            title: "Alterações não salvas",
            message: "Existem alterações que ainda não foram salvas.",
            detail: "Se sair agora, elas serão perdidas.",
            buttons: ["Sair sem salvar", "Cancelar"],
            defaultId: 1,
            cancelId: 1,
            noLink: true,
        });
        if (choice === 0) event.preventDefault();
    });
    contents.session.setPermissionRequestHandler(
        (_contents, permission, callback) =>
            callback(ALLOWED_PERMISSIONS.includes(permission)),
    );
    contents.session.setPermissionCheckHandler((_contents, permission) =>
        ALLOWED_PERMISSIONS.includes(permission),
    );
}
