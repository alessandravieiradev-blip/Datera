import { useEffect, useRef } from "react";
import type { LogEntry } from "../../shared/api";
import { formatTime } from "../lib/format";

interface RunLogProps {
    entries: LogEntry[];
}

export function RunLog({ entries }: RunLogProps) {
    const end = useRef<HTMLLIElement>(null);

    useEffect(() => {
        end.current?.scrollIntoView({ block: "nearest" });
    }, [entries.length]);

    if (entries.length === 0) {
        return (
            <p className="muted small">
                As mensagens aparecem aqui enquanto ele roda.
            </p>
        );
    }

    return (
        <ol className="run-log">
            {entries.map((entry, index) => (
                <li
                    key={`${entry.at}-${index}`}
                    className={`log-${entry.level}`}
                >
                    <time>{formatTime(entry.at)}</time>
                    <span>{entry.message}</span>
                </li>
            ))}
            <li ref={end} aria-hidden="true" />
        </ol>
    );
}
