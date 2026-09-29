import fs from "fs";
import path from "path";
import { etlConfigSchema } from "../../../../src";
import { ConfigResult, RawConfig } from "../shared/api";
import { envLine, setEnvLine } from "./safe";

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

const SERVER_TYPES = ["mysql", "postgres", "sqlserver"];

function moveSidePassword(
    configPath: string,
    config: RawConfig,
    side: "source" | "destination",
    prefix: "DB" | "DEST_DB",
): RawConfig {
    const target = config[side];
    if (!isObject(target) || !SERVER_TYPES.includes(String(target.type)))
        return config;
    const password = target.password;
    const host = target.host;
    if (typeof password !== "string" || password === "") return config;
    if (typeof host !== "string" || host.trim() === "") return config;
    const lines: [string, string | null][] = [
        [`${prefix}_HOST`, envLine(`${prefix}_HOST`, host.trim())],
        [`${prefix}_PASSWORD`, envLine(`${prefix}_PASSWORD`, password)],
    ];
    if (typeof target.port === "number") {
        lines.push([
            `${prefix}_PORT`,
            envLine(`${prefix}_PORT`, String(target.port)),
        ]);
    }
    if (lines.some(([, line]) => line === null)) {
        throw new Error(
            "A senha ou o servidor têm um caractere que não dá para guardar no .env com segurança. Troque a senha ou coloque ela direto no .env.",
        );
    }

    const envPath = path.join(path.dirname(configPath), ".env");
    let content = fs.existsSync(envPath)
        ? fs.readFileSync(envPath, "utf-8")
        : "";
    for (const [key, line] of lines) content = setEnvLine(content, key, line!);
    fs.writeFileSync(envPath, content);

    const rest = Object.fromEntries(
        Object.entries(target).filter(([name]) => name !== "password"),
    );
    return { ...config, [side]: rest };
}

export function movePasswordToEnv(
    configPath: string,
    config: RawConfig,
): RawConfig {
    return moveSidePassword(
        configPath,
        moveSidePassword(configPath, config, "source", "DB"),
        "destination",
        "DEST_DB",
    );
}
