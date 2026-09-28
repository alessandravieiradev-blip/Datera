import path from "path";
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
    movePasswordToEnv,
    prepareNewConfig,
    problemsOf,
    readConfigFile,
    writeConfigFile,
} from "./configFile";
import { hasKey, isInsideFolder, isSamePage } from "./safe";
import {
    cleanShortcuts,
    isTheme,
    readSettings,
    saveSettings,
} from "./settings";
import { applyTheme } from "./theme";
import { addToHistory, readHistory } from "./history";
import { readColumns, runWithConfig } from "./etl";
import {
    createNormalizerTemplate,
    listNormalizers,
    testNormalizer,
} from "./normalizers";
import {
    allowedModulePath,
    readConfigText,
    readModuleFile,
    saveConfigText,
    saveModuleFile,
} from "./files";

const HELP_URL =
    "https://github.com/alessandravieiradev-blip/datera/blob/main/docs/";

const HELP_ANCHORS = {
    inicio: "gestores.md",
    normalizador: "normalizadores.md#criando-o-seu-próprio-normalizador",
    regras: "gestores.md#regras",
    dev: "devs.md",
};

const FILE_FILTERS: Record<FileKind, { name: string; extensions: string[] }> = {
    csv: { name: "Arquivo CSV", extensions: ["csv"] },
    excel: { name: "Arquivo Excel", extensions: ["xlsx"] },
    json: { name: "Arquivo JSON", extensions: ["json"] },
    xml: { name: "Arquivo XML", extensions: ["xml"] },
    sqlite: { name: "Arquivo SQLite", extensions: ["db", "sqlite", "sqlite3"] },
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

type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown;

let appPage: string | null = null;

function fromAppPage(event: IpcMainInvokeEvent): boolean {
    const frame = event.senderFrame;
    if (appPage === null || !frame || frame.parent !== null) return false;
    return isSamePage(frame.url, appPage);
}

function handle(channel: string, handler: Handler): void {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
        if (!fromAppPage(event)) {
            throw new Error(
                "Chamada recusada: ela não veio da tela do Datera.",
            );
        }
        return handler(event, ...args);
    });
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

export function registerIpc(pagePath: string): void {
    appPage = pagePath;

    handle(IPC.getSettings, () => readSettings());

    handle(IPC.chooseConfig, async (event) => {
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

    handle(IPC.listHistory, () => readHistory());

    handle(IPC.readConfigText, () => readConfigText(readSettings().configPath));

    handle(IPC.saveConfigText, (_event, text: unknown) =>
        typeof text === "string"
            ? saveConfigText(readSettings().configPath, text)
            : { ok: false, error: "Texto inválido." },
    );

    handle(IPC.readModuleFile, (_event, filePath: unknown) =>
        typeof filePath === "string"
            ? readModuleFile(readSettings().configPath, filePath)
            : { ok: false, error: "Caminho inválido." },
    );

    handle(IPC.saveModuleFile, (_event, filePath: unknown, text: unknown) =>
        typeof filePath === "string" && typeof text === "string"
            ? saveModuleFile(readSettings().configPath, filePath, text)
            : { ok: false, error: "Dados inválidos." },
    );

    handle(
        IPC.testNormalizer,
        (_event, filePath: unknown, name: unknown, values: unknown) => {
            const resolved =
                typeof filePath === "string"
                    ? allowedModulePath(readSettings().configPath, filePath)
                    : null;
            const { configPath } = readSettings();
            if (
                configPath === null ||
                resolved === null ||
                typeof name !== "string" ||
                !Array.isArray(values)
            ) {
                return { ok: false, error: "Dados inválidos." };
            }
            return testNormalizer(
                configPath,
                resolved,
                name,
                values
                    .filter(
                        (value): value is string => typeof value === "string",
                    )
                    .slice(0, 50),
            );
        },
    );

    handle(IPC.setShortcuts, (_event, shortcuts: unknown) =>
        saveSettings({
            ...readSettings(),
            shortcuts: cleanShortcuts(shortcuts),
        }),
    );

    handle(IPC.setTheme, (_event, theme: unknown) => {
        const current = readSettings();
        if (!isTheme(theme)) return current;
        applyTheme(theme);
        return saveSettings({ ...current, theme });
    });

    handle(IPC.readConfig, () => {
        const { configPath } = readSettings();
        if (configPath === null) {
            return {
                ok: false,
                error: "Escolha o arquivo de configuração primeiro.",
            };
        }
        return readConfigFile(configPath);
    });

    handle(IPC.saveConfig, (_event, config: unknown) => {
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

    handle(IPC.createConfig, async (event, config: unknown) => {
        if (!isRawConfig(config))
            return { ok: false, error: "Configuração inválida." };
        const target = await saveDialog(event, {
            title: "Onde salvar a configuração",
            defaultPath: "config.json",
            filters: [{ name: "Configuração do Datera", extensions: ["json"] }],
        });
        if (target === null) return null;
        const prepared = prepareNewConfig(target, config);
        const problems = problemsOf(prepared);
        if (problems)
            return {
                ok: false,
                error: `A configuração tem problemas: ${problems}`,
            };
        let safeConfig: RawConfig;
        try {
            safeConfig = movePasswordToEnv(target, prepared);
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error);
            return {
                ok: false,
                error: `Não consegui salvar a senha no .env: ${reason}`,
            };
        }
        return saveConfig(target, safeConfig);
    });

    handle(IPC.readColumns, () => readColumns(readSettings().configPath));

    handle(IPC.pickFile, (event, kind: unknown) => {
        if (!isFileKind(kind)) return null;
        return openDialog(event, {
            title: "Escolha o arquivo",
            filters: [FILE_FILTERS[kind]],
            properties: ["openFile"],
        });
    });

    handle(IPC.pickSaveFile, (event, kind: unknown) => {
        if (!isFileKind(kind)) return null;
        const filter = FILE_FILTERS[kind];
        return saveDialog(event, {
            title: "Onde salvar o resultado",
            defaultPath: `resultado.${filter.extensions[0] ?? "csv"}`,
            filters: [filter],
        });
    });

    handle(IPC.openHelp, (_event, section: unknown) => {
        const anchor = hasKey(HELP_ANCHORS, section)
            ? HELP_ANCHORS[section]
            : HELP_ANCHORS.inicio;
        return shell.openExternal(`${HELP_URL}${anchor}`);
    });

    handle(IPC.listNormalizers, () =>
        listNormalizers(readSettings().configPath),
    );

    handle(IPC.createNormalizerFile, () =>
        createNormalizerTemplate(readSettings().configPath),
    );

    handle(IPC.showInFolder, (_event, filePath: unknown) => {
        const { configPath } = readSettings();
        if (typeof filePath !== "string" || configPath === null) return;
        const folder = path.dirname(configPath);
        const resolved = path.resolve(folder, filePath);
        if (!isInsideFolder(folder, resolved)) return;
        shell.showItemInFolder(resolved);
    });

    handle(IPC.run, async (event, request?: Partial<RunRequest>) => {
        const send = (entry: LogEntry) => {
            if (!event.sender.isDestroyed()) event.sender.send(IPC.log, entry);
        };
        const record = await runWithConfig(
            readSettings().configPath,
            {
                dryRun: request?.dryRun === true,
                configText:
                    typeof request?.configText === "string"
                        ? request.configText
                        : undefined,
                previewSize:
                    typeof request?.previewSize === "number"
                        ? request.previewSize
                        : undefined,
            },
            send,
        );
        addToHistory(record);
        return record;
    });
}
