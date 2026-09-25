import fs from "fs";
import path from "path";
import { etlConfigSchema } from "../../../../src";
import { ConfigResult, RawConfig } from "../shared/api";

const PATH_KEYS = ["path", "credentialsPath"];

function isObject(value: unknown): value is RawConfig {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readConfigFile(configPath: string): ConfigResult {
    try {
        const parsed: unknown = JSON.parse(
            fs.readFileSync(configPath, "utf-8"),
        );
        if (!isObject(parsed)) {
            return {
                ok: false,
                error: "O arquivo não tem uma configuração válida.",
            };
        }
        return { ok: true, path: configPath, config: parsed };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
            ok: false,
            error: `Não consegui ler a configuração: ${reason}`,
        };
    }
}

export function problemsOf(config: RawConfig): string | null {
    const result = etlConfigSchema.safeParse(config);
    if (result.success) return null;
    return result.error.issues
        .map((issue) => {
            const where = issue.path.join(".");
            return where ? `${where}: ${issue.message}` : issue.message;
        })
        .join("; ");
}

export function writeConfigFile(configPath: string, config: RawConfig): void {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4) + "\n");
}

function relativeTo(folder: string, filePath: string): string {
    if (!path.isAbsolute(filePath)) return filePath;
    const relative = path.relative(folder, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return filePath;
    return `./${relative.split(path.sep).join("/")}`;
}

function withRelativePaths(folder: string, value: RawConfig): RawConfig {
    const result: RawConfig = {};
    for (const [key, item] of Object.entries(value)) {
        if (PATH_KEYS.includes(key) && typeof item === "string") {
            result[key] = relativeTo(folder, item);
        } else if (isObject(item)) {
            result[key] = withRelativePaths(folder, item);
        } else {
            result[key] = item;
        }
    }
    return result;
}

export function prepareNewConfig(
    configPath: string,
    config: RawConfig,
): RawConfig {
    return withRelativePaths(path.dirname(configPath), config);
}
