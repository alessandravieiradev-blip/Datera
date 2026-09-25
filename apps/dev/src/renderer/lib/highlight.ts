export type TokenType =
    | "key"
    | "string"
    | "number"
    | "literal"
    | "keyword"
    | "comment"
    | "punct"
    | "plain";

export interface Token {
    type: TokenType;
    text: string;
}

export type Language = "json" | "js";

const JS_KEYWORDS = new Set([
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "of",
    "in",
    "while",
    "new",
    "module",
    "exports",
    "require",
    "import",
    "export",
    "from",
    "typeof",
    "instanceof",
    "throw",
    "try",
    "catch",
    "async",
    "await",
    "class",
]);

const LITERALS = new Set(["true", "false", "null", "undefined"]);

function readString(text: string, start: number, quote: string): number {
    let index = start + 1;
    while (index < text.length) {
        const char = text[index];
        if (char === "\\") {
            index += 2;
            continue;
        }
        if (char === quote) return index + 1;
        if (char === "\n" && quote !== "`") return index;
        index += 1;
    }
    return index;
}

export function tokenize(text: string, language: Language): Token[] {
    const tokens: Token[] = [];
    let index = 0;
    const push = (type: TokenType, end: number) => {
        tokens.push({ type, text: text.slice(index, end) });
        index = end;
    };

    while (index < text.length) {
        const char = text[index] ?? "";
        const next = text[index + 1] ?? "";

        if (language === "js" && char === "/" && next === "/") {
            const end = text.indexOf("\n", index);
            push("comment", end === -1 ? text.length : end);
            continue;
        }
        if (language === "js" && char === "/" && next === "*") {
            const end = text.indexOf("*/", index + 2);
            push("comment", end === -1 ? text.length : end + 2);
            continue;
        }
        if (
            char === '"' ||
            (language === "js" && (char === "'" || char === "`"))
        ) {
            const end = readString(text, index, char);
            const after = text.slice(end).match(/^\s*:/);
            push(language === "json" && after ? "key" : "string", end);
            continue;
        }
        if (/[0-9]/.test(char) || (char === "-" && /[0-9]/.test(next))) {
            const match = text
                .slice(index)
                .match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
            push("number", index + (match?.[0].length ?? 1));
            continue;
        }
        if (/[A-Za-z_$]/.test(char)) {
            const match = text.slice(index).match(/^[A-Za-z_$][\w$]*/);
            const word = match?.[0] ?? char;
            const type: TokenType = LITERALS.has(word)
                ? "literal"
                : language === "js" && JS_KEYWORDS.has(word)
                  ? "keyword"
                  : "plain";
            push(type, index + word.length);
            continue;
        }
        if (/[{}[\]:,();=>.+\-*/!?&|<]/.test(char)) {
            push("punct", index + 1);
            continue;
        }
        const match = text
            .slice(index)
            .match(/^[^"'`/A-Za-z_$0-9{}[\]:,();=>.+\-*!?&|<]+/);
        push("plain", index + (match?.[0].length ?? 1));
    }
    return tokens;
}

export function tokensByLine(text: string, language: Language): Token[][] {
    const lines: Token[][] = [[]];
    for (const token of tokenize(text, language)) {
        const parts = token.text.split("\n");
        parts.forEach((part, partIndex) => {
            if (partIndex > 0) lines.push([]);
            if (part !== "")
                lines[lines.length - 1]?.push({ type: token.type, text: part });
        });
    }
    return lines;
}
