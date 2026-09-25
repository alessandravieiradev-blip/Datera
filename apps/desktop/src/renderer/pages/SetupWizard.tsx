import { ReactNode, useState } from "react";
import { Icon, IconName } from "../components/Icon";
import { Notice } from "../components/Notice";
import { PageId } from "../components/Sidebar";
import { fileName } from "../lib/format";
import { DateraState } from "../lib/useDatera";
import {
    configFromDraft,
    DestinationKind,
    detailsProblem,
    EMPTY_DRAFT,
    SourceKind,
    usesGoogle,
    WizardDraft,
} from "../lib/wizard";
import type { FileKind } from "../../shared/api";

const STEPS = ["Fonte dos dados", "Destino", "Detalhes", "Pronto"];

interface Option<T> {
    id: T;
    title: string;
    text: string;
    icon: IconName;
}

const SOURCES: Option<SourceKind>[] = [
    {
        id: "excel",
        title: "Arquivo Excel",
        text: "Uma planilha do Excel (.xlsx) no seu computador.",
        icon: "file",
    },
    {
        id: "csv",
        title: "Arquivo CSV",
        text: "Um arquivo de texto separado por vírgula ou ponto e vírgula.",
        icon: "file",
    },
    {
        id: "sheets",
        title: "Google Planilhas",
        text: "Uma planilha do Google. Ela só é lida, nunca alterada.",
        icon: "rules",
    },
    {
        id: "mysql",
        title: "Banco de dados",
        text: "Uma tabela de um banco MySQL.",
        icon: "database",
    },
];

const DESTINATIONS: Option<DestinationKind>[] = [
    {
        id: "excel",
        title: "Arquivo Excel",
        text: "Gera um .xlsx com o resultado e uma aba de pendências.",
        icon: "file",
    },
    {
        id: "csv",
        title: "Arquivo CSV",
        text: "Gera um .csv com o resultado e outro com as pendências.",
        icon: "file",
    },
    {
        id: "sheets",
        title: "Google Planilhas",
        text: "Grava numa planilha do Google, com uma aba de pendências.",
        icon: "rules",
    },
];

const LABELS: Record<string, string> = {
    excel: "um arquivo Excel",
    csv: "um arquivo CSV",
    sheets: "uma planilha do Google",
    mysql: "um banco de dados",
};

interface SetupWizardProps {
    datera: DateraState;
    onNavigate: (page: PageId) => void;
}

export function SetupWizard({ datera, onNavigate }: SetupWizardProps) {
    const [step, setStep] = useState(0);
    const [draft, setDraft] = useState<WizardDraft>(EMPTY_DRAFT);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const set = (change: Partial<WizardDraft>) => {
        setError(null);
        setDraft((current) => ({ ...current, ...change }));
    };

    const blocker =
        step === 0
            ? draft.source
                ? null
                : "Escolha de onde vêm os dados."
            : step === 1
              ? draft.destination
                  ? null
                  : "Escolha onde salvar o resultado."
              : step === 2
                ? detailsProblem(draft)
                : null;

    const finish = async () => {
        setSaving(true);
        const result = await window.datera.createConfig(configFromDraft(draft));
        setSaving(false);
        if (result === null) return;
        if (!result.ok) {
            setError(result.error);
            return;
        }
        datera.applySettings(result.settings);
        onNavigate("regras");
    };

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">Configuração inicial</span>
                    <h1>Vamos começar!</h1>
                    <p>
                        Siga alguns passos simples para configurar o Datera e
                        deixar seus dados organizados.
                    </p>
                </div>
                <aside className="tip">
                    <Icon name="sparkle" />
                    <p className="small">
                        Em poucos minutos, tudo estará pronto para usar.
                    </p>
                </aside>
            </header>

            <ol className="stepper">
                {STEPS.map((label, index) => (
                    <li
                        key={label}
                        className={
                            index === step
                                ? "current"
                                : index < step
                                  ? "done"
                                  : ""
                        }
                    >
                        <span className="step-number">
                            {index < step ? (
                                <Icon
                                    name="check"
                                    size={16}
                                    strokeWidth={2.5}
                                />
                            ) : (
                                index + 1
                            )}
                        </span>
                        {label}
                    </li>
                ))}
            </ol>

            {step === 0 && (
                <ChoiceStep
                    title="De onde vêm seus dados?"
                    subtitle="Escolha a fonte dos dados que o Datera vai organizar."
                    options={SOURCES}
                    selected={draft.source}
                    onSelect={(source) => set({ source })}
                />
            )}
            {step === 1 && (
                <ChoiceStep
                    title="Onde salvar o resultado?"
                    subtitle="O destino é apagado e escrito de novo toda vez, então use um lugar só pro Datera."
                    options={DESTINATIONS}
                    selected={draft.destination}
                    onSelect={(destination) => set({ destination })}
                />
            )}
            {step === 2 && <DetailsStep draft={draft} set={set} />}
            {step === 3 && <SummaryStep draft={draft} />}

            {step === 0 && (
                <Notice tone="info" title="Não tem certeza de qual escolher?">
                    Se você baixou uma planilha, normalmente ela é um arquivo
                    Excel. Tudo isso pode ser alterado depois.
                </Notice>
            )}
            {error && (
                <Notice tone="error" title="Não foi possível salvar.">
                    {error}
                </Notice>
            )}

            <footer className="page-footer wizard-footer">
                <button
                    type="button"
                    className="button ghost"
                    onClick={() =>
                        step === 0 ? onNavigate("inicio") : setStep(step - 1)
                    }
                >
                    <Icon name="arrowLeft" size={18} />
                    Voltar
                </button>
                <div className="footer-right">
                    {blocker && step > 0 && (
                        <span className="muted small">{blocker}</span>
                    )}
                    {step < STEPS.length - 1 ? (
                        <button
                            type="button"
                            className="button primary"
                            disabled={blocker !== null}
                            onClick={() => setStep(step + 1)}
                        >
                            Próximo
                            <Icon name="arrowRight" size={18} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="button primary"
                            disabled={saving}
                            onClick={finish}
                        >
                            {saving ? "Salvando..." : "Salvar configuração"}
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}

interface ChoiceStepProps<T extends string> {
    title: string;
    subtitle: string;
    options: Option<T>[];
    selected: T | null;
    onSelect: (value: T) => void;
}

function ChoiceStep<T extends string>({
    title,
    subtitle,
    options,
    selected,
    onSelect,
}: ChoiceStepProps<T>) {
    return (
        <section className="step-body">
            <h2>{title}</h2>
            <p className="muted">{subtitle}</p>
            <div className="option-grid" role="radiogroup">
                {options.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected === option.id}
                        className={
                            selected === option.id
                                ? "option-card selected"
                                : "option-card"
                        }
                        onClick={() => onSelect(option.id)}
                    >
                        <span className="option-icon">
                            <Icon name={option.icon} size={32} />
                        </span>
                        <strong>{option.title}</strong>
                        <span className="muted small">{option.text}</span>
                        <span className="radio-dot" />
                    </button>
                ))}
            </div>
        </section>
    );
}

