import { Icon } from "../components/Icon";
import { Panel } from "../components/Panel";
import {
    formatDuration,
    formatFullDate,
    formatNumber,
    formatTime,
} from "../lib/format";
import type { RunRecord } from "../../shared/api";

interface HistoryPageProps {
    history: RunRecord[];
}

export function HistoryPage({ history }: HistoryPageProps) {
    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">Histórico</span>
                    <h1>Tudo o que já rodou</h1>
                    <p>
                        As últimas execuções feitas por aqui, das mais novas
                        pras mais antigas.
                    </p>
                </div>
            </header>
            <Panel>
                {history.length === 0 ? (
                    <p className="muted">Ainda não tem nada aqui.</p>
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Quando</th>
                                    <th>Tipo</th>
                                    <th>Fonte</th>
                                    <th className="number">Lidos</th>
                                    <th className="number">Resultado</th>
                                    <th className="number">Pendências</th>
                                    <th className="number">Tempo</th>
                                    <th>Situação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((record) => (
                                    <tr key={record.id}>
                                        <td>
                                            {formatFullDate(record.startedAt)} •{" "}
                                            {formatTime(record.startedAt)}
                                        </td>
                                        <td>
                                            {record.dryRun
                                                ? "Prévia"
                                                : "Exportação"}
                                        </td>
                                        <td>{record.sourceLabel ?? "-"}</td>
                                        <td className="number">
                                            {record.report
                                                ? formatNumber(
                                                      record.report.rowsRead,
                                                  )
                                                : "-"}
                                        </td>
                                        <td className="number">
                                            {record.report
                                                ? formatNumber(
                                                      record.report.rowsOut,
                                                  )
                                                : "-"}
                                        </td>
                                        <td className="number">
                                            {record.report
                                                ? formatNumber(
                                                      record.report.pendingRows,
                                                  )
                                                : "-"}
                                        </td>
                                        <td className="number">
                                            {record.report
                                                ? formatDuration(
                                                      record.report.durationMs,
                                                  )
                                                : "-"}
                                        </td>
                                        <td>
                                            {record.ok ? (
                                                <span className="status status-ok">
                                                    <Icon
                                                        name="check"
                                                        size={14}
                                                        strokeWidth={2.5}
                                                    />
                                                    Deu certo
                                                </span>
                                            ) : (
                                                <span
                                                    className="status status-error"
                                                    title={record.error}
                                                >
                                                    <Icon
                                                        name="alert"
                                                        size={14}
                                                        strokeWidth={2.5}
                                                    />
                                                    Deu erro
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
}
