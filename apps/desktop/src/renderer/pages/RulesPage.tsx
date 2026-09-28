import { useEffect, useRef, useState } from "react";
import { CustomRuleDialog } from "../components/CustomRuleDialog";
import { Icon } from "../components/Icon";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
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
import { ActionId, hint, Shortcuts } from "../lib/shortcuts";
import type { Command } from "../App";
import type { RawConfig } from "../../shared/api";

type Mode = "raw" | "dedupe" | "merge";

interface RulesPageProps {
    datera: DateraState;
    onNavigate: (page: PageId) => void;
    command: Command | null;
    shortcuts: Shortcuts;
    notify: (text: string) => void;
    onDirtyChange: (dirty: boolean) => void;
}

function snapshotOf(drafts: RuleDraft[], mode: string, column: string): string {
    return JSON.stringify({
        rules: drafts.map((draft) => ({ ...draft, id: "" })),
        mode,
        column: mode === "dedupe" ? column.trim() : "",
    });
}

function blankRule(): RuleDraft {
    return { id: newId(), column: "", condition: "empty", values: "" };
}

type Status = { tone: "success" | "error"; text: string } | null;

export function RulesPage({
    datera,
    onNavigate,
    command,
    shortcuts,
    notify,
    onDirtyChange,
}: RulesPageProps) {
    const [config, setConfig] = useState<RawConfig | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<RuleDraft[]>([]);
    const [mode, setMode] = useState<Mode>("raw");
    const [dedupeColumn, setDedupeColumn] = useState("");
    const [columns, setColumns] = useState<string[]>([]);
    const [columnsError, setColumnsError] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>(null);
    const [saving, setSaving] = useState(false);
    const [dialogFor, setDialogFor] = useState<string | null>(null);
    const actions = useRef<Partial<Record<ActionId, () => void>>>({});
    const pendingAdd = useRef(false);
    const baseline = useRef("");
    const configPath = datera.settings.configPath;

    const loadFrom = (loaded: RawConfig) => {
        const loadedDrafts = rulesFromConfig(loaded);
        const loadedMode =
            loaded.mode === "dedupe" || loaded.mode === "merge"
                ? loaded.mode
                : "raw";
        const loadedColumn =
            typeof loaded.dedupeColumn === "string" ? loaded.dedupeColumn : "";
        baseline.current = snapshotOf(loadedDrafts, loadedMode, loadedColumn);
        setConfig(loaded);
        setDrafts(loadedDrafts);
        setMode(loadedMode);
        setDedupeColumn(loadedColumn);
    };

    useEffect(() => {
        onDirtyChange(
            config !== null &&
                snapshotOf(drafts, mode, dedupeColumn) !== baseline.current,
        );
    }, [config, drafts, mode, dedupeColumn]);

    useEffect(() => () => onDirtyChange(false), []);

    useEffect(() => {
        if (configPath === null) return;
        setStatus(null);
        void window.datera.readConfig().then((result) => {
            if (result.ok) {
                setLoadError(null);
                loadFrom(result.config);
                if (pendingAdd.current) {
                    pendingAdd.current = false;
                    setDrafts((current) => [...current, blankRule()]);
                }
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

    useEffect(() => {
        if (!command) return;
        actions.current[command.id]?.();
    }, [command?.seq]);

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
        setDrafts((current) => [...current, blankRule()]);
    };

    const dialogDraft = drafts.find((draft) => draft.id === dialogFor);
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
                text: "Regras salvas. Elas já valem na próxima prévia.",
            });
            notify("Regras salvas.");
        } else {
            setStatus({ tone: "error", text: result.error });
        }
    };

    const undo = () => {
        if (!config) return;
        loadFrom(config);
        setStatus(null);
        notify("Alterações desfeitas.");
    };

    actions.current = {
        "adicionar-regra": () => {
            if (config === null) pendingAdd.current = true;
            else add();
        },
        "salvar-regras": () => {
            if (hasProblems)
                notify("Corrija as regras marcadas antes de salvar.");
            else void save();
        },
        "desfazer-regras": undo,
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
                    Você pode digitar o nome da coluna. Motivo: {columnsError}
                </Notice>
            )}

            <datalist id="colunas">
                {columns.map((column) => (
                    <option key={column} value={column} />
                ))}
            </datalist>

            <section className="rules" aria-labelledby="regras-titulo">
                <div className="section-head">
                    <h2 className="section-heading" id="regras-titulo">
                        O que vai para Pendências
                    </h2>
                    <button
                        type="button"
                        className="button secondary small-button"
                        onClick={add}
                        title={`Adicionar regra${hint(shortcuts, "adicionar-regra")}`}
                    >
                        Adicionar regra
                    </button>
                </div>
                {drafts.length === 0 && (
                    <p className="muted">
                        Nenhuma regra ainda. Sem regras, todas as linhas vão
                        para o resultado.
                    </p>
                )}
                {drafts.length > 0 && (
                    <div className="rule-list">
                        {drafts.map((draft, index) => (
                            <RuleRow
                                key={draft.id}
                                number={index + 1}
                                draft={draft}
                                problem={problems[index] ?? null}
                                onChange={(change) => update(draft.id, change)}
                                onRemove={() => remove(draft.id)}
                                onCustom={() => setDialogFor(draft.id)}
                            />
                        ))}
                    </div>
                )}
            </section>

            <Panel title="Cadastros repetidos">
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
                    <div className="choice-row">
                        <label className="choice">
                            <input
                                type="radio"
                                name="modo"
                                checked={mode === "dedupe"}
                                onChange={() => setMode("dedupe")}
                            />
                            <span>Tirar os repetidos, olhando a coluna</span>
                        </label>
                        <input
                            className="field small-field dedupe-column"
                            list="colunas"
                            placeholder="Ex.: matricula…"
                            aria-label="Coluna usada para tirar os repetidos"
                            aria-invalid={dedupeProblem || undefined}
                            spellCheck={false}
                            autoComplete="off"
                            value={dedupeColumn}
                            onChange={(event) => {
                                setDedupeColumn(event.target.value);
                                setMode("dedupe");
                            }}
                        />
                    </div>
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

            {dialogDraft && (
                <CustomRuleDialog
                    draft={dialogDraft}
                    onClose={() => setDialogFor(null)}
                    onApply={(change) => {
                        update(dialogDraft.id, change);
                        setDialogFor(null);
                    }}
                />
            )}

            <footer className="page-footer">
                <button
                    type="button"
                    className="button ghost"
                    onClick={undo}
                    title={`Desfazer alterações${hint(shortcuts, "desfazer-regras")}`}
                >
                    Desfazer alterações
                </button>
                <button
                    type="button"
                    className="button primary"
                    disabled={saving || hasProblems || !config}
                    onClick={save}
                    title={`Salvar regras${hint(shortcuts, "salvar-regras")}`}
                >
                    {saving ? "Salvando…" : "Salvar regras"}
                </button>
            </footer>
        </div>
    );
}

