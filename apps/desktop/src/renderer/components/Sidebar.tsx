import logo from "../../../../../docs/assets/datera-icon.png";
import { Icon, IconName } from "./Icon";

export type PageId =
    | "inicio"
    | "exportar"
    | "regras"
    | "historico"
    | "configuracoes"
    | "assistente";

const ITEMS: { id: PageId; label: string; icon: IconName }[] = [
    { id: "inicio", label: "Início", icon: "home" },
    { id: "exportar", label: "Exportar", icon: "upload" },
    { id: "regras", label: "Regras", icon: "rules" },
    { id: "historico", label: "Histórico", icon: "clock" },
    { id: "configuracoes", label: "Configurações", icon: "settings" },
];

interface SidebarProps {
    current: PageId;
    onNavigate: (page: PageId) => void;
    onHelp: () => void;
}

export function Sidebar({ current, onNavigate, onHelp }: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="brand">
                <img src={logo} alt="" />
                <span>Datera</span>
            </div>
            <nav className="nav">
                {ITEMS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={
                            item.id === current ? "nav-item active" : "nav-item"
                        }
                        aria-current={item.id === current ? "page" : undefined}
                        onClick={() => onNavigate(item.id)}
                    >
                        <Icon name={item.icon} />
                        {item.label}
                    </button>
                ))}
            </nav>
            <button type="button" className="help" onClick={onHelp}>
                <Icon name="help" />
                <span>
                    <strong>Precisa de ajuda?</strong>
                    <small>Abre o guia do Datera.</small>
                </span>
            </button>
        </aside>
    );
}
