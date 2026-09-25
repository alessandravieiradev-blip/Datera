import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Notice } from "../components/Notice";
import { Panel } from "../components/Panel";
import { PageId } from "../components/Sidebar";
import {
    CONDITION_LABELS,
    Condition,
    EDITABLE_CONDITIONS,
    newId,
    problemOf,
    RuleDraft,
    rulesFromConfig,
    withRules,
} from "../lib/rules";
import { DateraState } from "../lib/useDatera";
import type { RawConfig } from "../../shared/api";

type Mode = "raw" | "dedupe" | "merge";

interface RulesPageProps {
    datera: DateraState;
    onNavigate: (page: PageId) => void;
}

type Status = { tone: "success" | "error"; text: string } | null;

export function RulesPage({ datera, onNavigate }: RulesPageProps) {
    const [config, setConfig] = useState<RawConfig | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<RuleDraft[]>([]);
    const [mode, setMode] = useState<Mode>("raw");
    const [dedupeColumn, setDedupeColumn] = useState("");
    const [columns, setColumns] = useState<string[]>([]);
    const [columnsError, setColumnsError] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>(null);
    const [saving, setSaving] = useState(false);
    const configPath = datera.settings.configPath;

    const loadFrom = (loaded: RawConfig) => {
        setConfig(loaded);
        setDrafts(rulesFromConfig(loaded));
        const loadedMode = loaded.mode;
        setMode(
            loadedMode === "dedupe" || loadedMode === "merge"
                ? loadedMode
                : "raw",
        );
        setDedupeColumn(
            typeof loaded.dedupeColumn === "string" ? loaded.dedupeColumn : "",
        );
    };

    useEffect(() => {
        if (configPath === null) return;
        setStatus(null);
        void window.datera.readConfig().then((result) => {
            if (result.ok) {
                setLoadError(null);
                loadFrom(result.config);
            } else {
                setLoadError(result.error);
            }
        });
        void window.datera.readColumns().then((result) => {
            if (result.ok) {
                setColumns(result.columns);
                setColumnsError(null);
            } else {
                setColumnsError(result.error);
            }
        });
    }, [configPath]);

    if (configPath === null) {
        return (
            <div className="page">
                <RulesHeader />
                <Notice
                    tone="info"
                    title="Primeiro escolha ou crie uma configuração."
                    action={
                        <button
                            type="button"
                            className="button primary"
                            onClick={() => onNavigate("assistente")}
                        >
                            Criar configuração
                        </button>
                    }
                />
            </div>
        );
    }

    const update = (id: string, change: Partial<RuleDraft>) => {
        setStatus(null);
        setDrafts((current) =>
            current.map((draft) =>
                draft.id === id ? { ...draft, ...change } : draft,
            ),
        );
    };
    const remove = (id: string) => {
        setStatus(null);
        setDrafts((current) => current.filter((draft) => draft.id !== id));
    };
    const add = () => {
        setStatus(null);
        setDrafts((current) => [
            ...current,
            { id: newId(), column: "", condition: "empty", values: "" },
        ]);
    };

    const canMerge =
        config !== null &&
        typeof config.mergeKeyColumn === "string" &&
        Array.isArray(config.mergeColumns);
    const problems = drafts.map(problemOf);
    const dedupeProblem = mode === "dedupe" && dedupeColumn.trim() === "";
    const hasProblems =
        problems.some((problem) => problem !== null) || dedupeProblem;

    const save = async () => {
        if (!config || hasProblems) return;
        setSaving(true);
        const next = withRules(config, drafts);
        next.mode = mode;
        if (mode === "dedupe") next.dedupeColumn = dedupeColumn.trim();
        const result = await window.datera.saveConfig(next);
        setSaving(false);
        if (result.ok) {
            datera.applySettings(result.settings);
            loadFrom(next);
            setStatus({
                tone: "success",
                text: "Regras salvas! Na próxima prévia elas já valem.",
            });
        } else {
            setStatus({ tone: "error", text: result.error });
        }
    };

    return (
        <div className="page">
            <RulesHeader />

            {loadError && (
                <Notice tone="error" title="Não consegui abrir a configuração.">
                    {loadError}
                </Notice>
            )}
            {columnsError && (
                <Notice
                    tone="warning"
                    title="Não consegui ler as colunas dos seus dados."
                >
                    Dá pra escrever o nome da coluna à mão. O motivo foi:{" "}
                    {columnsError}
                </Notice>
            )}

            <datalist id="colunas">
                {columns.map((column) => (
                    <option key={column} value={column} />
                ))}
            </datalist>

            <section className="rules">
                <h3>O que vai pra Pendências</h3>
                {drafts.length === 0 && (
                    <p className="muted">
                        Nenhuma regra ainda. Sem regras, todas as linhas vão pro
                        resultado.
                    </p>
                )}
                {drafts.map((draft, index) => (
                    <RuleRow
                        key={draft.id}
                        number={index + 1}
                        draft={draft}
                        problem={problems[index] ?? null}
                        onChange={(change) => update(draft.id, change)}
                        onRemove={() => remove(draft.id)}
                    />
                ))}
                <button type="button" className="add-rule" onClick={add}>
                    <span className="add-icon">+</span>
                    <span>
                        <strong>Adicionar regra</strong>
                        <small className="muted">
                            Crie uma nova regra pra separar o que precisa de
                            atenção.
                        </small>
                    </span>
                </button>
            </section>

            <Panel title="E os cadastros repetidos?">
                <div className="choices">
                    <label className="choice">
                        <input
                            type="radio"
                            name="modo"
                            checked={mode === "raw"}
                            onChange={() => setMode("raw")}
                        />
                        <span>Deixar como estão</span>
                    </label>
                    <label className="choice">
                        <input
                            type="radio"
                            name="modo"
                            checked={mode === "dedupe"}
                            onChange={() => setMode("dedupe")}
                        />
                        <span>Tirar os repetidos, olhando a coluna</span>
                        <input
                            className="field small-field"
                            list="colunas"
                            placeholder="coluna"
                            value={dedupeColumn}
                            onChange={(event) => {
                                setDedupeColumn(event.target.value);
                                setMode("dedupe");
                            }}
                        />
                    </label>
                    <label className={canMerge ? "choice" : "choice disabled"}>
                        <input
                            type="radio"
                            name="modo"
                            disabled={!canMerge}
                            checked={mode === "merge"}
                            onChange={() => setMode("merge")}
                        />
                        <span>
                            Juntar os repetidos numa linha só, sem perder nada
                            {!canMerge && (
                                <small className="muted">
                                    {" "}
                                    (por enquanto isso se configura no arquivo)
                                </small>
                            )}
                        </span>
                    </label>
                </div>
            </Panel>

            {status && <Notice tone={status.tone} title={status.text} />}

            <footer className="page-footer">
                <button
                    type="button"
                    className="button ghost"
                    onClick={() => config && loadFrom(config)}
                >
                    Desfazer alterações
                </button>
                <button
                    type="button"
                    className="button primary"
                    disabled={saving || hasProblems || !config}
                    onClick={save}
                >
                    {saving ? "Salvando..." : "Salvar regras"}
                </button>
            </footer>
        </div>
    );
}

