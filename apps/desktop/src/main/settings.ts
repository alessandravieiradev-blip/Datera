import { Settings, Theme } from "../shared/api";
import { readJson, writeJson } from "./storage";

const FILE = "settings.json";
const THEMES: Theme[] = ["system", "light", "dark"];

export function isTheme(value: unknown): value is Theme {
    return THEMES.some((theme) => theme === value);
}

const MAX_SHORTCUTS = 100;
const MAX_COMBO_LENGTH = 40;

export function cleanShortcuts(value: unknown): Record<string, string> {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return {};
    const result: Record<string, string> = {};
    for (const [key, combo] of Object.entries(value).slice(0, MAX_SHORTCUTS)) {
        if (typeof combo === "string" && combo.length <= MAX_COMBO_LENGTH)
            result[key] = combo;
    }
    return result;
}

export function readSettings(): Settings {
    const saved = readJson<Partial<Settings>>(FILE, {});
    return {
        configPath:
            typeof saved.configPath === "string" ? saved.configPath : null,
        theme: isTheme(saved.theme) ? saved.theme : "system",
        shortcuts: cleanShortcuts(saved.shortcuts),
    };
}

export function saveSettings(settings: Settings): Settings {
    writeJson(FILE, settings);
    return settings;
}
