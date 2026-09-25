import { niceScale, wrapLabel } from "../lib/chart";
import { formatNumber } from "../lib/format";

export const CHART_COLORS = [
    "#2563EB",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#06B6D4",
    "#94A3B8",
];

interface Bar {
    label: string;
    value: number;
}

interface BarChartProps {
    bars: Bar[];
}

const WIDTH = 640;
const HEIGHT = 230;
const LEFT = 40;
const BOTTOM = 48;
const CHAR_WIDTH = 6.4;
const TOP = 24;

export function BarChart({ bars }: BarChartProps) {
    const { max, ticks } = niceScale(
        Math.max(...bars.map((bar) => bar.value), 1),
    );
    const plotHeight = HEIGHT - TOP - BOTTOM;
    const slot = (WIDTH - LEFT) / Math.max(bars.length, 1);
    const barWidth = Math.min(58, slot * 0.6);
    const maxChars = Math.max(6, Math.floor((slot - 6) / CHAR_WIDTH));

    return (
        <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img">
            {ticks.map((tick) => {
                const y = TOP + plotHeight - (tick / max) * plotHeight;
                return (
                    <g key={tick}>
                        <line
                            x1={LEFT}
                            x2={WIDTH}
                            y1={y}
                            y2={y}
                            className="grid-line"
                        />
                        <text
                            x={LEFT - 8}
                            y={y + 4}
                            textAnchor="end"
                            className="axis-label"
                        >
                            {formatNumber(Math.round(tick))}
                        </text>
                    </g>
                );
            })}
            {bars.map((bar, index) => {
                const height = (bar.value / max) * plotHeight;
                const x = LEFT + slot * index + (slot - barWidth) / 2;
                const y = TOP + plotHeight - height;
                return (
                    <g key={bar.label}>
                        <title>{`${bar.label}: ${bar.value}`}</title>
                        <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={height}
                            rx={4}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                        <text
                            x={x + barWidth / 2}
                            y={y - 8}
                            textAnchor="middle"
                            className="value-label"
                        >
                            {formatNumber(bar.value)}
                        </text>
                        <text
                            x={x + barWidth / 2}
                            y={HEIGHT - BOTTOM + 18}
                            textAnchor="middle"
                            className="axis-label"
                        >
                            {wrapLabel(bar.label, maxChars).map(
                                (line, lineIndex) => (
                                    <tspan
                                        key={line}
                                        x={x + barWidth / 2}
                                        dy={lineIndex === 0 ? 0 : 14}
                                    >
                                        {line}
                                    </tspan>
                                ),
                            )}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
