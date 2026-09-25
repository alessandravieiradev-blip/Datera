import type { EtlReport } from "../../../../src";

export const IPC = {
    getSettings: "settings:get",
    chooseConfig: "settings:choose-config",
    run: "etl:run",
    listHistory: "history:list",
    openHelp: "help:open",
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

export interface DateraApi {
    getSettings(): Promise<Settings>;
    chooseConfig(): Promise<Settings>;
    run(request: RunRequest): Promise<RunRecord>;
    listHistory(): Promise<RunRecord[]>;
    openHelp(): Promise<void>;
    onLog(listener: (entry: LogEntry) => void): () => void;
}
