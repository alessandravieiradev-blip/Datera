import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import icon from "../../resources/icon.png";
import { CodeEditor, EditorApi } from "./components/CodeEditor";
import { CommandPalette, PaletteCommand } from "./components/CommandPalette";
import { DataTable } from "./components/DataTable";
import { NormalizerTester } from "./components/NormalizerTester";
import { checkConfig, formatJson, Problem } from "./lib/json";
import { NEW_CONFIG, SNIPPETS } from "./lib/snippets";
import type {
    LogEntry,
    RunRecord,
    Settings,
} from "../../../desktop/src/shared/api";

type OutputTab = "resultado" | "pendencias" | "log" | "problemas";

interface ModuleFile {
    path: string;
    text: string;
    saved: string;
}

const OUTPUT_TABS: { id: OutputTab; label: string; keys: string }[] = [
    { id: "resultado", label: "Resultado", keys: "Ctrl+1" },
    { id: "pendencias", label: "Pendências", keys: "Ctrl+2" },
    { id: "log", label: "Log", keys: "Ctrl+3" },
    { id: "problemas", label: "Problemas", keys: "Ctrl+4" },
];

const PREVIEW_SIZE = 200;
const TOAST_TIME = 2400;

const SOURCE_NAMES: Record<string, string> = {
    mysql: "mysql",
    csv: "csv",
    json: "json",
    excel: "excel",
    sheets: "sheets",
    custom: "custom",
};

function baseName(filePath: string): string {
    return filePath.split(/[\\/]/).pop() ?? filePath;
}

function ms(value: number): string {
    return value < 1000
        ? `${Math.round(value)} ms`
        : `${(value / 1000).toFixed(2)} s`;
}

function time(iso: string): string {
    return new Date(iso).toLocaleTimeString("pt-BR");
}

function describeFlow(value: unknown): string {
    if (typeof value !== "object" || value === null) return "";
    const config = value as {
        source?: { type?: string };
        destination?: { type?: string };
    };
    const source = SOURCE_NAMES[config.source?.type ?? "mysql"] ?? "?";
    const destination =
        SOURCE_NAMES[config.destination?.type ?? "sheets"] ?? "?";
    return `${source} → ${destination}`;
}

