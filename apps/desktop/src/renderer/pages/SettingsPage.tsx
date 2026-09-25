import { Icon } from "../components/Icon";
import { Panel } from "../components/Panel";
import { PageId } from "../components/Sidebar";
import { DateraState } from "../lib/useDatera";
import type { Theme } from "../../shared/api";

const THEMES: { id: Theme; label: string; text: string }[] = [
    {
        id: "system",
        label: "Igual ao Windows",
        text: "Muda sozinho junto com o computador.",
    },
    { id: "light", label: "Claro", text: "Fundo claro o tempo todo." },
    {
        id: "dark",
        label: "Escuro",
        text: "Fundo escuro, mais confortável à noite.",
    },
];

interface SettingsPageProps {
    datera: DateraState;
    onNavigate: (page: PageId) => void;
}

export function SettingsPage({ datera, onNavigate }: SettingsPageProps) {
    const { configPath } = datera.settings;

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">Configurações</span>
                    <h1>Configurações</h1>
                    <p>Onde o Datera encontra as informações para trabalhar.</p>
                </div>
            </header>
            <Panel title="Arquivo de configuração">
                <div className="setting-row">
                    <span className="stat-icon tone-blue">
                        <Icon name="folder" />
                    </span>
                    <div className="setting-text">
                        <strong>
                            {configPath ?? "Nenhum arquivo escolhido"}
                        </strong>
                        <p className="muted small">
                            Se tiver um arquivo <code>.env</code> na mesma
                            pasta, ele também é usado. Os caminhos que estão
                            dentro da configuração começam a contar a partir
                            dessa pasta.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="button ghost"
                        disabled={datera.running}
                        onClick={() => onNavigate("assistente")}
                    >
                        Criar nova
                    </button>
                    <button
                        type="button"
                        className="button secondary"
                        disabled={datera.running}
                        onClick={() => void datera.chooseConfig()}
                    >
                        {configPath ? "Trocar arquivo" : "Escolher arquivo"}
                    </button>
                </div>
            </Panel>
            <Panel title="Aparência">
                <div
                    className="theme-options"
                    role="radiogroup"
                    aria-label="Tema"
                >
                    {THEMES.map((theme) => (
                        <button
                            key={theme.id}
                            type="button"
                            role="radio"
                            aria-checked={datera.settings.theme === theme.id}
                            className={
                                datera.settings.theme === theme.id
                                    ? "theme-option selected"
                                    : "theme-option"
                            }
                            onClick={async () =>
                                datera.applySettings(
                                    await window.datera.setTheme(theme.id),
                                )
                            }
                        >
                            <span
                                className={`theme-swatch swatch-${theme.id}`}
                            />
                            <strong>{theme.label}</strong>
                            <span className="muted small">{theme.text}</span>
                        </button>
                    ))}
                </div>
            </Panel>
        </div>
    );
}
