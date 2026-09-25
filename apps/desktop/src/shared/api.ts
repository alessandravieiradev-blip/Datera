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
    log: "etl:log",
} as const;

export interface Settings {
    configPath: string | null;
}

export interface RunRequest {
    dryRun: boolean;
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

export type FileKind = "csv" | "excel" | "json" | "credentials";

export interface DateraApi {
    getSettings(): Promise<Settings>;
    chooseConfig(): Promise<Settings>;
    run(request: RunRequest): Promise<RunRecord>;
    listHistory(): Promise<RunRecord[]>;
    openHelp(): Promise<void>;
    readConfig(): Promise<ConfigResult>;
    saveConfig(config: RawConfig): Promise<SaveResult>;
    createConfig(config: RawConfig): Promise<SaveResult | null>;
    readColumns(): Promise<ColumnsResult>;
    pickFile(kind: FileKind): Promise<string | null>;
    pickSaveFile(kind: FileKind): Promise<string | null>;
    onLog(listener: (entry: LogEntry) => void): () => void;
}
