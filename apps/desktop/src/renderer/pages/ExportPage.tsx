import { useEffect, useRef, useState } from "react";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { ReasonList } from "../components/ReasonList";
import { Panel } from "../components/Panel";
import { PreviewTable } from "../components/PreviewTable";
import { RunLog } from "../components/RunLog";
import { PageId } from "../components/Sidebar";
import { fileName, formatDuration, formatNumber } from "../lib/format";
import { statsOf } from "../lib/stats";
import { DateraState } from "../lib/useDatera";
import { hint, Shortcuts } from "../lib/shortcuts";
import { prefersReducedMotion } from "../lib/focusTrap";
import type { Command } from "../App";
import type { RunRecord } from "../../shared/api";

interface ExportPageProps {
    datera: DateraState;
    onNavigate: (page: PageId) => void;
    command: Command | null;
    shortcuts: Shortcuts;
}

export function ExportPage({
    datera,
    onNavigate,
    command,
    shortcuts,
}: ExportPageProps) {
    const [confirming, setConfirming] = useState(false);
    const confirmBox = useRef<HTMLDivElement>(null);
    const cancelButton = useRef<HTMLButtonElement>(null);
    const exportButton = useRef<HTMLButtonElement>(null);
    const wasConfirming = useRef(false);

    useEffect(() => {
        if (confirming) {
            confirmBox.current?.scrollIntoView({
                behavior: prefersReducedMotion() ? "auto" : "smooth",
                block: "center",
            });
            cancelButton.current?.focus({ preventScroll: true });
        } else if (wasConfirming.current) {
            exportButton.current?.focus({ preventScroll: true });
        }
        wasConfirming.current = confirming;
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

    useEffect(() => {
        if (!command || !hasConfig || running) return;
        if (command.id === "ver-previa") preview();
        if (command.id === "exportar") setConfirming(true);
    }, [command?.seq]);

    const fileLabel = fileName(settings.configPath ?? "");

    return (
        <div className="page">
            <PageHeader
                title="Exportar"
                meta={
                    hasConfig ? (
                        <>
                            Usando{" "}
                            <strong title={settings.configPath ?? ""}>
                                {fileLabel}
                            </strong>
                            . A prévia roda tudo sem gravar nada.
                        </>
                    ) : undefined
                }
                actions={
                    hasConfig ? (
                        <>
                            <button
                                type="button"
                                className="button secondary"
                                disabled={running}
                                onClick={preview}
                                title={`Ver prévia${hint(shortcuts, "ver-previa")}`}
                            >
                                Ver prévia
                            </button>
                            <button
                                ref={exportButton}
                                type="button"
                                className="button primary"
                                disabled={running}
                                onClick={() => setConfirming(true)}
                                title={`Exportar agora${hint(shortcuts, "exportar")}`}
                            >
                                Exportar agora
                            </button>
                        </>
                    ) : undefined
                }
            />

            {!hasConfig && (
                <Notice
                    tone="info"
                    title="Falta escolher o arquivo de configuração."
                    action={
                        <button
                            type="button"
                            className="button secondary"
                            onClick={() => onNavigate("configuracoes")}
                        >
                            Ir para Configurações
                        </button>
                    }
                />
            )}

            {hasConfig && confirming && (
                <div
                    className="confirm"
                    ref={confirmBox}
                    role="group"
                    aria-labelledby="confirmar-titulo"
                    onKeyDown={(event) => {
                        if (event.key === "Escape") setConfirming(false);
                    }}
                >
                    <div>
                        <strong id="confirmar-titulo">
                            Exportar e substituir o destino?
                        </strong>
                        <p>
                            O destino e as pendências vão ser apagados e
                            escritos de novo com o resultado.
                        </p>
                    </div>
                    <div className="confirm-actions">
                        <button
                            ref={cancelButton}
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
                            Exportar
                        </button>
                    </div>
                </div>
            )}

            {running && (
                <p className="running" role="status">
                    Rodando…
                </p>
            )}

            {!running && lastRun && <RunResult record={lastRun} />}

            {(running || log.length > 0) && (
                <details className="log-details" open={running}>
                    <summary>Mensagens da execução ({log.length})</summary>
                    <RunLog entries={log} />
                </details>
            )}
        </div>
    );
}

function RunResult({ record }: { record: RunRecord }) {
    if (!record.ok || !record.report) {
        return (
            <Notice tone="error" title="Não foi possível concluir.">
                {record.error ??
                    "Ocorreu um erro inesperado. Tente de novo e, se continuar, veja o Histórico."}
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
                        ? "Prévia pronta. Nada foi gravado."
                        : "Exportação concluída."
                }
            >
                {`${formatNumber(stats.read)} lidos, ${formatNumber(stats.result)} no resultado e ${formatNumber(stats.pending)} pendências em ${formatDuration(report.durationMs)}.`}
            </Notice>

            <div className="grid-two">
                <Panel title="Etapas">
                    <div className="table-wrap">
                        <table className="table compact">
                            <thead>
                                <tr>
                                    <th>Etapa</th>
                                    <th className="number">Entraram</th>
                                    <th className="number">Saíram</th>
                                    <th className="number">Pendências</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.steps.map((step) => (
                                    <tr key={step.name}>
                                        <td>
                                            {STEP_LABELS[step.name] ??
                                                step.name}
                                        </td>
                                        <td className="number">
                                            {formatNumber(step.rowsIn)}
                                        </td>
                                        <td className="number">
                                            {formatNumber(step.rowsOut)}
                                        </td>
                                        <td className="number">
                                            {step.pending > 0
                                                ? formatNumber(step.pending)
                                                : "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
                <Panel title="Pendências por motivo">
                    {report.pendingByReason.length === 0 ? (
                        <p className="muted">Nenhuma pendência.</p>
                    ) : (
                        <ReasonList reasons={report.pendingByReason} />
                    )}
                </Panel>
            </div>

            {record.dryRun && report.preview.length > 0 && (
                <Panel
                    title="Prévia do resultado"
                    subtitle={`As primeiras ${formatNumber(report.preview.length)} linhas de ${formatNumber(report.rowsOut)}.`}
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
