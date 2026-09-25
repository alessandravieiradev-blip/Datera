import { useCallback, useEffect, useState } from "react";
import type { LogEntry, RunRecord, Settings } from "../../shared/api";

export interface DateraState {
    loading: boolean;
    settings: Settings;
    history: RunRecord[];
    running: boolean;
    lastRun: RunRecord | undefined;
    log: LogEntry[];
    chooseConfig: () => Promise<void>;
    applySettings: (settings: Settings) => void;
    refresh: () => Promise<void>;
    run: (dryRun: boolean) => Promise<RunRecord>;
    openHelp: () => void;
}

export function useDatera(): DateraState {
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<Settings>({
        configPath: null,
        theme: "system",
        shortcuts: {},
    });
    const [history, setHistory] = useState<RunRecord[]>([]);
    const [running, setRunning] = useState(false);
    const [lastRun, setLastRun] = useState<RunRecord>();
    const [log, setLog] = useState<LogEntry[]>([]);

    useEffect(() => {
        Promise.all([window.datera.getSettings(), window.datera.listHistory()])
            .then(([loadedSettings, loadedHistory]) => {
                setSettings(loadedSettings);
                setHistory(loadedHistory);
            })
            .finally(() => setLoading(false));

        return window.datera.onLog((entry) => {
            setLog((previous) => [...previous, entry]);
        });
    }, []);

    const chooseConfig = useCallback(async () => {
        setSettings(await window.datera.chooseConfig());
    }, []);

    const refresh = useCallback(async () => {
        const [loadedSettings, loadedHistory] = await Promise.all([
            window.datera.getSettings(),
            window.datera.listHistory(),
        ]);
        setSettings(loadedSettings);
        setHistory(loadedHistory);
    }, []);

    const applySettings = useCallback((next: Settings) => {
        setSettings(next);
    }, []);

    const run = useCallback(async (dryRun: boolean) => {
        setRunning(true);
        setLog([]);
        setLastRun(undefined);
        try {
            const record = await window.datera.run({ dryRun });
            setLastRun(record);
            setHistory(await window.datera.listHistory());
            return record;
        } finally {
            setRunning(false);
        }
    }, []);

    const openHelp = useCallback(() => {
        void window.datera.openHelp();
    }, []);

    return {
        loading,
        settings,
        history,
        running,
        lastRun,
        log,
        chooseConfig,
        applySettings,
        refresh,
        run,
        openHelp,
    };
}
