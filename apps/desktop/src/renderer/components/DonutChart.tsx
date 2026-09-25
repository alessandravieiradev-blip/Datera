import { formatNumber, formatPercent } from "../lib/format";

interface Slice {
    label: string;
    value: number;
    color: string;
}

interface DonutChartProps {
    slices: Slice[];
    centerLabel: string;
}

const SIZE = 200;
const STROKE = 34;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ slices, centerLabel }: DonutChartProps) {
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    let offset = 0;

    return (
        <div className="donut">
            <svg
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                role="img"
                aria-label={slices
                    .map((slice) => `${slice.label}: ${slice.value}`)
                    .join(", ")}
            >
                <circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={STROKE}
                />
                {total > 0 &&
                    slices.map((slice) => {
                        const length = (slice.value / total) * CIRCUMFERENCE;
                        const circle = (
                            <circle
                                key={slice.label}
                                cx={SIZE / 2}
                                cy={SIZE / 2}
                                r={RADIUS}
                                fill="none"
                                stroke={slice.color}
                                strokeWidth={STROKE}
                                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                                strokeDashoffset={-offset}
                                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                            />
                        );
                        offset += length;
                        return circle;
                    })}
                <text
                    x="50%"
                    y="48%"
                    textAnchor="middle"
                    className="donut-total"
                >
                    {formatNumber(total)}
                </text>
                <text
                    x="50%"
                    y="60%"
                    textAnchor="middle"
                    className="donut-caption"
                >
                    {centerLabel}
                </text>
            </svg>
            <ul className="legend">
                {slices.map((slice) => (
                    <li key={slice.label}>
                        <span
                            className="dot"
                            style={{ background: slice.color }}
                        />
                        <div>
                            <strong>{slice.label}</strong>
                            <span className="muted">
                                {formatNumber(slice.value)} (
                                {formatPercent(slice.value, total)})
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
