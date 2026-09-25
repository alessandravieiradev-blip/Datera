import { Icon } from "../components/Icon";
import { Notice } from "../components/Notice";
import { Panel } from "../components/Panel";

const EXAMPLES = [
    { field: "Matrícula", condition: "vazia" },
    { field: "E-mail", condition: "fora do formato" },
    { field: "Plano", condition: "fora da lista" },
];

export function RulesPage() {
    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">Regras de tratamento</span>
                    <h1>Configure suas regras</h1>
                    <p>
                        Defina como o Datera deve tratar cada tipo de
                        informação, com frases simples.
                    </p>
                </div>
            </header>
            <Notice tone="info" title="Essa tela está sendo construída.">
                Por enquanto as regras ficam no arquivo de configuração. Logo
                mais vai dar pra montar tudo por aqui, desse jeito:
            </Notice>
            {EXAMPLES.map((example, index) => (
                <Panel key={example.field} className="rule-preview">
                    <span className="rule-number">{index + 1}</span>
                    <span>Quando</span>
                    <span className="chip">{example.field}</span>
                    <span>estiver</span>
                    <span className="chip">{example.condition}</span>
                    <span>mandar para</span>
                    <span className="chip">
                        <Icon name="folder" size={18} />
                        Pendências
                    </span>
                </Panel>
            ))}
        </div>
    );
}
