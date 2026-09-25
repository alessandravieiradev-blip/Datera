import { keysOf } from "../lib/shortcuts";

export function Keys({ combo }: { combo: string }) {
    const keys = keysOf(combo);
    if (keys.length === 0)
        return <span className="muted small">Sem atalho</span>;
    return (
        <span className="keys">
            {keys.map((key, index) => (
                <kbd key={`${key}-${index}`}>{key}</kbd>
            ))}
        </span>
    );
}
