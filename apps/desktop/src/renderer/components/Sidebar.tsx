import logo from "../../../../../docs/assets/datera-icon.png";
import { Icon, IconName } from "./Icon";
import { ActionId, hint, Shortcuts } from "../lib/shortcuts";

export type PageId =
    | "inicio"
    | "exportar"
    | "regras"
    | "historico"
    | "configuracoes"
    | "atalhos"
    | "assistente";

const ITEMS: { id: PageId; label: string; icon: IconName; action: ActionId }[] =
    [
        { id: "inicio", label: "Início", icon: "home", action: "ir-inicio" },
        {
            id: "exportar",
            label: "Exportar",
            icon: "upload",
            action: "ir-exportar",
        },
        { id: "regras", label: "Regras", icon: "rules", action: "ir-regras" },
        {
            id: "historico",
            label: "Histórico",
            icon: "clock",
            action: "ir-historico",
        },
        {
            id: "configuracoes",
            label: "Configurações",
            icon: "settings",
            action: "ir-configuracoes",
        },
        {
            id: "atalhos",
            label: "Atalhos",
            icon: "keyboard",
            action: "ir-atalhos",
        },
    ];

interface SidebarProps {
    current: PageId;
    onNavigate: (page: PageId) => void;
    onHelp: () => void;
    shortcuts: Shortcuts;
}

export function Sidebar({
    current,
    onNavigate,
    onHelp,
    shortcuts,
}: SidebarProps) {
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
                        title={`${item.label}${hint(shortcuts, item.action)}`}
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
