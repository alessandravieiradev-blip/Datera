import { useState } from "react";
import { PageId, Sidebar } from "./components/Sidebar";
import { useDatera } from "./lib/useDatera";
import { HomePage } from "./pages/HomePage";
import { ExportPage } from "./pages/ExportPage";
import { RulesPage } from "./pages/RulesPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupWizard } from "./pages/SetupWizard";

export function App() {
    const [page, setPage] = useState<PageId>("inicio");
    const datera = useDatera();

    return (
        <div className="app">
            <Sidebar
                current={page === "assistente" ? "inicio" : page}
                onNavigate={setPage}
                onHelp={datera.openHelp}
            />
            <main className="content">
                {!datera.loading && page === "inicio" && (
                    <HomePage datera={datera} onNavigate={setPage} />
                )}
                {page === "exportar" && (
                    <ExportPage datera={datera} onNavigate={setPage} />
                )}
                {page === "regras" && (
                    <RulesPage datera={datera} onNavigate={setPage} />
                )}
                {page === "historico" && (
                    <HistoryPage history={datera.history} />
                )}
                {page === "configuracoes" && (
                    <SettingsPage datera={datera} onNavigate={setPage} />
                )}
                {page === "assistente" && (
                    <SetupWizard datera={datera} onNavigate={setPage} />
                )}
            </main>
        </div>
    );
}
