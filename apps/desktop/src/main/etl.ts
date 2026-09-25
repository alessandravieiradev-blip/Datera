import fs from "fs";
import path from "path";
import { parse } from "dotenv";
import { EtlConfig, loadConfig, Logger, runEtl } from "../../../../src";
import { LogEntry, LogLevel, RunRecord, RunRequest } from "../shared/api";

const PREVIEW_SIZE = 20;

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

function enableTypeScriptModules(): void {
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
    if (running) {
        return {
            ...record,
            error: "Já tem uma execução rodando. Espera ela terminar.",
        };
    }

    running = true;
    enableTypeScriptModules();
    const logger = createIpcLogger(send);
    const previousDir = process.cwd();
    const configDir = path.dirname(configPath);
    const restoreEnv = useEnvFile(configDir);

    try {
        process.chdir(configDir);
        const config = loadConfig(configPath);
        const labels = describe(config);
        const report = await runEtl(config, {
            dryRun: request.dryRun,
            logger,
            previewSize: PREVIEW_SIZE,
        });
        return {
            ...record,
            ok: true,
            sourceLabel: labels.source,
            destinationLabel: labels.destination,
            report,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Deu erro:", error);
        return { ...record, error: message };
    } finally {
        process.chdir(previousDir);
        restoreEnv();
        running = false;
    }
}
