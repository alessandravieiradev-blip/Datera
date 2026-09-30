import {
    KeyboardEvent,
    ReactNode,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";
import { Icon } from "../components/Icon";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { PageId } from "../components/Sidebar";
import { fileName } from "../lib/format";
import { DateraState } from "../lib/useDatera";
import {
    configFromDraft,
    DatabaseKind,
    DEFAULT_PORTS,
    DestinationKind,
    detailsProblem,
    EMPTY_DRAFT,
    SourceKind,
    usesFile,
    usesGoogle,
    usesSameServer,
    WizardDraft,
} from "../lib/wizard";
import type { FileKind } from "../../shared/api";

const STEPS = ["Fonte dos dados", "Destino", "Detalhes", "Pronto"];

interface Option<T> {
    id: T;
    title: string;
    text: string;
}

const SOURCES: Option<SourceKind>[] = [
    {
        id: "excel",
        title: "Arquivo Excel",
        text: "Uma planilha do Excel (.xlsx) no seu computador.",
    },
    {
        id: "csv",
        title: "Arquivo CSV",
        text: "Um arquivo de texto separado por vírgula ou ponto e vírgula.",
    },
    {
        id: "xml",
        title: "Arquivo XML",
        text: "Um arquivo .xml, como os exportados por muitos sistemas.",
    },
    {
        id: "sheets",
        title: "Google Planilhas",
        text: "Uma planilha do Google. Ela só é lida, nunca alterada.",
    },
    {
        id: "database",
        title: "Banco de dados",
        text: "Uma tabela de um banco MySQL, PostgreSQL ou SQL Server.",
    },
    {
        id: "sqlite",
        title: "Arquivo SQLite",
        text: "Um arquivo de banco de dados (.db ou .sqlite) no seu computador.",
    },
];

const DESTINATIONS: Option<DestinationKind>[] = [
    {
        id: "excel",
        title: "Arquivo Excel",
        text: "Gera um .xlsx com o resultado e uma aba de pendências.",
    },
    {
        id: "csv",
        title: "Arquivo CSV",
        text: "Gera um .csv com o resultado e outro com as pendências.",
    },
    {
        id: "xml",
        title: "Arquivo XML",
        text: "Gera um .xml com o resultado e outro com as pendências.",
    },
    {
        id: "sheets",
        title: "Google Planilhas",
        text: "Grava numa planilha do Google, com uma aba de pendências.",
    },
    {
        id: "database",
        title: "Banco de dados",
        text: "Cria uma tabela nova num banco MySQL, PostgreSQL ou SQL Server, e outra para as pendências.",
    },
    {
        id: "sqlite",
        title: "Arquivo SQLite",
        text: "Cria uma tabela num arquivo .db, e outra para as pendências.",
    },
];

const LABELS: Record<string, string> = {
    excel: "um arquivo Excel",
    csv: "um arquivo CSV",
    xml: "um arquivo XML",
    sheets: "uma planilha do Google",
    database: "um banco de dados",
    sqlite: "um arquivo SQLite",
};

interface SetupWizardProps {
    datera: DateraState;
    onNavigate: (page: PageId) => void;
}

export function SetupWizard({ datera, onNavigate }: SetupWizardProps) {
    const [step, setStep] = useState(0);
    const [draft, setDraft] = useState<WizardDraft>(EMPTY_DRAFT);
    const pageRef = useRef<HTMLDivElement>(null);
    const firstStep = useRef(true);

    useEffect(() => {
        if (firstStep.current) {
            firstStep.current = false;
            return;
        }
        pageRef.current?.querySelector<HTMLElement>(".step-body h2")?.focus();
    }, [step]);
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
        <div className="page" ref={pageRef}>
            <PageHeader
                title="Nova configuração"
                meta="De onde ler, onde salvar e os detalhes de acesso. Tudo pode ser mudado depois."
            />

            <ol className="stepper">
                {STEPS.map((label, index) => (
                    <li
                        key={label}
                        aria-current={index === step ? "step" : undefined}
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
                    subtitle="O destino é apagado e escrito de novo toda vez, então use um lugar só para o Datera."
                    options={DESTINATIONS}
                    selected={draft.destination}
                    onSelect={(destination) => set({ destination })}
                />
            )}
            {step === 2 && <DetailsStep draft={draft} set={set} />}
            {step === 3 && <SummaryStep draft={draft} />}

            {step === 0 && (
                <p className="muted small">
                    Se você baixou uma planilha, normalmente ela é um arquivo
                    Excel.
                </p>
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
                    Voltar
                </button>
                <div className="footer-right">
                    <span className="muted small" role="status">
                        {blocker && step > 0 ? blocker : ""}
                    </span>
                    {step < STEPS.length - 1 ? (
                        <button
                            type="button"
                            className="button primary"
                            disabled={blocker !== null}
                            onClick={() => setStep(step + 1)}
                        >
                            Próximo
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="button primary"
                            disabled={saving}
                            onClick={finish}
                        >
                            {saving ? "Salvando…" : "Salvar configuração"}
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
    const titleId = useId();
    const focusIndex = Math.max(
        options.findIndex((option) => option.id === selected),
        0,
    );

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const moves: Record<string, number> = {
            ArrowRight: 1,
            ArrowDown: 1,
            ArrowLeft: -1,
            ArrowUp: -1,
        };
        const move = moves[event.key];
        if (move === undefined) return;
        event.preventDefault();
        const next = (focusIndex + move + options.length) % options.length;
        const option = options[next];
        if (!option) return;
        onSelect(option.id);
        const buttons =
            event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
        buttons[next]?.focus();
    };

    return (
        <section className="step-body">
            <h2 id={titleId} tabIndex={-1}>
                {title}
            </h2>
            <p className="muted">{subtitle}</p>
            <div
                className="option-list"
                role="radiogroup"
                aria-labelledby={titleId}
                onKeyDown={onKeyDown}
            >
                {options.map((option, index) => (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        tabIndex={index === focusIndex ? 0 : -1}
                        aria-checked={selected === option.id}
                        className={
                            selected === option.id
                                ? "option-row selected"
                                : "option-row"
                        }
                        onClick={() => onSelect(option.id)}
                    >
                        <span className="radio-dot" aria-hidden="true" />
                        <span className="option-text">
                            <strong>{option.title}</strong>
                            <span className="muted small">{option.text}</span>
                        </span>
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

interface ServerValues {
    kind: DatabaseKind;
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
}

function sourceServer(draft: WizardDraft): ServerValues {
    return {
        kind: draft.databaseKind,
        host: draft.host,
        port: draft.port,
        user: draft.user,
        password: draft.password,
        database: draft.database,
    };
}

function fromSourceServer(change: Partial<ServerValues>): Partial<WizardDraft> {
    return {
        ...(change.kind !== undefined ? { databaseKind: change.kind } : {}),
        ...(change.host !== undefined ? { host: change.host } : {}),
        ...(change.port !== undefined ? { port: change.port } : {}),
        ...(change.user !== undefined ? { user: change.user } : {}),
        ...(change.password !== undefined ? { password: change.password } : {}),
        ...(change.database !== undefined ? { database: change.database } : {}),
    };
}

function destinationServer(draft: WizardDraft): ServerValues {
    return {
        kind: draft.destinationDatabaseKind,
        host: draft.destinationHost,
        port: draft.destinationPort,
        user: draft.destinationUser,
        password: draft.destinationPassword,
        database: draft.destinationDatabase,
    };
}

function fromDestinationServer(
    change: Partial<ServerValues>,
): Partial<WizardDraft> {
    return {
        ...(change.kind !== undefined
            ? { destinationDatabaseKind: change.kind }
            : {}),
        ...(change.host !== undefined ? { destinationHost: change.host } : {}),
        ...(change.port !== undefined ? { destinationPort: change.port } : {}),
        ...(change.user !== undefined ? { destinationUser: change.user } : {}),
        ...(change.password !== undefined
            ? { destinationPassword: change.password }
            : {}),
        ...(change.database !== undefined
            ? { destinationDatabase: change.database }
            : {}),
    };
}

function ServerFields({
    values,
    onChange,
}: {
    values: ServerValues;
    onChange: (change: Partial<ServerValues>) => void;
}) {
    return (
        <>
            <Field label="Tipo de banco">
                <select
                    className="field"
                    value={values.kind}
                    onChange={(event) => {
                        const kind = event.target.value as DatabaseKind;
                        onChange({
                            kind,
                            port:
                                values.port === DEFAULT_PORTS[values.kind]
                                    ? DEFAULT_PORTS[kind]
                                    : values.port,
                        });
                    }}
                >
                    <option value="mysql">MySQL</option>
                    <option value="postgres">PostgreSQL</option>
                    <option value="sqlserver">SQL Server</option>
                </select>
            </Field>
            <Field label="Servidor">
                <input
                    className="field"
                    spellCheck={false}
                    autoComplete="off"
                    value={values.host}
                    onChange={(event) => onChange({ host: event.target.value })}
                />
            </Field>
            <Field label="Porta">
                <input
                    className="field"
                    spellCheck={false}
                    autoComplete="off"
                    inputMode="numeric"
                    value={values.port}
                    onChange={(event) => onChange({ port: event.target.value })}
                />
            </Field>
            <Field label="Usuário">
                <input
                    className="field"
                    spellCheck={false}
                    autoComplete="off"
                    value={values.user}
                    onChange={(event) => onChange({ user: event.target.value })}
                />
            </Field>
            <Field
                label="Senha"
                hint="Fica salva num arquivo .env ao lado da configuração, e não dentro dela."
            >
                <input
                    className="field"
                    spellCheck={false}
                    autoComplete="off"
                    type="password"
                    value={values.password}
                    onChange={(event) =>
                        onChange({ password: event.target.value })
                    }
                />
            </Field>
            <Field label="Banco">
                <input
                    className="field"
                    spellCheck={false}
                    autoComplete="off"
                    value={values.database}
                    onChange={(event) =>
                        onChange({ database: event.target.value })
                    }
                />
            </Field>
        </>
    );
}

function SheetChoice({
    draft,
    set,
}: {
    draft: WizardDraft;
    set: (change: Partial<WizardDraft>) => void;
}) {
    return (
        <>
            <label className="checkbox">
                <input
                    type="checkbox"
                    checked={draft.allSheets}
                    onChange={(event) =>
                        set({ allSheets: event.target.checked })
                    }
                />
                Ler todas as abas
            </label>
            {draft.allSheets ? (
                <p className="muted small">
                    As linhas de todas as abas viram uma lista só, com uma
                    coluna "aba" dizendo de onde veio cada uma. Abas escondidas
                    ficam de fora.
                </p>
            ) : (
                <Field
                    label="Aba (opcional)"
                    hint="Se deixar vazio, ele lê a primeira aba."
                >
                    <input
                        className="field"
                        spellCheck={false}
                        autoComplete="off"
                        value={draft.sourceSheet}
                        onChange={(event) =>
                            set({ sourceSheet: event.target.value })
                        }
                    />
                </Field>
            )}
        </>
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
            <h2 tabIndex={-1}>Só mais uns detalhes</h2>
            <p className="muted">
                Diga onde estão os dados e onde o resultado vai ficar.
            </p>
            <div className="grid-two">
                <div className="panel form">
                    <h3>De onde ler</h3>
                    {usesFile(draft.source) && (
                        <Field label="Arquivo" group>
                            <FilePicker
                                value={draft.sourcePath}
                                kind={draft.source}
                                onPick={(sourcePath) => set({ sourcePath })}
                            />
                        </Field>
                    )}
                    {draft.source === "xml" && (
                        <Field
                            label="Caminho dos registros (opcional)"
                            hint="Se deixar vazio, cada elemento logo abaixo do principal vira uma linha. Se os registros estão mais para dentro, escreva o caminho, como escola.alunos.aluno."
                        >
                            <input
                                className="field"
                                spellCheck={false}
                                autoComplete="off"
                                placeholder="escola.alunos.aluno"
                                value={draft.sourceRecords}
                                onChange={(event) =>
                                    set({ sourceRecords: event.target.value })
                                }
                            />
                        </Field>
                    )}
                    {draft.source === "excel" && (
                        <SheetChoice draft={draft} set={set} />
                    )}
                    {draft.source === "sheets" && (
                        <>
                            <Field
                                label="Link da planilha"
                                hint="Copie da barra de endereço do navegador."
                            >
                                <input
                                    className="field"
                                    spellCheck={false}
                                    autoComplete="off"
                                    type="url"
                                    placeholder="https://docs.google.com/spreadsheets/d/…"
                                    value={draft.sourceLink}
                                    onChange={(event) =>
                                        set({ sourceLink: event.target.value })
                                    }
                                />
                            </Field>
                            <SheetChoice draft={draft} set={set} />
                        </>
                    )}
                    {draft.source === "sqlite" && (
                        <Field
                            label="Tabela"
                            hint="Se não souber o nome, deixe qualquer um: na hora de rodar, o Datera mostra as tabelas que existem no arquivo."
                        >
                            <input
                                className="field"
                                spellCheck={false}
                                autoComplete="off"
                                value={draft.table}
                                onChange={(event) =>
                                    set({ table: event.target.value })
                                }
                            />
                        </Field>
                    )}
                    {draft.source === "database" && (
                        <div className="form-grid">
                            <ServerFields
                                values={sourceServer(draft)}
                                onChange={(change) =>
                                    set(fromSourceServer(change))
                                }
                            />
                            <Field label="Tabela">
                                <input
                                    className="field"
                                    spellCheck={false}
                                    autoComplete="off"
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
                    {usesFile(draft.destination) && (
                        <Field
                            label={
                                draft.destination === "sqlite"
                                    ? "Arquivo SQLite"
                                    : "Arquivo do resultado"
                            }
                            hint={
                                draft.destination === "sqlite"
                                    ? "Pode ser um arquivo novo ou um que já existe. As outras tabelas dele continuam como estão."
                                    : "As pendências ficam do lado, no mesmo lugar."
                            }
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
                    {draft.destination === "database" && (
                        <>
                            {draft.source === "database" && (
                                <label className="checkbox">
                                    <input
                                        type="checkbox"
                                        checked={draft.sameServer}
                                        onChange={(event) =>
                                            set({
                                                sameServer:
                                                    event.target.checked,
                                            })
                                        }
                                    />
                                    Salvar no mesmo servidor e banco de onde ele
                                    lê
                                </label>
                            )}
                            {!usesSameServer(draft) && (
                                <div className="form-grid">
                                    <ServerFields
                                        values={destinationServer(draft)}
                                        onChange={(change) =>
                                            set(fromDestinationServer(change))
                                        }
                                    />
                                </div>
                            )}
                        </>
                    )}
                    {(draft.destination === "database" ||
                        draft.destination === "sqlite") && (
                        <Field
                            label="Tabela do resultado"
                            hint="Use um nome novo. O Datera cria essa tabela e outra para as pendências, com _pendencias no fim do nome, e nunca mexe numa tabela que não foi ele que criou."
                        >
                            <input
                                className="field"
                                spellCheck={false}
                                autoComplete="off"
                                placeholder="alunos_organizados"
                                value={draft.destinationTable}
                                onChange={(event) =>
                                    set({
                                        destinationTable: event.target.value,
                                    })
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
                                    spellCheck={false}
                                    autoComplete="off"
                                    type="url"
                                    placeholder="https://docs.google.com/spreadsheets/d/…"
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
                                    spellCheck={false}
                                    autoComplete="off"
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
            <h2 tabIndex={-1}>Confira antes de salvar</h2>
            <div className="summary">
                <p>
                    <span>
                        O Datera vai ler {LABELS[draft.source ?? ""]}
                        {draft.sourcePath && (
                            <strong> ({fileName(draft.sourcePath)})</strong>
                        )}
                        {draft.allSheets &&
                            (draft.source === "excel" ||
                                draft.source === "sheets") && (
                                <strong>, todas as abas</strong>
                            )}
                        {(draft.source === "database" ||
                            draft.source === "sqlite") && (
                            <strong> (tabela {draft.table})</strong>
                        )}
                        . Ele só lê, nunca altera.
                    </span>
                </p>
                <p>
                    <span>
                        E vai salvar o resultado em{" "}
                        {LABELS[draft.destination ?? ""]}
                        {draft.destinationPath && (
                            <strong>
                                {" "}
                                ({fileName(draft.destinationPath)})
                            </strong>
                        )}
                        {(draft.destination === "database" ||
                            draft.destination === "sqlite") && (
                            <strong> (tabela {draft.destinationTable})</strong>
                        )}
                        .
                    </span>
                </p>
                <p>
                    <span>
                        Depois de salvar, você vai para a tela de Regras para
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
