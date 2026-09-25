import fs from "fs";
import path from "path";
import { app } from "electron";

function storagePath(fileName: string): string {
    return path.join(app.getPath("userData"), fileName);
}

export function readJson<T>(fileName: string, fallback: T): T {
    try {
        return JSON.parse(fs.readFileSync(storagePath(fileName), "utf-8"));
    } catch {
        return fallback;
    }
}

export function writeJson(fileName: string, value: unknown): void {
    const filePath = storagePath(fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}
