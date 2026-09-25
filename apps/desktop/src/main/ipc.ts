import {
    BrowserWindow,
    dialog,
    ipcMain,
    OpenDialogOptions,
    shell,
} from "electron";
import { IPC, LogEntry, RunRequest } from "../shared/api";
import { readSettings, saveSettings } from "./settings";
import { addToHistory, readHistory } from "./history";
import { runWithConfig } from "./etl";

const HELP_URL = "https://github.com/alessandravieiradev-blip/datera#readme";

export function registerIpc(): void {
    ipcMain.handle(IPC.getSettings, () => readSettings());

    ipcMain.handle(IPC.chooseConfig, async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        const options: OpenDialogOptions = {
            title: "Escolha o arquivo de configuração",
            filters: [{ name: "Configuração do Datera", extensions: ["json"] }],
            properties: ["openFile"],
        };
        const result = window
            ? await dialog.showOpenDialog(window, options)
            : await dialog.showOpenDialog(options);
        const chosen = result.filePaths[0];
        if (result.canceled || chosen === undefined) return readSettings();
        return saveSettings({ ...readSettings(), configPath: chosen });
    });

    ipcMain.handle(IPC.listHistory, () => readHistory());

    ipcMain.handle(IPC.openHelp, () => shell.openExternal(HELP_URL));

    ipcMain.handle(IPC.run, async (event, request: RunRequest) => {
        const send = (entry: LogEntry) => {
            if (!event.sender.isDestroyed()) event.sender.send(IPC.log, entry);
        };
        const record = await runWithConfig(
            readSettings().configPath,
            { dryRun: request?.dryRun === true },
            send,
        );
        addToHistory(record);
        return record;
    });
}
