import { KeyboardEvent, useEffect, useMemo, useRef } from "react";
import { Language, tokensByLine } from "../lib/highlight";

export interface EditorApi {
    goTo: (line: number, column?: number) => void;
    insert: (text: string) => void;
    focus: () => void;
}

interface CodeEditorProps {
    value: string;
    language: Language;
    onChange: (value: string) => void;
    errorLines?: Set<number>;
    apiRef?: { current: EditorApi | null };
    label: string;
}

const INDENT = "    ";

export function CodeEditor({
    value,
    language,
    onChange,
    errorLines,
    apiRef,
    label,
}: CodeEditorProps) {
    const area = useRef<HTMLTextAreaElement>(null);
    const layer = useRef<HTMLPreElement>(null);
    const gutter = useRef<HTMLDivElement>(null);
    const lines = useMemo(
        () => tokensByLine(value, language),
        [value, language],
    );

    const replaceSelection = (text: string, cursorOffset = text.length) => {
        const element = area.current;
        if (!element) return;
        const { selectionStart, selectionEnd } = element;
        const next =
            value.slice(0, selectionStart) + text + value.slice(selectionEnd);
        onChange(next);
        requestAnimationFrame(() => {
            element.selectionStart = element.selectionEnd =
                selectionStart + cursorOffset;
        });
    };

    useEffect(() => {
        if (!apiRef) return;
        apiRef.current = {
            focus: () => area.current?.focus(),
            insert: (text) => {
                area.current?.focus();
                replaceSelection(text);
            },
            goTo: (line, column = 1) => {
                const element = area.current;
                if (!element) return;
                const offset =
                    value
                        .split("\n")
                        .slice(0, line - 1)
                        .reduce((total, part) => total + part.length + 1, 0) +
                    column -
                    1;
                element.focus();
                element.selectionStart = element.selectionEnd = offset;
                const lineHeight = 20;
                element.scrollTop = Math.max(0, (line - 5) * lineHeight);
            },
        };
    });

    const syncScroll = () => {
        const element = area.current;
        if (!element) return;
        if (layer.current) {
            layer.current.style.transform = `translate(${-element.scrollLeft}px, ${-element.scrollTop}px)`;
        }
        if (gutter.current) gutter.current.scrollTop = element.scrollTop;
    };

    useEffect(syncScroll, [value]);

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        const element = event.currentTarget;
        if (event.key === "Tab" && !event.ctrlKey) {
            event.preventDefault();
            if (event.shiftKey) {
                const lineStart =
                    value.lastIndexOf("\n", element.selectionStart - 1) + 1;
                if (value.startsWith(INDENT, lineStart)) {
                    const start = element.selectionStart;
                    onChange(
                        value.slice(0, lineStart) +
                            value.slice(lineStart + INDENT.length),
                    );
                    requestAnimationFrame(() => {
                        element.selectionStart = element.selectionEnd =
                            Math.max(lineStart, start - INDENT.length);
                    });
                }
                return;
            }
            replaceSelection(INDENT);
            return;
        }
        if (
            event.key === "Enter" &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
        ) {
            event.preventDefault();
            const lineStart =
                value.lastIndexOf("\n", element.selectionStart - 1) + 1;
            const indent = value.slice(lineStart).match(/^\s*/)?.[0] ?? "";
            const before = value.slice(0, element.selectionStart).trimEnd();
            const opens = before.endsWith("{") || before.endsWith("[");
            const after = value.slice(element.selectionEnd).trimStart();
            const closes = after.startsWith("}") || after.startsWith("]");
            if (opens && closes) {
                const inner = `\n${indent}${INDENT}`;
                replaceSelection(`${inner}\n${indent}`, inner.length);
                return;
            }
            replaceSelection(`\n${indent}${opens ? INDENT : ""}`);
        }
    };

    return (
        <div className="editor">
            <div className="gutter" ref={gutter} aria-hidden="true">
                {lines.map((_, index) => (
                    <div
                        key={index}
                        className={
                            errorLines?.has(index + 1) ? "ln error" : "ln"
                        }
                    >
                        {index + 1}
                    </div>
                ))}
            </div>
            <div className="code-area">
                <pre className="code-layer" ref={layer} aria-hidden="true">
                    {lines.map((tokens, index) => (
                        <div
                            key={index}
                            className={
                                errorLines?.has(index + 1) ? "cl error" : "cl"
                            }
                        >
                            {tokens.map((token, tokenIndex) => (
                                <span
                                    key={tokenIndex}
                                    className={`t-${token.type}`}
                                >
                                    {token.text}
                                </span>
                            ))}
                        </div>
                    ))}
                </pre>
                <textarea
                    ref={area}
                    className="code-input"
                    value={value}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    wrap="off"
                    aria-label={label}
                    onChange={(event) => onChange(event.target.value)}
                    onScroll={syncScroll}
                    onKeyDown={onKeyDown}
                />
            </div>
        </div>
    );
}
