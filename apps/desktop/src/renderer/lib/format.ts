const numberFormat = new Intl.NumberFormat("pt-BR");
const percentFormat = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
});
const shortDateFormat = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
});
const fullDateFormat = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
});

export function formatNumber(value: number): string {
    return numberFormat.format(value);
}

export function formatPercent(part: number, total: number): string {
    if (total === 0) return "0%";
    return `${percentFormat.format((part / total) * 100)}%`;
}

export function formatDate(iso: string): string {
    return dateFormat.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
    return shortDateFormat.format(new Date(iso));
}

export function formatFullDate(iso: string): string {
    return fullDateFormat.format(new Date(iso));
}

export function formatTime(iso: string): string {
    return timeFormat.format(new Date(iso));
}

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${percentFormat.format(ms / 1000)} s`;
}

export function fileName(filePath: string): string {
    return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function greeting(now: Date = new Date()): string {
    const hour = now.getHours();
    if (hour < 12) return "Bom dia!";
    if (hour < 18) return "Boa tarde!";
    return "Boa noite!";
}
