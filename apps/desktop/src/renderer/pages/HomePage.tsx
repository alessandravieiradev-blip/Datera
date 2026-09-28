import { LineChart } from "../components/LineChart";
import { Metrics } from "../components/Metrics";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { ReasonList } from "../components/ReasonList";
import { PageId } from "../components/Sidebar";
import {
    fileName,
    formatDate,
    formatFullDate,
    formatNumber,
    formatPercent,
    formatShortDate,
    formatTime,
} from "../lib/format";
import {
    exportsForChart,
    latestExport,
    latestRun,
    statsOf,
} from "../lib/stats";
import { DateraState } from "../lib/useDatera";
import type { RunRecord } from "../../shared/api";

const CHART_RUNS = 8;
const RECENT_RUNS = 5;

interface HomePageProps {
    datera: DateraState;
    onNavigate: (page: PageId) => void;
}

function Welcome({
    datera,
    onNavigate,
}: {
    datera: DateraState;
    onNavigate: (page: PageId) => void;
}) {
    return (
        <div className="page">
            <PageHeader title="Início" meta="Nenhuma configuração escolhida." />
            <section className="welcome">
                <h2 className="section-heading">Primeiro passo</h2>
                <p>
                    O Datera precisa saber de onde ler os dados e onde salvar o
                    resultado. Isso fica guardado num arquivo de configuração.
                </p>
                <div className="welcome-actions">
                    <button
                        type="button"
                        className="button primary"
                        onClick={() => onNavigate("assistente")}
                    >
                        Criar configuração
                    </button>
                    <button
                        type="button"
                        className="button secondary"
                        onClick={() => void datera.chooseConfig()}
                    >
                        Escolher um arquivo existente
                    </button>
                </div>
            </section>
        </div>
    );
}

export function HomePage({ datera, onNavigate }: HomePageProps) {
    if (datera.settings.configPath === null)
        return <Welcome datera={datera} onNavigate={onNavigate} />;

    const current = latestRun(datera.history);
    const lastExport = latestExport(datera.history);
    const chartRuns = exportsForChart(datera.history, CHART_RUNS);
    const recent = datera.history
        .filter((record) => record.ok)
        .slice(0, RECENT_RUNS);
    const config = fileName(datera.settings.configPath);
    const meta = lastExport
        ? `${config} · última exportação em ${formatDate(lastExport.startedAt)} às ${formatTime(lastExport.startedAt)}`
        : `${config} · nenhuma exportação ainda`;

    return (
        <div className="page">
            <PageHeader
                title="Início"
                meta={meta}
                actions={
                    <button
                        type="button"
                        className="button primary"
                        onClick={() => onNavigate("exportar")}
                    >
                        Ir para Exportar
                    </button>
                }
            />

            {!current?.report ? (
                <Notice
                    tone="info"
                    title="Ainda não tem nenhuma execução."
                    action={
                        <button
                            type="button"
                            className="button secondary"
                            onClick={() => onNavigate("exportar")}
                        >
                            Ver uma prévia
                        </button>
                    }
                >
                    A prévia executa tudo sem gravar nada, então dá para testar
                    à vontade.
                </Notice>
            ) : (
                <Dashboard
                    record={current}
                    chartRuns={chartRuns}
                    recent={recent}
                    onNavigate={onNavigate}
                />
            )}
        </div>
    );
}

interface DashboardProps {
    record: RunRecord;
    chartRuns: RunRecord[];
    recent: RunRecord[];
    onNavigate: (page: PageId) => void;
}

function trendText(runs: RunRecord[]): string | null {
    const first = runs[0];
    const last = runs[runs.length - 1];
    if (!first?.report || !last?.report || runs.length < 2) return null;
    const from = first.report.pendingRows;
    const to = last.report.pendingRows;
    const change =
        from > 0
            ? ` (${to > from ? "+" : ""}${formatPercent(to - from, from)})`
            : "";
    return `De ${formatNumber(from)} para ${formatNumber(to)} desde ${formatShortDate(first.startedAt)}${change}.`;
}

function Dashboard({ record, chartRuns, recent, onNavigate }: DashboardProps) {
    if (!record.report) return null;
    const stats = statsOf(record.report);
    const trend = trendText(chartRuns);

    return (
        <>
            {record.dryRun && (
                <Notice tone="warning" title="Esses números são de uma prévia.">
                    Nada foi gravado ainda. Quando estiver tudo certo, exporte
                    pela tela Exportar.
                </Notice>
            )}

            <Metrics
                label="Resumo da última execução"
                items={[
                    {
                        label: "Lidos",
                        value: stats.read,
                        hint: record.sourceLabel ?? "da fonte",
                    },
                    {
                        label: "No resultado",
                        value: stats.result,
                        hint: `${formatPercent(stats.result, stats.read)} dos lidos`,
                    },
                    {
                        label: "Pendências",
                        value: stats.pending,
                        hint: `${formatPercent(stats.pending, stats.read)} dos lidos`,
                        tone: stats.pending > 0 ? "warning" : undefined,
                    },
                    {
                        label: "Repetidos unidos",
                        value: stats.unified,
                        hint: `${formatPercent(stats.unified, stats.read)} dos lidos`,
                    },
                ]}
            />

            <div className="grid-two">
                <Panel title="Pendências por motivo">
                    {record.report.pendingByReason.length > 0 ? (
                        <ReasonList reasons={record.report.pendingByReason} />
                    ) : (
                        <p className="muted">
                            Nenhuma pendência nessa execução.
                        </p>
                    )}
                </Panel>
                <Panel
                    title="Pendências nas últimas exportações"
                    subtitle={trend ?? undefined}
                >
                    {chartRuns.length >= 2 ? (
                        <LineChart
                            points={chartRuns.map((run) => ({
                                label: formatShortDate(run.startedAt),
                                value: run.report?.pendingRows ?? 0,
                            }))}
                        />
                    ) : (
                        <p className="muted">
                            O gráfico aparece depois de duas exportações.
                        </p>
                    )}
                </Panel>
            </div>

            <Panel
                title="Últimas execuções"
                action={
                    <button
                        type="button"
                        className="link"
                        onClick={() => onNavigate("historico")}
                    >
                        Ver histórico completo
                    </button>
                }
            >
                <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Quando</th>
                                <th>Tipo</th>
                                <th className="number">Lidos</th>
                                <th className="number">No resultado</th>
                                <th className="number">Pendências</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recent.map((run) => (
                                <tr key={run.id}>
                                    <td>
                                        {formatFullDate(run.startedAt)} às{" "}
                                        {formatTime(run.startedAt)}
                                    </td>
                                    <td>
                                        {run.dryRun ? "Prévia" : "Exportação"}
                                    </td>
                                    <td className="number">
                                        {run.report
                                            ? formatNumber(run.report.rowsRead)
                                            : "-"}
                                    </td>
                                    <td className="number">
                                        {run.report
                                            ? formatNumber(run.report.rowsOut)
                                            : "-"}
                                    </td>
                                    <td className="number">
                                        {run.report
                                            ? formatNumber(
                                                  run.report.pendingRows,
                                              )
                                            : "-"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </>
    );
}
