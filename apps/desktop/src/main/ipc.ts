import {
    BrowserWindow,
    dialog,
    ipcMain,
    IpcMainInvokeEvent,
    OpenDialogOptions,
    SaveDialogOptions,
    shell,
} from "electron";
import {
    FileKind,
    IPC,
    LogEntry,
    RawConfig,
    RunRequest,
    SaveResult,
} from "../shared/api";
import {
    prepareNewConfig,
    problemsOf,
    readConfigFile,
    writeConfigFile,
} from "./configFile";
import { readSettings, saveSettings } from "./settings";
import { addToHistory, readHistory } from "./history";
import { readColumns, runWithConfig } from "./etl";

const HELP_URL = "https://github.com/alessandravieiradev-blip/datera#readme";

const FILE_FILTERS: Record<FileKind, { name: string; extensions: string[] }> = {
    csv: { name: "Arquivo CSV", extensions: ["csv"] },
    excel: { name: "Arquivo Excel", extensions: ["xlsx"] },
    json: { name: "Arquivo JSON", extensions: ["json"] },
    credentials: { name: "Credenciais do Google", extensions: ["json"] },
};

function isFileKind(value: unknown): value is FileKind {
    return typeof value === "string" && value in FILE_FILTERS;
}

function isRawConfig(value: unknown): value is RawConfig {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function openDialog(
    event: IpcMainInvokeEvent,
    options: OpenDialogOptions,
): Promise<string | null> {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
}

async function saveDialog(
    event: IpcMainInvokeEvent,
    options: SaveDialogOptions,
): Promise<string | null> {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options);
    return result.canceled || !result.filePath ? null : result.filePath;
}

function saveConfig(configPath: string, config: RawConfig): SaveResult {
    const problems = problemsOf(config);
    if (problems)
        return {
            ok: false,
            error: `A configuração tem problemas: ${problems}`,
        };
    try {
        writeConfigFile(configPath, config);
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `Não consegui salvar: ${reason}` };
    }
    return {
        ok: true,
        settings: saveSettings({ ...readSettings(), configPath }),
    };
}

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

    ipcMain.handle(IPC.readConfig, () => {
        const { configPath } = readSettings();
        if (configPath === null) {
            return {
                ok: false,
                error: "Escolha o arquivo de configuração primeiro.",
            };
        }
        return readConfigFile(configPath);
    });

    ipcMain.handle(IPC.saveConfig, (_event, config: unknown) => {
        const { configPath } = readSettings();
        if (configPath === null) {
            return {
                ok: false,
                error: "Escolha o arquivo de configuração primeiro.",
            };
        }
        if (!isRawConfig(config))
            return { ok: false, error: "Configuração inválida." };
        return saveConfig(configPath, config);
    });

    ipcMain.handle(IPC.createConfig, async (event, config: unknown) => {
        if (!isRawConfig(config))
            return { ok: false, error: "Configuração inválida." };
        const target = await saveDialog(event, {
            title: "Onde salvar a configuração",
            defaultPath: "config.json",
            filters: [{ name: "Configuração do Datera", extensions: ["json"] }],
        });
        if (target === null) return null;
        return saveConfig(target, prepareNewConfig(target, config));
    });

    ipcMain.handle(IPC.readColumns, () =>
        readColumns(readSettings().configPath),
    );

    ipcMain.handle(IPC.pickFile, (event, kind: unknown) => {
        if (!isFileKind(kind)) return null;
        return openDialog(event, {
            title: "Escolha o arquivo",
            filters: [FILE_FILTERS[kind]],
            properties: ["openFile"],
        });
    });

    ipcMain.handle(IPC.pickSaveFile, (event, kind: unknown) => {
        if (!isFileKind(kind)) return null;
        const filter = FILE_FILTERS[kind];
        return saveDialog(event, {
            title: "Onde salvar o resultado",
            defaultPath: `resultado.${filter.extensions[0] ?? "csv"}`,
            filters: [filter],
        });
    });

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