function RulesHeader() {
    return (
        <PageHeader
            title="Regras"
            meta="Toda linha que cair numa regra vai para Pendências, com o motivo ao lado."
        />
    );
}

interface RuleRowProps {
    number: number;
    draft: RuleDraft;
    problem: string | null;
    onChange: (change: Partial<RuleDraft>) => void;
    onRemove: () => void;
    onCustom: () => void;
}

const OTHER = "outra";

function RuleRow({
    number,
    draft,
    problem,
    onChange,
    onRemove,
    onCustom,
}: RuleRowProps) {
    const options: Condition[] = EDITABLE_CONDITIONS.includes(draft.condition)
        ? EDITABLE_CONDITIONS
        : [draft.condition, ...EDITABLE_CONDITIONS];
    const custom =
        draft.condition === "pattern" || draft.condition === "normalizer";
    const problemId = `problema-regra-${draft.id}`;
    const invalid = problem !== null;

    return (
        <div className="rule-row">
            <span className="rule-number">{number}</span>
            <span>Quando</span>
            <input
                className="field"
                list="colunas"
                placeholder="Escolha a coluna"
                value={draft.column}
                aria-label={`Coluna da regra ${number}`}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? problemId : undefined}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => onChange({ column: event.target.value })}
            />
            <span>estiver</span>
            <select
                className="field"
                value={draft.condition}
                aria-label={`Condição da regra ${number}`}
                onChange={(event) => {
                    if (event.target.value === OTHER) onCustom();
                    else
                        onChange({
                            condition: event.target.value as Condition,
                        });
                }}
            >
                {options.map((condition) => (
                    <option key={condition} value={condition}>
                        {CONDITION_LABELS[condition]}
                    </option>
                ))}
                <option value={OTHER}>Outra regra…</option>
            </select>
            {custom && (
                <button
                    type="button"
                    className="chip-button"
                    aria-label={`Editar a regra ${number}`}
                    onClick={onCustom}
                >
                    <code>
                        {draft.condition === "pattern"
                            ? draft.pattern
                            : draft.normalizer}
                    </code>
                    Editar
                </button>
            )}
            {draft.condition === "list" && (
                <input
                    className="field"
                    placeholder="mensal, trimestral, anual"
                    value={draft.values}
                    aria-label={`Valores aceitos na regra ${number}`}
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? problemId : undefined}
                    onChange={(event) =>
                        onChange({ values: event.target.value })
                    }
                />
            )}
            <button
                type="button"
                className="icon-button"
                aria-label={`Apagar a regra ${number}`}
                onClick={onRemove}
            >
                <Icon name="trash" size={18} />
            </button>
            {problem && (
                <p className="rule-problem" id={problemId}>
                    {problem}
                </p>
            )}
        </div>
    );
}
