import { Settings, Theme } from "../shared/api";
import { readJson, writeJson } from "./storage";

const FILE = "settings.json";
const THEMES: Theme[] = ["system", "light", "dark"];

export function isTheme(value: unknown): value is Theme {
    return THEMES.some((theme) => theme === value);
}

export function readSettings(): Settings {
    const saved = readJson<Partial<Settings>>(FILE, {});
    return {
        configPath:
            typeof saved.configPath === "string" ? saved.configPath : null,
        theme: isTheme(saved.theme) ? saved.theme : "system",
    };
}

export function saveSettings(settings: Settings): Settings {
    writeJson(FILE, settings);
    return settings;
}
