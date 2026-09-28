import { formatNumber } from "../lib/format";

export interface Metric {
    label: string;
    value: number;
    hint?: string | undefined;
    tone?: "warning" | undefined;
}

interface MetricsProps {
    label: string;
    items: Metric[];
}

export function Metrics({ label, items }: MetricsProps) {
    return (
        <dl className="metrics" aria-label={label}>
            {items.map((item) => (
                <div
                    key={item.label}
                    className={
                        item.tone ? `metric metric-${item.tone}` : "metric"
                    }
                >
                    <dt>{item.label}</dt>
                    <dd className="metric-value">{formatNumber(item.value)}</dd>
                    {item.hint && <dd className="metric-hint">{item.hint}</dd>}
                </div>
            ))}
        </dl>
    );
}
