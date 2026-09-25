import { Settings } from "../shared/api";
import { readJson, writeJson } from "./storage";

const FILE = "settings.json";

export function readSettings(): Settings {
    const saved = readJson<Partial<Settings>>(FILE, {});
    return {
        configPath:
            typeof saved.configPath === "string" ? saved.configPath : null,
    };
}

export function saveSettings(settings: Settings): Settings {
    writeJson(FILE, settings);
    return settings;
}
