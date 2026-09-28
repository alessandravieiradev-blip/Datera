import { niceScale } from "../lib/chart";
import { formatNumber } from "../lib/format";

interface Point {
    label: string;
    value: number;
}

interface LineChartProps {
    points: Point[];
}

const WIDTH = 820;
const HEIGHT = 220;
const LEFT = 48;
const RIGHT = 24;
const TOP = 28;
const BOTTOM = 32;

export function LineChart({ points }: LineChartProps) {
    const { max, ticks } = niceScale(
        Math.max(...points.map((point) => point.value), 1) * 1.1,
    );
    const plotWidth = WIDTH - LEFT - RIGHT;
    const plotHeight = HEIGHT - TOP - BOTTOM;
    const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;

    const coords = points.map((point, index) => ({
        ...point,
        x: LEFT + step * index,
        y: TOP + plotHeight - (point.value / max) * plotHeight,
    }));
    const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
    return (
        <svg
            className="chart"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`Pendências por exportação: ${points
                .map((point) => `${point.label}, ${formatNumber(point.value)}`)
                .join("; ")}`}
        >
            {ticks.map((tick) => {
                const y = TOP + plotHeight - (tick / max) * plotHeight;
                return (
                    <g key={tick}>
                        <line
                            x1={LEFT}
                            x2={WIDTH - RIGHT}
                            y1={y}
                            y2={y}
                            className="grid-line"
                        />
                        <text
                            x={LEFT - 10}
                            y={y + 4}
                            textAnchor="end"
                            className="axis-label"
                        >
                            {formatNumber(tick)}
                        </text>
                    </g>
                );
            })}
            <polyline
                points={line}
                fill="none"
                stroke="var(--blue)"
                strokeWidth={2}
            />
            {coords.map((c, index) => (
                <g key={`${c.label}-${index}`}>
                    <circle
                        cx={c.x}
                        cy={c.y}
                        r={3.5}
                        fill="var(--blue)"
                        stroke="var(--surface)"
                        strokeWidth={2}
                    />
                    <text
                        x={c.x}
                        y={c.y - 12}
                        textAnchor="middle"
                        className="value-label"
                    >
                        {formatNumber(c.value)}
                    </text>
                    <text
                        x={c.x}
                        y={HEIGHT - 8}
                        textAnchor="middle"
                        className="axis-label"
                    >
                        {c.label}
                    </text>
                </g>
            ))}
        </svg>
    );
}
