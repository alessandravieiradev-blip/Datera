import { formatNumber } from "../lib/format";

interface ReasonListProps {
    reasons: { reason: string; count: number }[];
    limit?: number;
}

export function ReasonList({ reasons, limit = 8 }: ReasonListProps) {
    const sorted = [...reasons].sort((a, b) => b.count - a.count);
    const shown = sorted.slice(0, limit);
    const rest = sorted.slice(limit).reduce((sum, item) => sum + item.count, 0);
    const items =
        rest > 0
            ? [...shown, { reason: "Outros motivos", count: rest }]
            : shown;
    const max = Math.max(...items.map((item) => item.count), 1);

    return (
        <ul className="reason-list">
            {items.map((item) => (
                <li key={item.reason}>
                    <span className="reason-label">{item.reason}</span>
                    <span className="reason-bar" aria-hidden="true">
                        <span
                            style={{ width: `${(item.count / max) * 100}%` }}
                        />
                    </span>
                    <span className="reason-count">
                        {formatNumber(item.count)}
                    </span>
                </li>
            ))}
        </ul>
    );
}