export function App() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [configText, setConfigText] = useState("");
    const [savedConfig, setSavedConfig] = useState("");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [modules, setModules] = useState<ModuleFile[]>([]);
    const [normalizerNames, setNormalizerNames] = useState<string[]>([]);
    const [activeFile, setActiveFile] = useState<string>("config");
    const [outputTab, setOutputTab] = useState<OutputTab>("resultado");
    const [running, setRunning] = useState(false);
    const [record, setRecord] = useState<RunRecord | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [palette, setPalette] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const editor = useRef<EditorApi | null>(null);

    const configPath = settings?.configPath ?? null;
    const check = useMemo(() => checkConfig(configText), [configText]);
    const errorLines = useMemo(
        () => new Set(check.problems.map((problem) => problem.line)),
        [check],
    );
    const configDirty = configText !== savedConfig;
    const activeModule = modules.find((file) => file.path === activeFile);

    const notify = useCallback((text: string) => setToast(text), []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), TOAST_TIME);
        return () => clearTimeout(timer);
    }, [toast]);

    const loadModules = useCallback(async () => {
        const result = await window.datera.listNormalizers();
        if (!result.ok) {
            setNormalizerNames([]);
            return;
        }
        setNormalizerNames(result.custom);
        const loaded = await Promise.all(
            result.files.map((file) => window.datera.readModuleFile(file)),
        );
        setModules((current) =>
            loaded.flatMap((item) => {
                if (!item.ok) return [];
                const existing = current.find(
                    (file) => file.path === item.path,
                );
                return [
                    existing && existing.text !== existing.saved
                        ? existing
                        : {
                              path: item.path,
                              text: item.text,
                              saved: item.text,
                          },
                ];
            }),
        );
    }, []);

    const loadConfig = useCallback(async () => {
        const result = await window.datera.readConfigText();
        if (result.ok) {
            setConfigText(result.text);
            setSavedConfig(result.text);
            setLoadError(null);
            setActiveFile("config");
            await loadModules();
        } else {
            setLoadError(result.error);
        }
    }, [loadModules]);

    useEffect(() => {
        void window.datera.getSettings().then(async (loaded) => {
            setSettings(loaded);
            if (loaded.configPath) await loadConfig();
        });
        return window.datera.onLog((entry) =>
            setLog((current) => [...current, entry]),
        );
    }, [loadConfig]);

    const openConfig = async () => {
        if (
            configDirty &&
            !window.confirm(
                "Existem alterações não salvas. Abrir outro arquivo mesmo assim?",
            )
        )
            return;
        const next = await window.datera.chooseConfig();
        setSettings(next);
        if (next.configPath) await loadConfig();
    };

    const newConfig = async () => {
        const result = await window.datera.createConfig(NEW_CONFIG);
        if (result === null) return;
        if (!result.ok) {
            notify(result.error);
            return;
        }
        setSettings(result.settings);
        await loadConfig();
        notify("Configuração criada.");
    };

    const saveConfig = async (): Promise<boolean> => {
        const result = await window.datera.saveConfigText(configText);
        if (!result.ok) {
            notify(result.error);
            setOutputTab("problemas");
            return false;
        }
        setSavedConfig(configText);
        await loadModules();
        notify("Configuração salva.");
        return true;
    };

    const saveModule = async (file: ModuleFile): Promise<boolean> => {
        const result = await window.datera.saveModuleFile(file.path, file.text);
        if (!result.ok) {
            notify(result.error);
            return false;
        }
        setModules((current) =>
            current.map((item) =>
                item.path === file.path ? { ...item, saved: item.text } : item,
            ),
        );
        await loadModules();
        notify(`${baseName(file.path)} salvo.`);
        return true;
    };

    const save = async () => {
        if (activeModule) await saveModule(activeModule);
        else await saveConfig();
    };

    const runPipeline = async (dryRun: boolean) => {
        if (!configPath || running) return;
        if (check.problems.length > 0) {
            setOutputTab("problemas");
            notify("Corrija os problemas da configuração antes de rodar.");
            return;
        }
        for (const file of modules) {
            if (file.text !== file.saved && !(await saveModule(file))) return;
        }
        setRunning(true);
        setLog([]);
        setOutputTab("log");
        const result = await window.datera.run(
            dryRun
                ? { dryRun, configText, previewSize: PREVIEW_SIZE }
                : { dryRun },
        );
        setRecord(result);
        setRunning(false);
        if (result.ok) {
            setOutputTab(dryRun ? "resultado" : "log");
            notify(dryRun ? "Prévia pronta." : "Exportação concluída.");
        } else {
            notify("A execução falhou. Veja o Log.");
        }
    };

    const askExport = () => {
        if (!configPath || running) return;
        setConfirming(true);
    };

    const confirmExport = async () => {
        setConfirming(false);
        if (configDirty && !(await saveConfig())) return;
        await runPipeline(false);
    };

    const format = () => {
        if (activeModule) return;
        const formatted = formatJson(configText);
        if (formatted === null)
            notify("Não dá para formatar: o JSON tem erro.");
        else setConfigText(formatted);
    };

    const createNormalizerFile = async () => {
        const result = await window.datera.createNormalizerFile();
        if (!result.ok) {
            notify(result.error);
            return;
        }
        await loadConfig();
        setActiveFile(result.path);
        notify(`${baseName(result.path)} pronto.`);
    };

    const copyCommand = async () => {
        if (!configPath) return;
        const command = `npm start -- --config "${configPath}" --dry-run`;
        try {
            await navigator.clipboard.writeText(command);
            notify("Comando copiado. Rode na pasta do projeto Datera.");
        } catch {
            notify(command);
        }
    };

    const toggleTheme = async () => {
        if (!settings) return;
        const dark =
            settings.theme === "dark" ||
            (settings.theme === "system" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        setSettings(await window.datera.setTheme(dark ? "light" : "dark"));
    };

    const insertSnippet = (text: string) => {
        if (activeModule) setActiveFile("config");
        requestAnimationFrame(() => editor.current?.insert(text));
    };

    const goToProblem = (problem: Problem) => {
        setActiveFile("config");
        requestAnimationFrame(() =>
            editor.current?.goTo(problem.line, problem.column),
        );
    };

    const commands: PaletteCommand[] = [
        {
            id: "previa",
            group: "Executar",
            label: "Rodar prévia",
            keys: "Ctrl+Enter",
            disabled: !configPath,
            run: () => void runPipeline(true),
        },
        {
            id: "exportar",
            group: "Executar",
            label: "Exportar",
            keys: "Ctrl+Shift+Enter",
            disabled: !configPath,
            run: askExport,
        },
        {
            id: "salvar",
            group: "Arquivo",
            label: "Salvar",
            keys: "Ctrl+S",
            disabled: !configPath,
            run: () => void save(),
        },
        {
            id: "formatar",
            group: "Arquivo",
            label: "Formatar JSON",
            keys: "Shift+Alt+F",
            disabled: !configPath,
            run: format,
        },
        {
            id: "abrir",
            group: "Arquivo",
            label: "Abrir configuração",
            keys: "Ctrl+O",
            run: () => void openConfig(),
        },
        {
            id: "nova",
            group: "Arquivo",
            label: "Nova configuração",
            keys: "Ctrl+Shift+N",
            run: () => void newConfig(),
        },
        {
            id: "recarregar",
            group: "Arquivo",
            label: "Recarregar do disco",
            disabled: !configPath,
            run: () => void loadConfig(),
        },
        {
            id: "pasta",
            group: "Arquivo",
            label: "Abrir pasta da configuração",
            disabled: !configPath,
            run: () =>
                configPath && void window.datera.showInFolder(configPath),
        },
        {
            id: "normalizador",
            group: "Normalizadores",
            label: "Criar arquivo de normalizadores",
            disabled: !configPath,
            run: () => void createNormalizerFile(),
        },
        {
            id: "copiar",
            group: "Terminal",
            label: "Copiar comando do terminal",
            disabled: !configPath,
            run: () => void copyCommand(),
        },
        ...OUTPUT_TABS.map((tab) => ({
            id: `aba-${tab.id}`,
            group: "Saída",
            label: `Mostrar ${tab.label}`,
            keys: tab.keys,
            run: () => setOutputTab(tab.id),
        })),
        ...SNIPPETS.map((snippet) => ({
            id: `trecho-${snippet.id}`,
            group: "Inserir",
            label: snippet.label,
            disabled: !configPath,
            run: () => insertSnippet(snippet.text),
        })),
        {
            id: "tema",
            group: "Aparência",
            label: "Alternar tema claro/escuro",
            keys: "Ctrl+Shift+L",
            run: () => void toggleTheme(),
        },
        {
            id: "ajuda",
            group: "Ajuda",
            label: "Abrir o guia no GitHub",
            keys: "F1",
            run: () => void window.datera.openHelp("dev"),
        },
    ];

    const commandsRef = useRef(commands);
    commandsRef.current = commands;

    useEffect(() => {
        const byId = (id: string) =>
            commandsRef.current.find((command) => command.id === id);
        const trigger = (id: string) => {
            const command = byId(id);
            if (command && !command.disabled) command.run();
        };
        const onKey = (event: KeyboardEvent) => {
            if (document.querySelector('[aria-modal="true"]')) return;
            const ctrl = event.ctrlKey;
            if (
                ctrl &&
                (event.code === "KeyK" ||
                    (event.shiftKey && event.code === "KeyP"))
            ) {
                event.preventDefault();
                setPalette(true);
                return;
            }
            const map: [boolean, string][] = [
                [ctrl && !event.shiftKey && event.key === "Enter", "previa"],
                [ctrl && event.shiftKey && event.key === "Enter", "exportar"],
                [ctrl && !event.shiftKey && event.code === "KeyS", "salvar"],
                [ctrl && !event.shiftKey && event.code === "KeyO", "abrir"],
                [ctrl && event.shiftKey && event.code === "KeyN", "nova"],
                [ctrl && event.shiftKey && event.code === "KeyL", "tema"],
                [
                    !ctrl &&
                        event.shiftKey &&
                        event.altKey &&
                        event.code === "KeyF",
                    "formatar",
                ],
                [event.key === "F1", "ajuda"],
                [
                    ctrl && !event.shiftKey && event.code === "Digit1",
                    "aba-resultado",
                ],
                [
                    ctrl && !event.shiftKey && event.code === "Digit2",
                    "aba-pendencias",
                ],
                [ctrl && !event.shiftKey && event.code === "Digit3", "aba-log"],
                [
                    ctrl && !event.shiftKey && event.code === "Digit4",
                    "aba-problemas",
                ],
            ];
            const hit = map.find(([pressed]) => pressed);
            if (hit) {
                event.preventDefault();
                trigger(hit[1]);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const report = record?.ok ? record.report : undefined;

    return (
        <div className="shell">
            <header className="topbar">
                <div className="brand">
                    <img src={icon} alt="" />
                    <span>Datera Dev</span>
                </div>
                <div className="topbar-file mono" title={configPath ?? ""}>
                    {configPath ? configPath : "nenhuma configuração aberta"}
                </div>
                <div className="topbar-actions">
                    <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setPalette(true)}
                    >
                        Comandos <kbd>Ctrl+K</kbd>
                    </button>
                    <button
                        type="button"
                        className="btn"
                        disabled={!configPath || running}
                        onClick={askExport}
                    >
                        Exportar
                    </button>
                    <button
                        type="button"
                        className="btn primary"
                        disabled={!configPath || running}
                        onClick={() => void runPipeline(true)}
                    >
                        {running ? "Rodando..." : "Prévia"}{" "}
                        <kbd>Ctrl+Enter</kbd>
                    </button>
                </div>
            </header>

            {!configPath ? (
                <Welcome
                    onOpen={() => void openConfig()}
                    onNew={() => void newConfig()}
                />
            ) : (
                <main className="workspace">
                    <section className="pane">
                        <nav className="tabs" aria-label="Arquivos">
                            <button
                                type="button"
                                className={
                                    activeFile === "config"
                                        ? "tab active"
                                        : "tab"
                                }
                                onClick={() => setActiveFile("config")}
                            >
                                {baseName(configPath)}
                                {configDirty && (
                                    <span
                                        className="dirty"
                                        aria-label="não salvo"
                                    />
                                )}
                            </button>
                            {modules.map((file) => (
                                <button
                                    key={file.path}
                                    type="button"
                                    className={
                                        activeFile === file.path
                                            ? "tab active"
                                            : "tab"
                                    }
                                    onClick={() => setActiveFile(file.path)}
                                >
                                    {baseName(file.path)}
                                    {file.text !== file.saved && (
                                        <span
                                            className="dirty"
                                            aria-label="não salvo"
                                        />
                                    )}
                                </button>
                            ))}
                        </nav>
                        {loadError && <p className="banner err">{loadError}</p>}
                        {activeModule ? (
                            <div className="module-view">
                                <CodeEditor
                                    key={activeModule.path}
                                    label={baseName(activeModule.path)}
                                    language="js"
                                    value={activeModule.text}
                                    onChange={(text) =>
                                        setModules((current) =>
                                            current.map((item) =>
                                                item.path === activeModule.path
                                                    ? { ...item, text }
                                                    : item,
                                            ),
                                        )
                                    }
                                />
                                <NormalizerTester
                                    names={normalizerNames}
                                    onTest={async (name, values) => {
                                        if (
                                            activeModule.text !==
                                                activeModule.saved &&
                                            !(await saveModule(activeModule))
                                        ) {
                                            return "Não foi possível salvar o arquivo.";
                                        }
                                        const result =
                                            await window.datera.testNormalizer(
                                                activeModule.path,
                                                name,
                                                values,
                                            );
                                        return result.ok
                                            ? result.results
                                            : result.error;
                                    }}
                                />
                            </div>
                        ) : (
                            <CodeEditor
                                label="Configuração"
                                language="json"
                                value={configText}
                                onChange={setConfigText}
                                errorLines={errorLines}
                                apiRef={editor}
                            />
                        )}
                    </section>

                    <section className="pane">
                        <nav className="tabs" aria-label="Saída" role="tablist">
                            {OUTPUT_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={outputTab === tab.id}
                                    className={
                                        outputTab === tab.id
                                            ? "tab active"
                                            : "tab"
                                    }
                                    onClick={() => setOutputTab(tab.id)}
                                    title={tab.keys}
                                >
                                    {tab.label}
                                    {tab.id === "problemas" &&
                                        check.problems.length > 0 && (
                                            <span className="count err">
                                                {check.problems.length}
                                            </span>
                                        )}
                                    {tab.id === "pendencias" &&
                                        report &&
                                        report.pendingRows > 0 && (
                                            <span className="count warn">
                                                {report.pendingRows}
                                            </span>
                                        )}
                                </button>
                            ))}
                        </nav>
                        <div className="output">
                            {outputTab === "resultado" && (
                                <ResultView record={record} />
                            )}
                            {outputTab === "pendencias" && (
                                <PendingView record={record} />
                            )}
                            {outputTab === "log" && (
                                <LogView
                                    log={log}
                                    record={record}
                                    running={running}
                                />
                            )}
                            {outputTab === "problemas" && (
                                <ProblemsView
                                    problems={check.problems}
                                    onGo={goToProblem}
                                />
                            )}
                        </div>
                    </section>
                </main>
            )}

            <footer className="statusbar mono">
                <span className={configDirty ? "warn" : ""}>
                    {configPath ? (configDirty ? "● não salvo" : "salvo") : "—"}
                </span>
                <span className={check.problems.length > 0 ? "err" : "ok"}>
                    {configPath
                        ? check.problems.length > 0
                            ? `${check.problems.length} problema(s)`
                            : "config válida"
                        : ""}
                </span>
                <span>{configPath ? describeFlow(check.value) : ""}</span>
                <span className="spacer" />
                {report && (
                    <span>
                        {report.dryRun ? "prévia" : "exportado"} ·{" "}
                        {report.rowsRead} lidas · {report.rowsOut} no resultado
                        · {report.pendingRows} pendências ·{" "}
                        {ms(report.durationMs)}
                    </span>
                )}
                {record && !record.ok && <span className="err">falhou</span>}
            </footer>

            {palette && (
                <CommandPalette
                    commands={commands}
                    onClose={() => setPalette(false)}
                />
            )}
            {confirming && (
                <ConfirmExport
                    dirty={configDirty}
                    onCancel={() => setConfirming(false)}
                    onConfirm={() => void confirmExport()}
                />
            )}
            {toast && (
                <div className="toast" role="status">
                    {toast}
                </div>
            )}
        </div>
    );
}

function Welcome({ onOpen, onNew }: { onOpen: () => void; onNew: () => void }) {
    return (
        <main className="welcome">
            <div>
                <h1>Nenhuma configuração aberta</h1>
                <p className="muted">
                    Abra um config.json existente ou crie um novo a partir de um
                    modelo.
                </p>
                <div className="welcome-actions">
                    <button
                        type="button"
                        className="btn primary"
                        onClick={onOpen}
                    >
                        Abrir configuração <kbd>Ctrl+O</kbd>
                    </button>
                    <button type="button" className="btn" onClick={onNew}>
                        Nova configuração <kbd>Ctrl+Shift+N</kbd>
                    </button>
                </div>
                <dl className="cheatsheet mono">
                    <div>
                        <dt>Ctrl+K</dt>
                        <dd>paleta de comandos</dd>
                    </div>
                    <div>
                        <dt>Ctrl+Enter</dt>
                        <dd>rodar prévia</dd>
                    </div>
                    <div>
                        <dt>Ctrl+Shift+Enter</dt>
                        <dd>exportar</dd>
                    </div>
                    <div>
                        <dt>Ctrl+S</dt>
                        <dd>salvar</dd>
                    </div>
                    <div>
                        <dt>Shift+Alt+F</dt>
                        <dd>formatar JSON</dd>
                    </div>
                    <div>
                        <dt>Ctrl+1 a 4</dt>
                        <dd>abas da saída</dd>
                    </div>
                </dl>
            </div>
        </main>
    );
}

function Empty({ text }: { text: string }) {
    return <p className="empty muted">{text}</p>;
}

function ResultView({ record }: { record: RunRecord | null }) {
    if (!record)
        return (
            <Empty text="Rode a prévia (Ctrl+Enter) para ver o resultado aqui." />
        );
    if (!record.ok || !record.report)
        return <Empty text="A última execução falhou. Veja o Log." />;
    if (!record.report.dryRun)
        return (
            <Empty text="Exportação feita. A tabela só aparece na prévia." />
        );
    return (
        <>
            <p className="caption mono">
                mostrando {record.report.preview.length} de{" "}
                {record.report.rowsOut} linhas
            </p>
            <DataTable rows={record.report.preview} />
        </>
    );
}

function PendingView({ record }: { record: RunRecord | null }) {
    const report = record?.report;
    if (!report) return <Empty text="Rode a prévia para ver as pendências." />;
    if (report.pendingRows === 0) return <Empty text="Nenhuma pendência." />;
    return (
        <>
            <table className="data reasons">
                <thead>
                    <tr>
                        <th>motivo</th>
                        <th className="num">linhas</th>
                    </tr>
                </thead>
                <tbody>
                    {report.pendingByReason.map((item) => (
                        <tr key={item.reason}>
                            <td>{item.reason}</td>
                            <td className="num">{item.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {report.pendingPreview.length > 0 && (
                <>
                    <p className="caption mono">
                        mostrando {report.pendingPreview.length} de{" "}
                        {report.pendingRows} pendências
                    </p>
                    <DataTable
                        rows={report.pendingPreview}
                        highlight="Motivo"
                    />
                </>
            )}
        </>
    );
}

function LogView({
    log,
    record,
    running,
}: {
    log: LogEntry[];
    record: RunRecord | null;
    running: boolean;
}) {
    const report = record?.report;
    return (
        <div className="log mono">
            {log.length === 0 && !running && <Empty text="Nada rodou ainda." />}
            {log.map((entry, index) => (
                <div key={index} className={`log-line ${entry.level}`}>
                    <span className="log-time">{time(entry.at)}</span>
                    <span className="log-level">{entry.level}</span>
                    <span>{entry.message}</span>
                </div>
            ))}
            {running && <div className="log-line info">…</div>}
            {record && !record.ok && (
                <div className="log-line error">{record.error}</div>
            )}
            {report && (
                <table className="data steps">
                    <thead>
                        <tr>
                            <th>etapa</th>
                            <th className="num">entrada</th>
                            <th className="num">saída</th>
                            <th className="num">pendências</th>
                            <th className="num">tempo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.steps.map((step) => (
                            <tr key={step.name}>
                                <td>{step.name}</td>
                                <td className="num">{step.rowsIn}</td>
                                <td className="num">{step.rowsOut}</td>
                                <td className="num">{step.pending}</td>
                                <td className="num">{ms(step.durationMs)}</td>
                            </tr>
                        ))}
                        <tr className="total">
                            <td>total</td>
                            <td className="num">{report.rowsRead}</td>
                            <td className="num">{report.rowsOut}</td>
                            <td className="num">{report.pendingRows}</td>
                            <td className="num">{ms(report.durationMs)}</td>
                        </tr>
                    </tbody>
                </table>
            )}
        </div>
    );
}

function ProblemsView({
    problems,
    onGo,
}: {
    problems: Problem[];
    onGo: (problem: Problem) => void;
}) {
    if (problems.length === 0)
        return <Empty text="Nenhum problema na configuração." />;
    return (
        <ul className="problems mono">
            {problems.map((problem, index) => (
                <li key={index}>
                    <button type="button" onClick={() => onGo(problem)}>
                        <span className="where">
                            {problem.line}:{problem.column}
                        </span>
                        {problem.where && (
                            <span className="path">{problem.where}</span>
                        )}
                        <span>{problem.message}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

function ConfirmExport({
    dirty,
    onCancel,
    onConfirm,
}: {
    dirty: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const confirmButton = useRef<HTMLButtonElement>(null);
    useEffect(() => confirmButton.current?.focus(), []);
    return (
        <div
            className="palette-overlay"
            onKeyDown={(event) => event.key === "Escape" && onCancel()}
        >
            <div
                className="confirm"
                role="dialog"
                aria-modal="true"
                aria-label="Confirmar exportação"
            >
                <h2>Exportar agora?</h2>
                <p className="muted">
                    O destino vai ser limpo e escrito de novo.
                    {dirty &&
                        " A configuração tem alterações e vai ser salva antes."}
                </p>
                <div className="confirm-actions">
                    <button
                        type="button"
                        className="btn ghost"
                        onClick={onCancel}
                    >
                        Cancelar <kbd>Esc</kbd>
                    </button>
                    <button
                        type="button"
                        className="btn primary"
                        ref={confirmButton}
                        onClick={onConfirm}
                    >
                        {dirty ? "Salvar e exportar" : "Exportar"}{" "}
                        <kbd>Enter</kbd>
                    </button>
                </div>
            </div>
        </div>
    );
}
