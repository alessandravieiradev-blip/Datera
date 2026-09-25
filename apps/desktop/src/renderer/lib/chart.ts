const STEPS = [1, 2, 2.5, 5, 10];

export interface Scale {
    max: number;
    ticks: number[];
}

export function niceScale(value: number, tickCount: number = 5): Scale {
    const raw = Math.max(value, 1) / tickCount;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const multiplier = STEPS.find((step) => step * magnitude >= raw) ?? 10;
    const step = Math.max(multiplier * magnitude, 1);
    const max = Math.ceil(value / step) * step || step;
    const ticks: number[] = [];
    for (let tick = 0; tick <= max; tick += step) ticks.push(tick);
    return { max, ticks };
}

export function wrapLabel(
    label: string,
    maxChars: number,
    maxLines: number = 2,
): string[] {
    const lines: string[] = [];
    let current = "";
    for (const word of label.split(/\s+/)) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxChars || current === "") {
            current = next;
        } else {
            lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);

    if (lines.length <= maxLines) {
        return lines.map((line) =>
            line.length > maxChars ? `${line.slice(0, maxChars - 1)}…` : line,
        );
    }
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1] ?? "";
    kept[maxLines - 1] = `${last.slice(0, maxChars - 1)}…`;
    return kept;
}
