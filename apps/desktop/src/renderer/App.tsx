import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageId, Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import { useDatera } from "./lib/useDatera";
import {
    ActionId,
    actionFor,
    comboFromEvent,
    resolveShortcuts,
} from "./lib/shortcuts";
import { HomePage } from "./pages/HomePage";
import { ExportPage } from "./pages/ExportPage";
import { RulesPage } from "./pages/RulesPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupWizard } from "./pages/SetupWizard";
import { ShortcutsPage } from "./pages/ShortcutsPage";

export interface Command {
    id: ActionId;
    seq: number;
}

const NAVIGATION: Partial<Record<ActionId, PageId>> = {
    "ir-inicio": "inicio",
    "ir-exportar": "exportar",
    "ir-regras": "regras",
    "ir-historico": "historico",
    "ir-configuracoes": "configuracoes",
    "ir-atalhos": "atalhos",
    "nova-config": "assistente",
};

const PAGE_OF: Partial<Record<ActionId, PageId>> = {
    "ver-previa": "exportar",
    exportar: "exportar",
    "adicionar-regra": "regras",
};

const TOAST_TIME = 2600;

function prefersDark(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function App() {
    const [page, setPage] = useState<PageId>("inicio");
    const [command, setCommand] = useState<Command | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const capturing = useRef(false);
    const seq = useRef(0);
    const datera = useDatera();
    const shortcuts = useMemo(
        () => resolveShortcuts(datera.settings.shortcuts),
        [datera.settings.shortcuts],
    );

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), TOAST_TIME);
        return () => clearTimeout(timer);
    }, [toast]);

    const notify = useCallback((text: string) => setToast(text), []);

    const navigate = useCallback((target: PageId) => {
        setCommand(null);
        setPage(target);
    }, []);

    const send = (id: ActionId) => {
        seq.current += 1;
        setCommand({ id, seq: seq.current });
    };

    const run = async (id: ActionId) => {
        const target = NAVIGATION[id];
        if (target) {
            navigate(target);
            return;
        }
        const pageOfAction = PAGE_OF[id];
        if (pageOfAction) {
            setPage(pageOfAction);
            send(id);
            return;
        }
        switch (id) {
            case "salvar-regras":
            case "desfazer-regras":
                if (page === "regras") send(id);
                else notify("Abra a tela de Regras para usar esse atalho.");
                return;
            case "atualizar":
                await datera.refresh();
                notify("Informações atualizadas.");
                return;
            case "trocar-config":
                await datera.chooseConfig();
                return;
            case "abrir-pasta":
                if (datera.settings.configPath)
                    void window.datera.showInFolder(datera.settings.configPath);
                else notify("Nenhuma configuração escolhida ainda.");
                return;
            case "alternar-tema": {
                const dark =
                    datera.settings.theme === "dark" ||
                    (datera.settings.theme === "system" && prefersDark());
                datera.applySettings(
                    await window.datera.setTheme(dark ? "light" : "dark"),
                );
                notify(dark ? "Tema claro ativado." : "Tema escuro ativado.");
                return;
            }
            case "ajuda":
                datera.openHelp();
                return;
        }
    };

    const runRef = useRef(run);
    runRef.current = run;

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (capturing.current || event.repeat) return;
            if (document.querySelector('[aria-modal="true"]')) return;
            const combo = comboFromEvent(event);
            if (!combo) return;
            const id = actionFor(shortcuts, combo);
            if (!id) return;
            event.preventDefault();
            void runRef.current(id);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [shortcuts]);

    return (
        <div className="app">
            <Sidebar
                current={page === "assistente" ? "inicio" : page}
                onNavigate={navigate}
                onHelp={datera.openHelp}
                shortcuts={shortcuts}
            />
            <main className="content">
                {!datera.loading && page === "inicio" && (
                    <HomePage datera={datera} onNavigate={navigate} />
                )}
                {page === "exportar" && (
                    <ExportPage
                        datera={datera}
                        onNavigate={navigate}
                        command={command}
                        shortcuts={shortcuts}
                    />
                )}
                {page === "regras" && (
                    <RulesPage
                        datera={datera}
                        onNavigate={navigate}
                        command={command}
                        shortcuts={shortcuts}
                        notify={notify}
                    />
                )}
                {page === "historico" && (
                    <HistoryPage history={datera.history} />
                )}
                {page === "configuracoes" && (
                    <SettingsPage datera={datera} onNavigate={navigate} />
                )}
                {page === "atalhos" && (
                    <ShortcutsPage
                        datera={datera}
                        shortcuts={shortcuts}
                        onCapture={(active) => {
                            capturing.current = active;
                        }}
                        notify={notify}
                    />
                )}
                {page === "assistente" && (
                    <SetupWizard datera={datera} onNavigate={navigate} />
                )}
            </main>
            <Toast text={toast} />
        </div>
    );
}
