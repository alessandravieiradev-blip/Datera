import type { EtlReport } from "../../../../src";

export const IPC = {
    getSettings: "settings:get",
    chooseConfig: "settings:choose-config",
    run: "etl:run",
    listHistory: "history:list",
    openHelp: "help:open",
    readConfig: "config:read",
    saveConfig: "config:save",
    createConfig: "config:create",
    readColumns: "config:columns",
    pickFile: "dialog:pick-file",
    pickSaveFile: "dialog:pick-save-file",
    listNormalizers: "normalizers:list",
    createNormalizerFile: "normalizers:create-file",
    showInFolder: "files:show-in-folder",
    setTheme: "settings:set-theme",
    setShortcuts: "settings:set-shortcuts",
    readConfigText: "config:read-text",
    saveConfigText: "config:save-text",
    readModuleFile: "modules:read",
    saveModuleFile: "modules:save",
    testNormalizer: "normalizers:test",
    log: "etl:log",
} as const;

export type Theme = "system" | "light" | "dark";

export interface Settings {
    configPath: string | null;
    theme: Theme;
    shortcuts: Record<string, string>;
}

export interface RunRequest {
    dryRun: boolean;
    configText?: string | undefined;
    previewSize?: number | undefined;
}

export interface RunRecord {
    id: string;
    startedAt: string;
    dryRun: boolean;
    configPath: string | null;
    sourceLabel?: string | undefined;
    destinationLabel?: string | undefined;
    ok: boolean;
    error?: string | undefined;
    report?: EtlReport | undefined;
}

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
    level: LogLevel;
    message: string;
    at: string;
}

export type RawConfig = Record<string, unknown>;

export type Failure = { ok: false; error: string };

export type ConfigResult =
    { ok: true; path: string; config: RawConfig } | Failure;

export type SaveResult = { ok: true; settings: Settings } | Failure;

export type ColumnsResult = { ok: true; columns: string[] } | Failure;

export type NormalizersResult =
    | { ok: true; builtin: string[]; custom: string[]; files: string[] }
    | Failure;

export type TextResult = { ok: true; path: string; text: string } | Failure;

export type WriteResult = { ok: true } | Failure;

export interface NormalizerTest {
    value: string;
    result: string;
    valid: boolean;
}

export type NormalizerTestResult =
    { ok: true; results: NormalizerTest[] } | Failure;

export type TemplateResult = { ok: true; path: string } | Failure;

export type HelpSection = "inicio" | "normalizador" | "regras";

export type FileKind = "csv" | "excel" | "json" | "credentials";

export interface DateraApi {
    getSettings(): Promise<Settings>;
    chooseConfig(): Promise<Settings>;
    run(request: RunRequest): Promise<RunRecord>;
    listHistory(): Promise<RunRecord[]>;
    openHelp(section?: HelpSection): Promise<void>;
    listNormalizers(): Promise<NormalizersResult>;
    createNormalizerFile(): Promise<TemplateResult>;
    showInFolder(filePath: string): Promise<void>;
    setTheme(theme: Theme): Promise<Settings>;
    setShortcuts(shortcuts: Record<string, string>): Promise<Settings>;
    readConfigText(): Promise<TextResult>;
    saveConfigText(text: string): Promise<WriteResult>;
    readModuleFile(filePath: string): Promise<TextResult>;
    saveModuleFile(filePath: string, text: string): Promise<WriteResult>;
    testNormalizer(
        filePath: string,
        name: string,
        values: string[],
    ): Promise<NormalizerTestResult>;
    readConfig(): Promise<ConfigResult>;
    saveConfig(config: RawConfig): Promise<SaveResult>;
    createConfig(config: RawConfig): Promise<SaveResult | null>;
    readColumns(): Promise<ColumnsResult>;
    pickFile(kind: FileKind): Promise<string | null>;
    pickSaveFile(kind: FileKind): Promise<string | null>;
    onLog(listener: (entry: LogEntry) => void): () => void;
}
