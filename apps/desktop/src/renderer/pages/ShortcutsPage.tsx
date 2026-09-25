import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Keys } from "../components/Keys";
import { Notice } from "../components/Notice";
import { Panel } from "../components/Panel";
import {
    ACTIONS,
    ActionId,
    ActionInfo,
    comboFromEvent,
    comboProblem,
    conflictOf,
    defaultShortcuts,
    GROUPS,
    Shortcuts,
} from "../lib/shortcuts";
import { DateraState } from "../lib/useDatera";

interface ShortcutsPageProps {
    datera: DateraState;
    shortcuts: Shortcuts;
    onCapture: (active: boolean) => void;
    notify: (text: string) => void;
}

interface Pending {
    id: ActionId;
    combo: string;
    conflict: ActionInfo;
}

const DEFAULTS = defaultShortcuts();

export function ShortcutsPage({
    datera,
    shortcuts,
    onCapture,
    notify,
}: ShortcutsPageProps) {
    const [editing, setEditing] = useState<ActionId | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const [pending, setPending] = useState<Pending | null>(null);

    const save = async (next: Shortcuts) => {
        const changed: Record<string, string> = {};
        for (const action of ACTIONS) {
            if (next[action.id] !== DEFAULTS[action.id])
                changed[action.id] = next[action.id];
        }
        datera.applySettings(await window.datera.setShortcuts(changed));
    };

    const stopEditing = () => {
        setEditing(null);
        onCapture(false);
    };

    useEffect(() => {
        if (editing === null) return;
        onCapture(true);
        const onKey = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (
                event.key === "Escape" &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.shiftKey
            ) {
                stopEditing();
                setProblem(null);
                return;
            }
            const combo = comboFromEvent(event);
            if (!combo) return;
            const issue = comboProblem(combo);
            if (issue) {
                setProblem(issue);
                return;
            }
            setProblem(null);
            stopEditing();
            const conflict = conflictOf(shortcuts, combo, editing);
            if (conflict) {
                setPending({ id: editing, combo, conflict });
                return;
            }
            void save({ ...shortcuts, [editing]: combo }).then(() =>
                notify(`Atalho alterado para ${combo}.`),
            );
        };
        window.addEventListener("keydown", onKey, true);
        return () => {
            window.removeEventListener("keydown", onKey, true);
            onCapture(false);
        };
    }, [editing, shortcuts]);

    const replace = async () => {
        if (!pending) return;
        await save({
            ...shortcuts,
            [pending.conflict.id]: "",
            [pending.id]: pending.combo,
        });
        notify(
            `${pending.combo} agora é de outra função. "${pending.conflict.label}" ficou sem atalho.`,
        );
        setPending(null);
    };

    const customized = ACTIONS.some(
        (action) => shortcuts[action.id] !== DEFAULTS[action.id],
    );

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">Atalhos</span>
                    <h1>Atalhos do teclado</h1>
                    <p>
                        Use o teclado para ir mais rápido. Para trocar um
                        atalho, clique em Alterar e pressione a nova combinação.
                    </p>
                </div>
                <button
                    type="button"
                    className="button secondary"
                    disabled={!customized}
                    onClick={async () => {
                        await save(DEFAULTS);
                        notify("Atalhos padrão restaurados.");
                    }}
                >
                    <Icon name="reset" size={18} />
                    Restaurar padrões
                </button>
            </header>

            {problem && (
                <Notice
                    tone="warning"
                    title="Essa combinação não pode ser usada."
                >
                    {problem}
                </Notice>
            )}
            {pending && (
                <Notice
                    tone="warning"
                    title={`${pending.combo} já é usado em "${pending.conflict.label}".`}
                    action={
                        <div className="notice-actions">
                            <button
                                type="button"
                                className="button ghost"
                                onClick={() => setPending(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="button primary"
                                onClick={() => void replace()}
                            >
                                Usar mesmo assim
                            </button>
                        </div>
                    }
                >
                    Se continuar, a outra função fica sem atalho.
                </Notice>
            )}

            {GROUPS.map((group) => (
                <Panel key={group} title={group}>
                    <ul className="shortcut-list">
                        {ACTIONS.filter((action) => action.group === group).map(
                            (action) => {
                                const combo = shortcuts[action.id];
                                const isEditing = editing === action.id;
                                const changed = combo !== DEFAULTS[action.id];
                                return (
                                    <li
                                        key={action.id}
                                        className={isEditing ? "editing" : ""}
                                    >
                                        <div className="shortcut-text">
                                            <strong>{action.label}</strong>
                                            <span className="muted small">
                                                {action.description}
                                            </span>
                                        </div>
                                        <div
                                            className="shortcut-combo"
                                            aria-live="polite"
                                        >
                                            {isEditing ? (
                                                <span className="capturing">
                                                    Pressione a combinação (Esc
                                                    cancela)
                                                </span>
                                            ) : (
                                                <Keys combo={combo} />
                                            )}
                                        </div>
                                        <div className="shortcut-actions">
                                            <button
                                                type="button"
                                                className="button secondary small-button"
                                                onClick={() => {
                                                    setProblem(null);
                                                    setPending(null);
                                                    setEditing(
                                                        isEditing
                                                            ? null
                                                            : action.id,
                                                    );
                                                }}
                                            >
                                                {isEditing
                                                    ? "Cancelar"
                                                    : "Alterar"}
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-button"
                                                aria-label={`Remover atalho de ${action.label}`}
                                                title="Remover atalho"
                                                disabled={combo === ""}
                                                onClick={() =>
                                                    void save({
                                                        ...shortcuts,
                                                        [action.id]: "",
                                                    })
                                                }
                                            >
                                                <Icon name="close" size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-button"
                                                aria-label={`Voltar ao padrão de ${action.label}`}
                                                title={`Voltar ao padrão (${DEFAULTS[action.id]})`}
                                                disabled={!changed}
                                                onClick={() =>
                                                    void save({
                                                        ...shortcuts,
                                                        [action.id]:
                                                            DEFAULTS[action.id],
                                                    })
                                                }
                                            >
                                                <Icon name="reset" size={18} />
                                            </button>
                                        </div>
                                    </li>
                                );
                            },
                        )}
                    </ul>
                </Panel>
            ))}
        </div>
    );
}
