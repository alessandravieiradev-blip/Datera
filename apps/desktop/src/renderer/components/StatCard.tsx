import { Icon, IconName } from "./Icon";
import { formatNumber } from "../lib/format";

export type Tone = "blue" | "green" | "orange" | "purple";

interface StatCardProps {
    icon: IconName;
    tone: Tone;
    label: string;
    value: number;
    hint: string;
}

export function StatCard({ icon, tone, label, value, hint }: StatCardProps) {
    return (
        <article className="panel stat-card">
            <span className={`stat-icon tone-${tone}`}>
                <Icon name={icon} size={24} strokeWidth={2} />
            </span>
            <div>
                <p className="stat-label">{label}</p>
                <p className="stat-value">{formatNumber(value)}</p>
                <p className="muted small">{hint}</p>
            </div>
        </article>
    );
}