interface FieldProps {
    label: string;
    hint?: string;
    group?: boolean;
    children: ReactNode;
}

function Field({ label, hint, group, children }: FieldProps) {
    const content = (
        <>
            <span className="form-label">{label}</span>
            {children}
            {hint && <span className="muted small">{hint}</span>}
        </>
    );
    return group ? (
        <div className="form-field" role="group" aria-label={label}>
            {content}
        </div>
    ) : (
        <label className="form-field">{content}</label>
    );
}

function FilePicker({
    value,
    kind,
    save,
    onPick,
}: {
    value: string;
    kind: FileKind;
    save?: boolean;
    onPick: (path: string) => void;
}) {
    const pick = async () => {
        const chosen = save
            ? await window.datera.pickSaveFile(kind)
            : await window.datera.pickFile(kind);
        if (chosen) onPick(chosen);
    };
    return (
        <div className="file-picker">
            <span className={value ? "" : "muted"} title={value}>
                {value ? fileName(value) : "Nenhum arquivo escolhido"}
            </span>
            <button type="button" className="button secondary" onClick={pick}>
                {value
                    ? "Trocar"
                    : save
                      ? "Escolher onde salvar"
                      : "Escolher arquivo"}
            </button>
        </div>
    );
}

function DetailsStep({
    draft,
    set,
}: {
    draft: WizardDraft;
    set: (change: Partial<WizardDraft>) => void;
}) {
    return (
        <section className="step-body">
            <h2>Só mais uns detalhes</h2>
            <p className="muted">
                Diga onde estão os dados e onde o resultado vai ficar.
            </p>
            <div className="grid-two">
                <div className="panel form">
                    <h3>De onde ler</h3>
                    {(draft.source === "excel" || draft.source === "csv") && (
                        <Field label="Arquivo" group>
                            <FilePicker
                                value={draft.sourcePath}
                                kind={draft.source}
                                onPick={(sourcePath) => set({ sourcePath })}
                            />
                        </Field>
                    )}
                    {draft.source === "excel" && (
                        <Field
                            label="Aba (opcional)"
                            hint="Se deixar vazio, ele lê a primeira aba."
                        >
                            <input
                                className="field"
                                value={draft.sourceSheet}
                                onChange={(event) =>
                                    set({ sourceSheet: event.target.value })
                                }
                            />
                        </Field>
                    )}
                    {draft.source === "sheets" && (
                        <>
                            <Field
                                label="Link da planilha"
                                hint="Copie da barra de endereço do navegador."
                            >
                                <input
                                    className="field"
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                    value={draft.sourceLink}
                                    onChange={(event) =>
                                        set({ sourceLink: event.target.value })
                                    }
                                />
                            </Field>
                            <Field
                                label="Aba (opcional)"
                                hint="Se deixar vazio, ele lê a primeira aba."
                            >
                                <input
                                    className="field"
                                    value={draft.sourceSheet}
                                    onChange={(event) =>
                                        set({ sourceSheet: event.target.value })
                                    }
                                />
                            </Field>
                        </>
                    )}
                    {draft.source === "mysql" && (
                        <div className="form-grid">
                            <Field label="Servidor">
                                <input
                                    className="field"
                                    value={draft.host}
                                    onChange={(event) =>
                                        set({ host: event.target.value })
                                    }
                                />
                            </Field>
                            <Field label="Porta">
                                <input
                                    className="field"
                                    inputMode="numeric"
                                    value={draft.port}
                                    onChange={(event) =>
                                        set({ port: event.target.value })
                                    }
                                />
                            </Field>
                            <Field label="Usuário">
                                <input
                                    className="field"
                                    value={draft.user}
                                    onChange={(event) =>
                                        set({ user: event.target.value })
                                    }
                                />
                            </Field>
                            <Field
                                label="Senha"
                                hint="Fica salva no arquivo de configuração."
                            >
                                <input
                                    className="field"
                                    type="password"
                                    value={draft.password}
                                    onChange={(event) =>
                                        set({ password: event.target.value })
                                    }
                                />
                            </Field>
                            <Field label="Banco">
                                <input
                                    className="field"
                                    value={draft.database}
                                    onChange={(event) =>
                                        set({ database: event.target.value })
                                    }
                                />
                            </Field>
                            <Field label="Tabela">
                                <input
                                    className="field"
                                    value={draft.table}
                                    onChange={(event) =>
                                        set({ table: event.target.value })
                                    }
                                />
                            </Field>
                        </div>
                    )}
                </div>
                <div className="panel form">
                    <h3>Onde salvar</h3>
                    {(draft.destination === "excel" ||
                        draft.destination === "csv") && (
                        <Field
                            label="Arquivo do resultado"
                            hint="As pendências ficam do lado, no mesmo lugar."
                            group
                        >
                            <FilePicker
                                value={draft.destinationPath}
                                kind={draft.destination}
                                save
                                onPick={(destinationPath) =>
                                    set({ destinationPath })
                                }
                            />
                        </Field>
                    )}
                    {draft.destination === "sheets" && (
                        <>
                            <Field
                                label="Link da planilha"
                                hint="De preferência, uma planilha diferente da original."
                            >
                                <input
                                    className="field"
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                    value={draft.destinationLink}
                                    onChange={(event) =>
                                        set({
                                            destinationLink: event.target.value,
                                        })
                                    }
                                />
                            </Field>
                            <Field
                                label="Aba do resultado (opcional)"
                                hint="Se deixar vazio, ele usa a primeira aba."
                            >
                                <input
                                    className="field"
                                    value={draft.destinationSheet}
                                    onChange={(event) =>
                                        set({
                                            destinationSheet:
                                                event.target.value,
                                        })
                                    }
                                />
                            </Field>
                        </>
                    )}
                    {usesGoogle(draft) && (
                        <Field
                            group
                            label="Credenciais do Google"
                            hint="É o arquivo .json da conta de serviço. As planilhas precisam estar compartilhadas com o e-mail dela."
                        >
                            <FilePicker
                                value={draft.credentialsPath}
                                kind="credentials"
                                onPick={(credentialsPath) =>
                                    set({ credentialsPath })
                                }
                            />
                        </Field>
                    )}
                </div>
            </div>
        </section>
    );
}

