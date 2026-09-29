import type {
    DateraApi,
    FileKind,
    LogEntry,
    RunRecord,
    Settings,
    Theme,
} from "../apps/desktop/src/shared/api";
import {
    COLUNAS,
    CONFIG,
    CONFIG_PATH,
    historico,
    MODULO,
    relatorio,
} from "./dados";

export type Cenario = "cheio" | "vazio" | "novo";

const ARQUIVOS: Record<FileKind, string> = {
    csv: "C:\\Users\\voce\\escola\\alunos.csv",
    excel: "C:\\Users\\voce\\escola\\alunos.xlsx",
    json: "C:\\Users\\voce\\escola\\alunos.json",
    xml: "C:\\Users\\voce\\escola\\alunos.xml",
    sqlite: "C:\\Users\\voce\\escola\\escola.db",
    credentials: "C:\\Users\\voce\\escola\\credentials.json",
};

export function criarDatera(cenario: Cenario, tema: Theme): DateraApi {
    let settings: Settings = {
        configPath: cenario === "novo" ? null : CONFIG_PATH,
        theme: tema,
        shortcuts: {},
    };
    let config: Record<string, unknown> = structuredClone(CONFIG);
    let texto = JSON.stringify(CONFIG, null, 4) + "\n";
    const execucoes: RunRecord[] = cenario === "cheio" ? historico() : [];
    const ouvintes = new Set<(entry: LogEntry) => void>();

    const log = (message: string) => {
        const entry: LogEntry = {
            level: "info",
            message,
            at: new Date().toISOString(),
        };
        for (const ouvinte of ouvintes) ouvinte(entry);
    };

    return {
        getSettings: async () => settings,
        chooseConfig: async () => {
            settings = { ...settings, configPath: CONFIG_PATH };
            return settings;
        },
        run: async (request) => {
            log(`Modo em uso: dedupe${request.dryRun ? " (só teste)" : ""}`);
            log("7 linhas lidas.");
            const record: RunRecord = {
                id: `execucao-${execucoes.length + 10}`,
                startedAt: new Date().toISOString(),
                dryRun: request.dryRun,
                configPath: settings.configPath,
                sourceLabel: "Arquivo CSV",
                destinationLabel: "Arquivo Excel",
                ok: true,
                report: relatorio(request.dryRun),
            };
            execucoes.unshift(record);
            return record;
        },
        listHistory: async () => execucoes,
        openHelp: async () => undefined,
        listNormalizers: async () => ({
            ok: true,
            builtin: ["trim", "lowercase", "digitsOnly", "alphanumeric"],
            custom: ["matriculaComOitoDigitos"],
            files: ["C:\\Users\\voce\\escola\\normalizadores.cjs"],
        }),
        createNormalizerFile: async () => ({
            ok: true,
            path: "C:\\Users\\voce\\escola\\normalizadores.cjs",
        }),
        showInFolder: async () => undefined,
        setTheme: async (theme) => {
            settings = { ...settings, theme };
            return settings;
        },
        setShortcuts: async (shortcuts) => {
            settings = { ...settings, shortcuts };
            return settings;
        },
        readConfigText: async () =>
            settings.configPath === null
                ? { ok: false, error: "Nenhuma configuração escolhida." }
                : { ok: true, path: settings.configPath, text: texto },
        saveConfigText: async (novo) => {
            texto = novo;
            return { ok: true };
        },
        readModuleFile: async (filePath) => ({
            ok: true,
            path: filePath,
            text: MODULO,
        }),
        saveModuleFile: async () => ({ ok: true }),
        testNormalizer: async (_arquivo, _nome, valores) => ({
            ok: true,
            results: valores.map((value) => {
                const digitos = value.replace(/\D/g, "");
                return digitos.length === 8
                    ? { value, result: `chave "${digitos}"`, valid: true }
                    : { value, result: "vai para Pendências", valid: false };
            }),
        }),
        readConfig: async () =>
            settings.configPath === null
                ? { ok: false, error: "Nenhuma configuração escolhida." }
                : { ok: true, path: settings.configPath, config },
        saveConfig: async (novo) => {
            config = novo;
            return { ok: true, settings };
        },
        createConfig: async (novo) => {
            config = novo;
            settings = { ...settings, configPath: CONFIG_PATH };
            return { ok: true, settings };
        },
        readColumns: async () => ({ ok: true, columns: COLUNAS }),
        pickFile: async (kind) => ARQUIVOS[kind],
        pickSaveFile: async (kind) =>
            ARQUIVOS[kind].replace("escola\\", "escola\\saida\\"),
        onLog: (ouvinte) => {
            ouvintes.add(ouvinte);
            return () => ouvintes.delete(ouvinte);
        },
    };
}
