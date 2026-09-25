import { BarChart } from "../components/BarChart";
import { DonutChart } from "../components/DonutChart";
import { Icon } from "../components/Icon";
import { LineChart } from "../components/LineChart";
import { Notice } from "../components/Notice";
import { Panel } from "../components/Panel";
import { PageId } from "../components/Sidebar";
import { StatCard } from "../components/StatCard";
import {
    fileName,
    formatDate,
    formatFullDate,
    formatNumber,
    formatPercent,
    formatShortDate,
    formatTime,
    greeting,
} from "../lib/format";
import {
    exportsForChart,
    latestExport,
    latestRun,
    statsOf,
} from "../lib/stats";
import { DateraState } from "../lib/useDatera";
import type { RunRecord } from "../../shared/api";

const MAX_BARS = 6;
const CHART_RUNS = 8;
const RECENT_RUNS = 4;

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
            <header className="page-header">
                <div>
                    <span className="eyebrow">Primeiros passos</span>
                    <h1>Vamos começar!</h1>
                    <p>
                        Primeiro o Datera precisa saber de onde ler os seus
                        dados e onde salvar o resultado.
                    </p>
                </div>
            </header>
            <Panel className="welcome">
                <span className="welcome-icon">
                    <Icon name="sparkle" size={32} />
                </span>
                <div>
                    <h3>Configurar em poucos passos</h3>
                    <p className="muted">
                        Um passo a passo pergunta de onde vêm os dados e onde
                        salvar. Se você já tem um arquivo de configuração, é só
                        escolher ele.
                    </p>
                </div>
                <div className="welcome-actions">
                    <button
                        type="button"
                        className="button primary"
                        onClick={() => onNavigate("assistente")}
                    >
                        Começar
                    </button>
                    <button
                        type="button"
                        className="button secondary"
                        onClick={() => void datera.chooseConfig()}
                    >
                        Já tenho um arquivo
                    </button>
                </div>
            </Panel>
        </div>
    );
}

