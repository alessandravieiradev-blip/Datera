import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { matches, score } from "../lib/fuzzy";

export interface PaletteCommand {
    id: string;
    label: string;
    group: string;
    keys?: string | undefined;
    disabled?: boolean | undefined;
    run: () => void;
}

interface CommandPaletteProps {
    commands: PaletteCommand[];
    onClose: () => void;
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLUListElement>(null);

    const visible = useMemo(
        () =>
            commands
                .filter(
                    (command) =>
                        !command.disabled &&
                        matches(query, `${command.group} ${command.label}`),
                )
                .map((command, index) => ({
                    command,
                    index,
                    rank: score(query, command.label),
                }))
                .sort((a, b) => a.rank - b.rank || a.index - b.index)
                .map(({ command }) => command),
        [commands, query],
    );

    useEffect(() => input.current?.focus(), []);
    useEffect(() => setActive(0), [query]);
    useEffect(() => {
        list.current
            ?.querySelector(".active")
            ?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const choose = (command: PaletteCommand | undefined) => {
        if (!command) return;
        onClose();
        command.run();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, visible.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
        } else if (event.key === "Enter") {
            event.preventDefault();
            choose(visible[active]);
        } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
        }
    };

    return (
        <div
            className="palette-overlay"
            onMouseDown={(event) =>
                event.target === event.currentTarget && onClose()
            }
        >
            <div
                className="palette"
                role="dialog"
                aria-modal="true"
                aria-label="Paleta de comandos"
            >
                <input
                    ref={input}
                    className="palette-input"
                    placeholder="Digite um comando..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={onKeyDown}
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="palette-list"
                />
                <ul
                    className="palette-list"
                    id="palette-list"
                    role="listbox"
                    ref={list}
                >
                    {visible.length === 0 && (
                        <li className="palette-empty">
                            Nenhum comando encontrado.
                        </li>
                    )}
                    {visible.map((command, index) => (
                        <li
                            key={command.id}
                            role="option"
                            aria-selected={index === active}
                            className={index === active ? "active" : ""}
                            onMouseEnter={() => setActive(index)}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                choose(command);
                            }}
                        >
                            <span className="palette-group">
                                {command.group}
                            </span>
                            <span className="palette-label">
                                {command.label}
                            </span>
                            {command.keys && <kbd>{command.keys}</kbd>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
