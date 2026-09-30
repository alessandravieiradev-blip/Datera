import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const ENV_KEYS = [
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "DB_TABLE",
    "DEST_DB_HOST",
    "DEST_DB_PORT",
    "DEST_DB_USER",
    "DEST_DB_PASSWORD",
    "DEST_DB_NAME",
    "DEST_DB_TABLE",
    "GOOGLE_SPREADSHEET_ID",
    "GOOGLE_SERVICE_ACCOUNT_KEY_PATH",
];

export interface SplitEnv {
    allowed: Record<string, string>;
    ignored: string[];
}

export function splitEnv(values: Record<string, string>): SplitEnv {
    const allowed: Record<string, string> = {};
    const ignored: string[] = [];
    for (const [key, value] of Object.entries(values)) {
        if (ENV_KEYS.includes(key)) allowed[key] = value;
        else ignored.push(key);
    }
    return { allowed, ignored };
}

function realOrSame(target: string): string {
    try {
        return fs.realpathSync.native(target);
    } catch {
        return target;
    }
}

function realPath(target: string): string {
    const missing: string[] = [];
    let current = target;
    while (!fs.existsSync(current)) {
        const parent = path.dirname(current);
        if (parent === current) return target;
        missing.unshift(path.basename(current));
        current = parent;
    }
    return path.join(realOrSame(current), ...missing);
}

export function isInsideFolder(folder: string, target: string): boolean {
    const base = realPath(path.resolve(folder));
    const resolved = realPath(path.resolve(folder, target));
    const relative = path.relative(base, resolved);
    if (relative === "" || path.isAbsolute(relative)) return false;
    return relative !== ".." && !relative.startsWith(`..${path.sep}`);
}

export function previewSizeOf(
    value: unknown,
    fallback: number,
    max: number,
): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
        return fallback;
    return Math.min(value, max);
}

export function hasKey<T extends object>(
    record: T,
    key: unknown,
): key is keyof T {
    return (
        typeof key === "string" &&
        Object.prototype.hasOwnProperty.call(record, key)
    );
}

export function envLine(key: string, value: string): string | null {
    if (/[\r\n]/.test(value)) return null;
    const endsWithSlash = value.endsWith("\\");
    if (!value.includes("'") && !endsWithSlash) return `${key}='${value}'`;
    if (!value.includes("`") && !endsWithSlash) return `${key}=\`${value}\``;
    if (!value.includes('"') && !value.includes("\\"))
        return `${key}="${value}"`;
    return null;
}

export function setEnvLine(content: string, key: string, line: string): string {
    const pattern = new RegExp(`^\\s*(export\\s+)?${key}\\s*=`);
    const lines = content.split(/\r?\n/);
    while (lines.length > 0 && lines[lines.length - 1]?.trim() === "")
        lines.pop();
    const index = lines.findIndex((item) => pattern.test(item));
    if (index >= 0) lines[index] = line;
    else lines.push(line);
    return `${lines.join("\n")}\n`;
}

export function isSamePage(url: string, pagePath: string): boolean {
    let filePath: string;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "file:") return false;
        parsed.hash = "";
        parsed.search = "";
        filePath = fileURLToPath(parsed);
    } catch {
        return false;
    }
    const a = path.resolve(filePath);
    const b = path.resolve(pagePath);
    return process.platform === "win32"
        ? a.toLowerCase() === b.toLowerCase()
        : a === b;
}