function SummaryStep({ draft }: { draft: WizardDraft }) {
    return (
        <section className="step-body">
            <h2>Tudo pronto!</h2>
            <p className="muted">Confere se ficou do jeito que você queria:</p>
            <div className="panel summary">
                <p>
                    <Icon name="database" />
                    <span>
                        O Datera vai ler {LABELS[draft.source ?? ""]}
                        {draft.sourcePath && (
                            <strong> ({fileName(draft.sourcePath)})</strong>
                        )}
                        {draft.source === "mysql" && (
                            <strong> (tabela {draft.table})</strong>
                        )}
                        . Ele só lê, nunca altera.
                    </span>
                </p>
                <p>
                    <Icon name="upload" />
                    <span>
                        E vai salvar o resultado em{" "}
                        {LABELS[draft.destination ?? ""]}
                        {draft.destinationPath && (
                            <strong>
                                {" "}
                                ({fileName(draft.destinationPath)})
                            </strong>
                        )}
                        .
                    </span>
                </p>
                <p>
                    <Icon name="rules" />
                    <span>
                        Depois de salvar, você vai para tela de Regras para
                        dizer o que deve ir para Pendências.
                    </span>
                </p>
            </div>
            <p className="muted small">
                Quando clicar em salvar, ele pergunta onde guardar o arquivo de
                configuração. Pode ser em qualquer pasta.
            </p>
        </section>
    );
}
