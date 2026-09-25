import { ReactNode, useEffect, useState } from "react";
import { Icon, IconName } from "./Icon";
import { Modal } from "./Modal";
import { Notice } from "./Notice";
import { defaultMessage, patternProblem, RuleDraft } from "../lib/rules";
import { fileName } from "../lib/format";

type Path = "format" | "normalizer" | "help";

interface CustomRuleDialogProps {
    draft: RuleDraft;
    onApply: (change: Partial<RuleDraft>) => void;
    onClose: () => void;
}

const TEMPLATES = [
    { label: "CEP (96010-000)", pattern: "^\\d{5}-?\\d{3}$" },
    { label: "Matrícula (2024-0042)", pattern: "^\\d{4}-\\d{4}$" },
    { label: "Horário (14:30)", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
    { label: "Só letras e espaços", pattern: "^[A-Za-zÀ-ÿ ]+$" },
    { label: "Começa com maiúscula", pattern: "^[A-ZÀ-Ý]" },
];

const SYMBOLS = [
    ["^", "começo do texto"],
    ["$", "fim do texto"],
    ["\\d", "um número de 0 a 9"],
    ["[A-Z]", "uma letra maiúscula (o intervalo pode ser trocado)"],
    ["{5}", "o que vem antes repete 5 vezes"],
    ["?", "o que vem antes é opcional"],
    ["+", "o que vem antes aparece uma ou mais vezes"],
    ["|", "ou"],
];

const EXAMPLE_CODE = `const matriculaComOitoDigitos = (valor) => {
    const digitos = String(valor).replace(/\\D/g, "");
    if (digitos.length !== 8) return null;
    return { key: digitos };
};

module.exports = {
    normalizers: { matriculaComOitoDigitos },
};`;

export function CustomRuleDialog({
    draft,
    onApply,
    onClose,
}: CustomRuleDialogProps) {
    const startPath: Path | null =
        draft.condition === "pattern"
            ? "format"
            : draft.condition === "normalizer"
              ? "normalizer"
              : null;
    const [path, setPath] = useState<Path | null>(startPath);

    const title =
        path === "format"
            ? "Um formato próprio"
            : path === "normalizer"
              ? "Um normalizador"
              : path === "help"
                ? "Precisa de ajuda com isso?"
                : "Criar outra regra";

    return (
        <Modal title={title} onClose={onClose}>
            {path === null && <ChoosePath onChoose={setPath} />}
            {path === "format" && (
                <FormatPath
                    draft={draft}
                    onBack={() => setPath(null)}
                    onApply={onApply}
                />
            )}
            {path === "normalizer" && (
                <NormalizerPath
                    draft={draft}
                    onBack={() => setPath(null)}
                    onApply={onApply}
                />
            )}
            {path === "help" && (
                <HelpPath
                    draft={draft}
                    onBack={() => setPath(null)}
                    onChoose={setPath}
                />
            )}
        </Modal>
    );
}

function ChoosePath({ onChoose }: { onChoose: (path: Path) => void }) {
    const options: {
        id: Path;
        icon: IconName;
        title: string;
        text: string;
        level: string;
    }[] = [
        {
            id: "format",
            icon: "rules",
            title: "Um formato próprio",
            text: "Você diz como o valor tem que ser escrito, tipo um CEP ou uma matrícula, e testa na hora.",
            level: "Não precisa programar",
        },
        {
            id: "normalizer",
            icon: "code",
            title: "Um normalizador",
            text: "Uma função pequena em JavaScript que decide se o valor vale ou não. Serve para qualquer regra.",
            level: "Precisa de lógica de programação",
        },
        {
            id: "help",
            icon: "users",
            title: "Não sei fazer",
            text: "Veja o que pedir e para quem.",
            level: "Para qualquer pessoa",
        },
    ];

    return (
        <div className="dialog-page">
            <p className="muted">
                As regras prontas cobrem o mais comum. Quando precisar de uma
                diferente, escolha um desses caminhos:
            </p>
            <div className="path-grid">
                {options.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        className="option-card compact"
                        onClick={() => onChoose(option.id)}
                    >
                        <span className="option-icon">
                            <Icon name={option.icon} size={28} />
                        </span>
                        <strong>{option.title}</strong>
                        <span className="muted small">{option.text}</span>
                        <span className="level">{option.level}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

interface PathProps {
    draft: RuleDraft;
    onBack: () => void;
    onApply: (change: Partial<RuleDraft>) => void;
}

function FormatPath({ draft, onBack, onApply }: PathProps) {
    const column = draft.column || "a coluna";
    const [pattern, setPattern] = useState(
        draft.condition === "pattern" ? (draft.pattern ?? "") : "",
    );
    const [ignoreCase, setIgnoreCase] = useState(
        (draft.flags ?? "").includes("i"),
    );
    const [examples, setExamples] = useState("96010-000\n96010000\n9601-000");
    const [message, setMessage] = useState(
        draft.condition === "pattern" && draft.message
            ? draft.message
            : defaultMessage("pattern", column),
    );
    const [showSymbols, setShowSymbols] = useState(false);

    const flags = ignoreCase ? "i" : "";
    const problem = patternProblem(pattern, flags);
    const regex = problem ? null : new RegExp(pattern, flags);
    const lines = examples.split("\n").map((line) => line.trim());

    return (
        <div className="dialog-page">
            <p className="muted">
                Escolha um modelo ou escreva o seu. As linhas de{" "}
                <strong>{column}</strong> que não seguirem esse formato vão para
                Pendências.
            </p>

            <div className="template-list">
                {TEMPLATES.map((template) => (
                    <button
                        key={template.label}
                        type="button"
                        className={
                            template.pattern === pattern
                                ? "chip-button selected"
                                : "chip-button"
                        }
                        onClick={() => setPattern(template.pattern)}
                    >
                        {template.label}
                    </button>
                ))}
            </div>

            <label className="form-field">
                <span className="form-label">O formato</span>
                <input
                    className="field mono"
                    value={pattern}
                    placeholder="^\d{5}-?\d{3}$"
                    onChange={(event) => setPattern(event.target.value)}
                />
                {problem && pattern && (
                    <span className="field-error">{problem}</span>
                )}
            </label>
            <label className="checkbox">
                <input
                    type="checkbox"
                    checked={ignoreCase}
                    onChange={(event) => setIgnoreCase(event.target.checked)}
                />
                Tanto faz maiúscula ou minúscula
            </label>

            <button
                type="button"
                className="link"
                onClick={() => setShowSymbols(!showSymbols)}
            >
                {showSymbols ? "Esconder" : "O que são esses símbolos?"}
            </button>
            {showSymbols && (
                <dl className="symbols">
                    {SYMBOLS.map(([symbol, meaning]) => (
                        <div key={symbol}>
                            <dt>
                                <code>{symbol}</code>
                            </dt>
                            <dd>{meaning}</dd>
                        </div>
                    ))}
                </dl>
            )}

            <div className="tester">
                <label className="form-field">
                    <span className="form-label">
                        Teste com alguns exemplos (um por linha)
                    </span>
                    <textarea
                        className="field mono"
                        rows={4}
                        value={examples}
                        onChange={(event) => setExamples(event.target.value)}
                    />
                </label>
                <ul className="test-results" aria-live="polite">
                    {lines.map((line, index) => {
                        if (line === "")
                            return (
                                <li key={index} className="muted">
                                    Vazio: não é conferido
                                </li>
                            );
                        if (!regex)
                            return (
                                <li key={index} className="muted">
                                    {line}
                                </li>
                            );
                        const passes = regex.test(line);
                        return (
                            <li
                                key={index}
                                className={passes ? "pass" : "fail"}
                            >
                                <Icon
                                    name={passes ? "check" : "alert"}
                                    size={16}
                                    strokeWidth={2.5}
                                />
                                <code>{line}</code>
                                <span>
                                    {passes ? "Passa" : "Vai para Pendências"}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <label className="form-field">
                <span className="form-label">
                    Motivo que aparece nas Pendências
                </span>
                <input
                    className="field"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                />
            </label>

            <DialogFooter
                onBack={onBack}
                action={
                    <button
                        type="button"
                        className="button primary"
                        disabled={problem !== null}
                        onClick={() =>
                            onApply({
                                condition: "pattern",
                                pattern,
                                flags: flags || undefined,
                                message: message.trim() || undefined,
                            })
                        }
                    >
                        Usar essa regra
                    </button>
                }
            />
        </div>
    );
}

type NormalizerList = { builtin: string[]; custom: string[]; files: string[] };

function NormalizerPath({ draft, onBack, onApply }: PathProps) {
    const [page, setPage] = useState(0);
    const [list, setList] = useState<NormalizerList | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [created, setCreated] = useState<string | null>(null);
    const [chosen, setChosen] = useState(
        draft.condition === "normalizer" ? (draft.normalizer ?? "") : "",
    );
    const column = draft.column || "a coluna";
    const [message, setMessage] = useState(
        draft.condition === "normalizer" && draft.message
            ? draft.message
            : defaultMessage("normalizer", column),
    );

    const load = () => {
        void window.datera.listNormalizers().then((result) => {
            if (result.ok) {
                setList(result);
                setError(null);
            } else {
                setError(result.error);
            }
        });
    };

    useEffect(load, []);

    const createFile = async () => {
        const result = await window.datera.createNormalizerFile();
        if (result.ok) {
            setCreated(result.path);
            load();
        } else {
            setError(result.error);
        }
    };

    const pages = [
        <div key="o-que-e" className="dialog-page">
            <h3>O que é um normalizador?</h3>
            <p>
                É uma função que recebe o valor da célula e responde se ele
                vale. Se não valer, devolve <code>null</code> e a linha vai para
                Pendências. Se valer, devolve <code>{"{ key: valor }"}</code>.
            </p>
            <p className="muted">
                Para escrever um, você só precisa do básico de lógica de
                programação: variável, <code>if</code> e função. É JavaScript.
            </p>
            <pre className="code-block">{EXAMPLE_CODE}</pre>
            <p className="muted small">
                Esse exemplo aceita matrícula com 8 números, mesmo que venha com
                traço ou espaço no meio.
            </p>
        </div>,
        <div key="arquivo" className="dialog-page">
            <h3>Onde ele fica</h3>
            <p>
                Os normalizadores ficam num arquivo <code>.cjs</code> na mesma
                pasta da sua configuração. O Datera cria um arquivo de exemplo
                para você e já deixa ele ligado na configuração.
            </p>
            <div className="file-actions">
                <button
                    type="button"
                    className="button secondary"
                    onClick={createFile}
                >
                    <Icon name="file" size={18} />
                    Criar arquivo de exemplo
                </button>
                {(created ?? list?.files[0]) && (
                    <button
                        type="button"
                        className="button ghost"
                        onClick={() =>
                            void window.datera.showInFolder(
                                created ?? list?.files[0] ?? "",
                            )
                        }
                    >
                        <Icon name="folder" size={18} />
                        Abrir a pasta
                    </button>
                )}
            </div>
            {list && list.files.length > 0 && (
                <ul className="file-list">
                    {list.files.map((file) => (
                        <li key={file}>
                            <Icon name="file" size={16} /> {fileName(file)}
                        </li>
                    ))}
                </ul>
            )}
            <ol className="how-to">
                <li>
                    Abra o arquivo num editor, como o Bloco de Notas ou o VS
                    Code.
                </li>
                <li>Mude a função de exemplo ou crie outra do mesmo jeito.</li>
                <li>
                    Coloque o nome dela dentro de <code>normalizers</code>, lá
                    no final.
                </li>
                <li>
                    Salve o arquivo. Na próxima prévia o Datera já usa a versão
                    nova.
                </li>
            </ol>
        </div>,
        <div key="escolher" className="dialog-page">
            <h3>Escolha o normalizador</h3>
            <p className="muted">
                As linhas de <strong>{column}</strong> que o normalizador
                recusar vão para Pendências.
            </p>
            {error && (
                <Notice tone="error" title="Algo deu errado.">
                    {error}
                </Notice>
            )}
            <label className="form-field">
                <span className="form-label">Normalizador</span>
                <select
                    className="field"
                    value={chosen}
                    onChange={(event) => setChosen(event.target.value)}
                >
                    <option value="">escolha um</option>
                    {list && list.custom.length > 0 && (
                        <optgroup label="Os seus">
                            {list.custom.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </optgroup>
                    )}
                    {list && (
                        <optgroup label="Os que já vêm prontos">
                            {list.builtin.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </optgroup>
                    )}
                </select>
            </label>
            <label className="form-field">
                <span className="form-label">
                    Motivo que aparece nas Pendências
                </span>
                <input
                    className="field"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                />
            </label>
            <button type="button" className="link" onClick={load}>
                Atualizar a lista
            </button>
        </div>,
    ];

    const last = page === pages.length - 1;

    return (
        <>
            {pages[page]}
            <DialogFooter
                onBack={page === 0 ? onBack : () => setPage(page - 1)}
                dots={{ total: pages.length, current: page }}
                action={
                    last ? (
                        <button
                            type="button"
                            className="button primary"
                            disabled={chosen === ""}
                            onClick={() =>
                                onApply({
                                    condition: "normalizer",
                                    normalizer: chosen,
                                    message: message.trim() || undefined,
                                })
                            }
                        >
                            Usar essa regra
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="button primary"
                            onClick={() => setPage(page + 1)}
                        >
                            Próximo
                            <Icon name="arrowRight" size={18} />
                        </button>
                    )
                }
            />
        </>
    );
}

function HelpPath({
    draft,
    onBack,
    onChoose,
}: {
    draft: RuleDraft;
    onBack: () => void;
    onChoose: (path: Path) => void;
}) {
    const [copied, setCopied] = useState(false);
    const column = draft.column || "[nome da coluna]";
    const request = `Olá! Uso o Datera para organizar uma planilha e preciso de um normalizador para coluna "${column}". A regra é: [explique aqui quando o valor vale e quando não vale]. O guia fica em github.com/alessandravieiradev-blip/datera, na parte "Criando o seu próprio normalizador". É um arquivo .cjs com uma função que devolve null quando o valor não vale.`;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(request);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="dialog-page">
            <ol className="help-steps">
                <li>
                    <strong>Tente primeiro o formato próprio.</strong>
                    <p className="muted">
                        Ele resolve a maioria dos casos (CEP, matrícula,
                        horário...) e não precisa programar nada.
                    </p>
                    <button
                        type="button"
                        className="button secondary"
                        onClick={() => onChoose("format")}
                    >
                        Ir pro formato próprio
                    </button>
                </li>
                <li>
                    <strong>Peça para alguém que programe.</strong>
                    <p className="muted">
                        Qualquer pessoa que saiba um pouco de JavaScript faz em
                        poucos minutos. Mande essa mensagem e complete a parte
                        entre colchetes:
                    </p>
                    <blockquote className="request">{request}</blockquote>
                    <div className="file-actions">
                        <button
                            type="button"
                            className="button secondary"
                            onClick={copy}
                        >
                            {copied ? "Copiado!" : "Copiar mensagem"}
                        </button>
                        <button
                            type="button"
                            className="button ghost"
                            onClick={() =>
                                void window.datera.openHelp("normalizador")
                            }
                        >
                            Abrir o guia
                        </button>
                    </div>
                    <p className="muted small">
                        Quando a pessoa te mandar o arquivo, coloque ele na
                        pasta da configuração e escolha ele em "Um
                        normalizador".
                    </p>
                </li>
                <li>
                    <strong>Use a versão para quem programa.</strong>
                    <p className="muted">
                        No GitHub do Datera tem a versão de terminal, com todas
                        as opções: merge por coluna, regras por grupo, fontes e
                        destinos próprios. A configuração é a mesma, então
                        alguém pode ajustar lá e você continuar usando por aqui.
                    </p>
                    <button
                        type="button"
                        className="button ghost"
                        onClick={() => void window.datera.openHelp("inicio")}
                    >
                        Abrir o GitHub
                    </button>
                </li>
            </ol>
            <DialogFooter onBack={onBack} />
        </div>
    );
}

interface DialogFooterProps {
    onBack: () => void;
    action?: ReactNode;
    dots?: { total: number; current: number };
}

function DialogFooter({ onBack, action, dots }: DialogFooterProps) {
    return (
        <div className="dialog-footer">
            <button type="button" className="button ghost" onClick={onBack}>
                <Icon name="arrowLeft" size={18} />
                Voltar
            </button>
            {dots && (
                <span
                    className="dots"
                    aria-label={`Página ${dots.current + 1} de ${dots.total}`}
                >
                    {Array.from({ length: dots.total }, (_, index) => (
                        <span
                            key={index}
                            className={
                                index === dots.current
                                    ? "dot-page current"
                                    : "dot-page"
                            }
                        />
                    ))}
                </span>
            )}
            {action ?? <span />}
        </div>
    );
}
