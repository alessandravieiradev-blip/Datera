import { Icon } from "../components/Icon";
import { Panel } from "../components/Panel";
import { PageId } from "../components/Sidebar";
import { DateraState } from "../lib/useDatera";

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
                    <p>Onde o Datera encontra as informações pra trabalhar.</p>
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
        </div>
    );
}
