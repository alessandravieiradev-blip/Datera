import fs from "fs";
import path from "path";
import { parse } from "dotenv";
import {
    EtlConfig,
    loadConfig,
    Logger,
    parseConfig,
    runEtl,
    silentLogger,
} from "../../../../src";
import { clearKeyNormalizers } from "../../../../src/normalizers/registry";
import { clearCustomAdapters } from "../../../../src/io/custom/registry";
import { createSource } from "../../../../src/io/factory";
import { loadAdapterModules } from "../../../../src/io/custom/loader";
import { buildHeader } from "../../../../src/io/header";
import {
    ColumnsResult,
    LogEntry,
    LogLevel,
    RunRecord,
    RunRequest,
} from "../shared/api";

const PREVIEW_SIZE = 20;
const MAX_PREVIEW_SIZE = 500;

const SOURCE_LABELS: Record<string, string> = {
    mysql: "Banco de dados",
    csv: "Arquivo CSV",
    json: "Arquivo JSON",
    excel: "Arquivo Excel",
    sheets: "Google Planilhas",
    custom: "Fonte própria",
};

let running = false;
let typeScriptReady = false;

export function enableTypeScriptModules(): void {
    if (typeScriptReady) return;
    typeScriptReady = true;
    try {
        const tsx = require("tsx/cjs/api") as { register: () => unknown };
        tsx.register();
    } catch {
        return;
    }
}

function createIpcLogger(send: (entry: LogEntry) => void): Logger {
    const emit =
        (level: LogLevel) =>
        (message: string, error?: unknown): void => {
            const reason =
                error === undefined
                    ? ""
                    : ` ${error instanceof Error ? error.message : String(error)}`;
            send({
                level,
                message: message + reason,
                at: new Date().toISOString(),
            });
        };
    return { info: emit("info"), warn: emit("warn"), error: emit("error") };
}

function useEnvFile(folder: string): () => void {
    const envPath = path.join(folder, ".env");
    if (!fs.existsSync(envPath)) return () => {};

    const values = parse(fs.readFileSync(envPath));
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(values)) {
        previous.set(key, process.env[key]);
        process.env[key] = value;
    }
    return () => {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    };
}

function describe(config: EtlConfig): { source: string; destination: string } {
    const source = config.source?.type ?? "mysql";
    const destination = config.destination?.type ?? "sheets";
    return {
        source: SOURCE_LABELS[source] ?? source,
        destination: SOURCE_LABELS[destination] ?? destination,
    };
}

export function forgetModule(filePath: string): void {
    const resolved = require.resolve(filePath);
    delete require.cache[resolved];
}

function reloadModules(config: EtlConfig): void {
    clearKeyNormalizers();
    clearCustomAdapters();
    for (const modulePath of [
        ...(config.normalizerModules ?? []),
        ...(config.adapterModules ?? []),
    ]) {
        try {
            forgetModule(path.resolve(modulePath));
        } catch {
            continue;
        }
    }
}

function readConfigFrom(
    configPath: string,
    configText: string | undefined,
): EtlConfig {
    if (configText === undefined) return loadConfig(configPath);
    let parsed: unknown;
    try {
        parsed = JSON.parse(configText);
    } catch (error) {
        throw new Error(
            `O JSON da configuração tem um erro: ${messageOf(error)}`,
        );
    }
    return parseConfig(parsed);
}

async function insideConfigFolder<T>(
    configPath: string,
    task: () => Promise<T>,
): Promise<T> {
    if (running) {
        throw new Error(
            "Já existe uma execução em andamento. Aguarde o término.",
        );
    }
    running = true;
    enableTypeScriptModules();
    const previousDir = process.cwd();
    const configDir = path.dirname(configPath);
    const restoreEnv = useEnvFile(configDir);
    try {
        process.chdir(configDir);
        return await task();
    } finally {
        process.chdir(previousDir);
        restoreEnv();
        running = false;
    }
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function runWithConfig(
    configPath: string | null,
    request: RunRequest,
    send: (entry: LogEntry) => void,
): Promise<RunRecord> {
    const record: RunRecord = {
        id: `${Date.now()}`,
        startedAt: new Date().toISOString(),
        dryRun: request.dryRun,
        configPath,
        ok: false,
    };

    if (configPath === null) {
        return {
            ...record,
            error: "Escolha o arquivo de configuração antes de rodar.",
        };
    }

    const logger = createIpcLogger(send);
    try {
        return await insideConfigFolder(configPath, async () => {
            const config = readConfigFrom(configPath, request.configText);
            reloadModules(config);
            const labels = describe(config);
            const report = await runEtl(config, {
                dryRun: request.dryRun,
                logger,
                previewSize: Math.min(
                    request.previewSize ?? PREVIEW_SIZE,
                    MAX_PREVIEW_SIZE,
                ),
            });
            return {
                ...record,
                ok: true,
                sourceLabel: labels.source,
                destinationLabel: labels.destination,
                report,
            };
        });
    } catch (error) {
        logger.error("Deu erro:", error);
        return { ...record, error: messageOf(error) };
    }
}

export async function readColumns(
    configPath: string | null,
): Promise<ColumnsResult> {
    if (configPath === null) {
        return {
            ok: false,
            error: "Escolha o arquivo de configuração primeiro.",
        };
    }
    try {
        return await insideConfigFolder(configPath, async () => {
            const config = loadConfig(configPath);
            reloadModules(config);
            loadAdapterModules(config.adapterModules ?? []);
            const source = createSource(config, silentLogger);
            try {
                const rows = await source.read();
                return { ok: true, columns: buildHeader(rows) };
            } finally {
                await source.close?.();
            }
        });
    } catch (error) {
        return { ok: false, error: messageOf(error) };
    }
}
