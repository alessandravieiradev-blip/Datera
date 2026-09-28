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
