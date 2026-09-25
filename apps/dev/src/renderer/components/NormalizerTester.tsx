import { useEffect, useRef, useState } from "react";
import type { NormalizerTest } from "../../../../desktop/src/shared/api";

interface NormalizerTesterProps {
    names: string[];
    onTest: (
        name: string,
        values: string[],
    ) => Promise<NormalizerTest[] | string>;
}

export function NormalizerTester({ names, onTest }: NormalizerTesterProps) {
    const [name, setName] = useState(names[0] ?? "");
    const [values, setValues] = useState("2024-0042\n20240042\n2024-42");
    const [results, setResults] = useState<NormalizerTest[]>([]);
    const [error, setError] = useState<string | null>(null);

    const runRef = useRef<() => Promise<void>>(async () => {});

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (
                event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey &&
                event.code === "KeyT"
            ) {
                event.preventDefault();
                void runRef.current();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const run = async () => {
        const outcome = await onTest(
            name.trim(),
            values.split("\n").filter((value) => value.trim() !== ""),
        );
        if (typeof outcome === "string") {
            setError(outcome);
            setResults([]);
        } else {
            setError(null);
            setResults(outcome);
        }
    };

    runRef.current = run;

    return (
        <section className="tester" aria-label="Testar normalizador">
            <header className="tester-head">
                <span className="section-title">Testar</span>
                <input
                    className="field mono"
                    list="normalizer-names"
                    placeholder="nome do normalizador"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
                <datalist id="normalizer-names">
                    {names.map((item) => (
                        <option key={item} value={item} />
                    ))}
                </datalist>
                <button
                    type="button"
                    className="btn"
                    onClick={() => void run()}
                    disabled={!name.trim()}
                >
                    Testar <kbd>Ctrl+T</kbd>
                </button>
            </header>
            <div className="tester-body">
                <textarea
                    className="field mono"
                    value={values}
                    onChange={(event) => setValues(event.target.value)}
                    aria-label="Valores de teste, um por linha"
                    spellCheck={false}
                />
                <div className="tester-results mono" aria-live="polite">
                    {error && <p className="err">{error}</p>}
                    {!error && results.length === 0 && (
                        <p className="muted">
                            Salve e teste para ver o resultado de cada valor.
                        </p>
                    )}
                    {results.map((result, index) => (
                        <div
                            key={index}
                            className={result.valid ? "ok" : "err"}
                        >
                            <span>{result.valid ? "✓" : "✗"}</span>
                            <span className="value">
                                {JSON.stringify(result.value)}
                            </span>
                            <span className="arrow">→</span>
                            <span>{result.result}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