function RulesHeader() {
    return (
        <header className="page-header">
            <div className="header-with-icon">
                <span className="header-icon">
                    <Icon name="rules" size={30} />
                </span>
                <div>
                    <span className="eyebrow">Regras de tratamento</span>
                    <h1>Configure suas regras</h1>
                    <p>
                        Defina o que o Datera deve separar pra alguém olhar,
                        usando frases simples.
                    </p>
                </div>
            </div>
            <aside className="tip">
                <Icon name="info" />
                <div>
                    <strong>Dica</strong>
                    <p className="small muted">
                        Tudo que cair numa regra vai pra Pendências, com o
                        motivo escrito do lado.
                    </p>
                </div>
            </aside>
        </header>
    );
}

interface RuleRowProps {
    number: number;
    draft: RuleDraft;
    problem: string | null;
    onChange: (change: Partial<RuleDraft>) => void;
    onRemove: () => void;
}

function RuleRow({ number, draft, problem, onChange, onRemove }: RuleRowProps) {
    const advanced = draft.condition === "advanced";
    const options: Condition[] = advanced
        ? ["advanced", ...EDITABLE_CONDITIONS]
        : EDITABLE_CONDITIONS;

    return (
        <div className="panel rule-row">
            <span className="rule-number">{number}</span>
            <span>Quando</span>
            <input
                className="field"
                list="colunas"
                placeholder="escolha a coluna"
                value={draft.column}
                aria-label="Coluna"
                onChange={(event) => onChange({ column: event.target.value })}
            />
            <span>estiver</span>
            <select
                className="field"
                value={draft.condition}
                aria-label="Condição"
                onChange={(event) =>
                    onChange({ condition: event.target.value as Condition })
                }
            >
                {options.map((condition) => (
                    <option key={condition} value={condition}>
                        {CONDITION_LABELS[condition]}
                    </option>
                ))}
            </select>
            {draft.condition === "list" && (
                <input
                    className="field"
                    placeholder="mensal, trimestral, anual"
                    value={draft.values}
                    aria-label="Valores aceitos"
                    onChange={(event) =>
                        onChange({ values: event.target.value })
                    }
                />
            )}
            <span>mandar para</span>
            <span className="chip">
                <Icon name="folder" size={18} />
                Pendências
            </span>
            <button
                type="button"
                className="icon-button"
                aria-label="Apagar regra"
                onClick={onRemove}
            >
                <Icon name="trash" size={20} />
            </button>
            {problem && <p className="rule-problem">{problem}</p>}
        </div>
    );
}