function pendingBars(reasons: { reason: string; count: number }[]) {
    if (reasons.length <= MAX_BARS) {
        return reasons.map(({ reason, count }) => ({
            label: reason,
            value: count,
        }));
    }
    const shown = reasons.slice(0, MAX_BARS - 1);
    const others = reasons
        .slice(MAX_BARS - 1)
        .reduce((sum, item) => sum + item.count, 0);
    return [
        ...shown.map(({ reason, count }) => ({ label: reason, value: count })),
        { label: "Outros", value: others },
    ];
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

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1>{greeting()} 👋</h1>
                    <p>
                        {current
                            ? "Seus dados estão organizados e prontos para o que você precisa."
                            : `Tudo pronto com ${fileName(datera.settings.configPath)}. Que tal ver uma prévia?`}
                    </p>
                </div>
                <div className="header-actions">
                    {lastExport && (
                        <div className="last-export">
                            <Icon name="calendar" />
                            <div>
                                <span className="muted small">
                                    Última exportação
                                </span>
                                <strong>
                                    {formatDate(lastExport.startedAt)} •{" "}
                                    {formatTime(lastExport.startedAt)}
                                </strong>
                            </div>
                        </div>
                    )}
                    <button
                        type="button"
                        className="button primary large"
                        onClick={() => onNavigate("exportar")}
                    >
                        <Icon name="upload" />
                        Exportar agora
                        <Icon name="arrowRight" size={18} />
                    </button>
                </div>
            </header>

            {!current?.report ? (
                <Notice
                    tone="info"
                    title="Você ainda não rodou o Datera por aqui."
                    action={
                        <button
                            type="button"
                            className="button secondary"
                            onClick={() => onNavigate("exportar")}
                        >
                            <Icon name="eye" size={18} />
                            Ver uma prévia
                        </button>
                    }
                >
                    A prévia faz tudo sem gravar nada, então dá pra testar à
                    vontade.
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

function Dashboard({ record, chartRuns, recent, onNavigate }: DashboardProps) {
    if (!record.report) return null;
    const stats = statsOf(record.report);
    const bars = pendingBars(record.report.pendingByReason);
    const firstChartRun = chartRuns[0]?.report;
    const lastChartRun = chartRuns[chartRuns.length - 1]?.report;
    const trend =
        chartRuns.length >= 2 &&
        firstChartRun &&
        lastChartRun &&
        firstChartRun.pendingRows > 0
            ? (lastChartRun.pendingRows - firstChartRun.pendingRows) /
              firstChartRun.pendingRows
            : undefined;

    return (
        <>
            {record.dryRun && (
                <Notice tone="warning" title="Esses números são de uma prévia.">
                    Nada foi gravado ainda. Quando estiver tudo certo, é só
                    exportar.
                </Notice>
            )}

            <div className="grid-stats">
                <StatCard
                    icon="database"
                    tone="blue"
                    label="Registros lidos"
                    value={stats.read}
                    hint={
                        record.sourceLabel
                            ? `Fonte: ${record.sourceLabel}`
                            : "da sua fonte"
                    }
                />
                <StatCard
                    icon="check"
                    tone="green"
                    label="Registros válidos"
                    value={stats.valid}
                    hint={`${formatPercent(stats.valid, stats.read)} do total`}
                />
                <StatCard
                    icon="alert"
                    tone="orange"
                    label="Pendências"
                    value={stats.pending}
                    hint={`${formatPercent(stats.pending, stats.read)} do total`}
                />
                <StatCard
                    icon="merge"
                    tone="purple"
                    label="Duplicados unificados"
                    value={stats.unified}
                    hint={`${formatPercent(stats.unified, stats.read)} do total`}
                />
            </div>

            <div className="grid-charts">
                <Panel title="Registros válidos x pendências">
                    <DonutChart
                        centerLabel="registros"
                        slices={[
                            {
                                label: "Válidos",
                                value: stats.valid,
                                color: "#2563EB",
                            },
                            {
                                label: "Pendências",
                                value: stats.pending,
                                color: "#F59E0B",
                            },
                        ]}
                    />
                </Panel>
                <Panel title="Pendências por motivo">
                    {bars.length > 0 ? (
                        <BarChart bars={bars} />
                    ) : (
                        <div className="empty-chart">
                            <Icon name="check" size={28} />
                            <p>Nenhuma pendência nessa execução.</p>
                        </div>
                    )}
                </Panel>
            </div>

            <Panel
                title="Evolução das pendências nas últimas exportações"
                className="evolution"
            >
                {chartRuns.length >= 2 ? (
                    <div className="evolution-body">
                        <LineChart
                            points={chartRuns.map((run) => ({
                                label: formatShortDate(run.startedAt),
                                value: run.report?.pendingRows ?? 0,
                            }))}
                        />
                        {trend !== undefined && (
                            <TrendBox trend={trend} runs={chartRuns.length} />
                        )}
                    </div>
                ) : (
                    <div className="empty-chart">
                        <Icon name="trendDown" size={28} />
                        <p>
                            Depois de duas exportações o gráfico aparece aqui.
                        </p>
                    </div>
                )}
            </Panel>

            <Panel
                title="Últimas execuções"
                subtitle="O resumo das vezes que você rodou por aqui."
                action={
                    <button
                        type="button"
                        className="link"
                        onClick={() => onNavigate("historico")}
                    >
                        Ver histórico
                        <Icon name="arrowRight" size={16} />
                    </button>
                }
            >
                <ul className="recent-runs">
                    {recent.map((run) => (
                        <li key={run.id}>
                            <span className="recent-check">
                                <Icon
                                    name="check"
                                    size={16}
                                    strokeWidth={2.5}
                                />
                            </span>
                            <div>
                                <strong>
                                    {formatFullDate(run.startedAt)} •{" "}
                                    {formatTime(run.startedAt)}
                                    {run.dryRun && (
                                        <span className="tag">prévia</span>
                                    )}
                                </strong>
                                <span className="muted small">
                                    {run.report
                                        ? `${formatNumber(statsOf(run.report).valid)} válidos • ${formatNumber(run.report.pendingRows)} pendências`
                                        : ""}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            </Panel>
        </>
    );
}

function TrendBox({ trend, runs }: { trend: number; runs: number }) {
    const down = trend <= 0;
    const percent = `${trend > 0 ? "+" : ""}${formatPercent(trend * 100, 100)}`;
    return (
        <aside className={down ? "trend trend-good" : "trend trend-bad"}>
            <div className="trend-head">
                <span className="trend-icon">
                    <Icon name={down ? "check" : "alert"} strokeWidth={2.5} />
                </span>
                <div>
                    <strong>
                        {down ? "Tendência de queda" : "As pendências subiram"}
                    </strong>
                    <p className="muted small">
                        Comparando a primeira e a última das {runs} exportações
                        do gráfico.
                    </p>
                </div>
            </div>
            <div className="trend-number">
                <Icon name={down ? "trendDown" : "trendUp"} />
                <div>
                    <strong>{percent}</strong>
                    <span className="small">em relação à primeira</span>
                </div>
            </div>
        </aside>
    );
}
