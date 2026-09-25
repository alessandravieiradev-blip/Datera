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
    const first = coords[0];
    const last = coords[coords.length - 1];
    const area =
        first && last
            ? `M${first.x},${TOP + plotHeight} L${line.replace(/ /g, " L")} L${last.x},${TOP + plotHeight} Z`
            : "";

    return (
        <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img">
            <defs>
                <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                </linearGradient>
            </defs>
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
            <path d={area} fill="url(#area-fill)" />
            <polyline
                points={line}
                fill="none"
                stroke="#2563EB"
                strokeWidth={2.5}
            />
            {coords.map((c, index) => (
                <g key={`${c.label}-${index}`}>
                    <circle
                        cx={c.x}
                        cy={c.y}
                        r={5}
                        fill="#2563EB"
                        stroke="#fff"
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
