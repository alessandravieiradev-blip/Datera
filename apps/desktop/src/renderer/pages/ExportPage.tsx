import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Notice } from "../components/Notice";
import { Panel } from "../components/Panel";
import { PreviewTable } from "../components/PreviewTable";
import { RunLog } from "../components/RunLog";
import { PageId } from "../components/Sidebar";
import { fileName, formatDuration, formatNumber } from "../lib/format";
import { statsOf } from "../lib/stats";
import { DateraState } from "../lib/useDatera";
import type { RunRecord } from "../../shared/api";

interface ExportPageProps {
    datera: DateraState;
    onNavigate: (page: PageId) => void;
}

export function ExportPage({ datera, onNavigate }: ExportPageProps) {
    const [confirming, setConfirming] = useState(false);
    const confirmBox = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (confirming)
            confirmBox.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
    }, [confirming]);
    const { settings, running, lastRun, log } = datera;
    const hasConfig = settings.configPath !== null;

    const preview = () => {
        setConfirming(false);
        void datera.run(true);
    };
    const exportNow = () => {
        setConfirming(false);
        void datera.run(false);
    };

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">Exportar</span>
                    <h1>Organizar e exportar</h1>
                    <p>
                        Veja uma prévia antes. Quando estiver tudo certo, é só
                        exportar de verdade.
                    </p>
                </div>
            </header>

            {!hasConfig ? (
                <Notice
                    tone="info"
                    title="Falta escolher o arquivo de configuração."
                    action={
                        <button
                            type="button"
                            className="button secondary"
                            onClick={() => onNavigate("configuracoes")}
                        >
                            Ir pra Configurações
                        </button>
                    }
                />
            ) : (
                <Panel>
                    <div className="export-bar">
                        <div className="export-file">
                            <span className="stat-icon tone-blue">
                                <Icon name="file" />
                            </span>
                            <div>
                                <span className="muted small">
                                    Configuração em uso
                                </span>
                                <strong title={settings.configPath ?? ""}>
                                    {fileName(settings.configPath ?? "")}
                                </strong>
                            </div>
                        </div>
                        <div className="export-actions">
                            <button
                                type="button"
                                className="button secondary"
                                disabled={running}
                                onClick={preview}
                            >
                                <Icon name="eye" size={18} />
                                Ver prévia
                            </button>
                            <button
                                type="button"
                                className="button primary"
                                disabled={running}
                                onClick={() => setConfirming(true)}
                            >
                                <Icon name="upload" size={18} />
                                Exportar agora
                            </button>
                        </div>
                    </div>
                    {confirming && (
                        <div className="confirm" ref={confirmBox}>
                            <Notice tone="warning" title="Tem certeza?">
                                O destino vai ser limpo e escrito de novo com o
                                resultado. As pendências também.
                            </Notice>
                            <div className="confirm-actions">
                                <button
                                    type="button"
                                    className="button ghost"
                                    onClick={() => setConfirming(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="button primary"
                                    onClick={exportNow}
                                >
                                    Sim, exportar
                                </button>
                            </div>
                        </div>
                    )}
                </Panel>
            )}

            {(running || log.length > 0) && (
                <Panel title={running ? "Rodando..." : "O que aconteceu"}>
                    <RunLog entries={log} />
                </Panel>
            )}

            {!running && lastRun && (
                <RunResult
                    record={lastRun}
                    onExport={() => setConfirming(true)}
                />
            )}
        </div>
    );
}

function RunResult({
    record,
    onExport,
}: {
    record: RunRecord;
    onExport: () => void;
}) {
    if (!record.ok || !record.report) {
        return (
            <Notice tone="error" title="Não deu certo dessa vez.">
                {record.error ?? "Aconteceu um erro que eu não esperava."}
            </Notice>
        );
    }

    const report = record.report;
    const stats = statsOf(report);

    return (
        <>
            <Notice
                tone="success"
                title={
                    record.dryRun
                        ? "Prévia pronta! Nada foi gravado."
                        : "Exportação concluída!"
                }
                action={
                    record.dryRun ? (
                        <button
                            type="button"
                            className="button primary"
                            onClick={onExport}
                        >
                            Tá tudo certo, exportar
                        </button>
                    ) : undefined
                }
            >
                {`${formatNumber(stats.read)} lidos, ${formatNumber(stats.result)} no resultado e ${formatNumber(stats.pending)} pendências em ${formatDuration(report.durationMs)}.`}
            </Notice>

            <div className="grid-two">
                <Panel title="Etapas">
                    <ol className="steps">
                        {report.steps.map((step) => (
                            <li key={step.name}>
                                <strong>
                                    {STEP_LABELS[step.name] ?? step.name}
                                </strong>
                                <span className="muted small">
                                    de {formatNumber(step.rowsIn)} para{" "}
                                    {formatNumber(step.rowsOut)}
                                    {step.pending > 0
                                        ? `, ${formatNumber(step.pending)} pendências`
                                        : ""}
                                </span>
                            </li>
                        ))}
                    </ol>
                </Panel>
                <Panel title="Pendências por motivo">
                    {report.pendingByReason.length === 0 ? (
                        <p className="muted">Nenhuma pendência.</p>
                    ) : (
                        <ul className="reasons">
                            {report.pendingByReason.map((item) => (
                                <li key={item.reason}>
                                    <span>{item.reason}</span>
                                    <strong>{formatNumber(item.count)}</strong>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            {record.dryRun && report.preview.length > 0 && (
                <Panel
                    title="Prévia do resultado"
                    subtitle={`As primeiras ${report.preview.length} linhas de ${formatNumber(report.rowsOut)}.`}
                >
                    <PreviewTable rows={report.preview} />
                </Panel>
            )}
        </>
    );
}

const STEP_LABELS: Record<string, string> = {
    fillEmpty: "Preencher vazios",
    combineColumns: "Juntar colunas",
    validation: "Separar pendências",
    raw: "Copiar do jeito que veio",
    dedupe: "Tirar repetidos",
    merge: "Juntar cadastros repetidos",
};
