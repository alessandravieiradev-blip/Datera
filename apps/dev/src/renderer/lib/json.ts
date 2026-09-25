import { etlConfigSchema } from "../../../../../src/config/schema";

export interface Problem {
    line: number;
    column: number;
    message: string;
    where: string;
}

type PathKey = string | number;

class Locator {
    private index = 0;
    readonly positions = new Map<string, number>();

    constructor(private readonly text: string) {}

    run(): void {
        this.value([]);
    }

    private skip(): void {
        while (/\s/.test(this.text[this.index] ?? "")) this.index += 1;
    }

    private value(path: PathKey[]): void {
        this.skip();
        this.positions.set(JSON.stringify(path), this.index);
        const char = this.text[this.index];
        if (char === "{") this.object(path);
        else if (char === "[") this.array(path);
        else if (char === '"') this.string();
        else this.primitive();
    }

    private string(): string {
        const start = this.index;
        this.index += 1;
        while (this.index < this.text.length && this.text[this.index] !== '"') {
            this.index += this.text[this.index] === "\\" ? 2 : 1;
        }
        this.index += 1;
        return JSON.parse(this.text.slice(start, this.index)) as string;
    }

    private primitive(): void {
        while (
            this.index < this.text.length &&
            !/[,}\]\s]/.test(this.text[this.index] ?? "")
        ) {
            this.index += 1;
        }
    }

    private object(path: PathKey[]): void {
        this.index += 1;
        this.skip();
        if (this.text[this.index] === "}") {
            this.index += 1;
            return;
        }
        while (this.index < this.text.length) {
            this.skip();
            const keyStart = this.index;
            const key = this.string();
            this.positions.set(
                JSON.stringify([...path, key]) + ":key",
                keyStart,
            );
            this.skip();
            this.index += 1;
            this.value([...path, key]);
            this.skip();
            if (this.text[this.index] === ",") {
                this.index += 1;
                continue;
            }
            this.index += 1;
            return;
        }
    }

    private array(path: PathKey[]): void {
        this.index += 1;
        this.skip();
        if (this.text[this.index] === "]") {
            this.index += 1;
            return;
        }
        let position = 0;
        while (this.index < this.text.length) {
            this.value([...path, position]);
            position += 1;
            this.skip();
            if (this.text[this.index] === ",") {
                this.index += 1;
                continue;
            }
            this.index += 1;
            return;
        }
    }
}

export function lineAndColumn(
    text: string,
    offset: number,
): { line: number; column: number } {
    const before = text.slice(0, offset);
    const lines = before.split("\n");
    return {
        line: lines.length,
        column: (lines[lines.length - 1]?.length ?? 0) + 1,
    };
}

function offsetOf(locator: Locator, path: PathKey[]): number {
    for (let size = path.length; size >= 0; size -= 1) {
        const part = path.slice(0, size);
        const asKey = locator.positions.get(JSON.stringify(part) + ":key");
        if (asKey !== undefined) return asKey;
        const asValue = locator.positions.get(JSON.stringify(part));
        if (asValue !== undefined) return asValue;
    }
    return 0;
}

function parseErrorProblem(text: string, error: unknown): Problem {
    const raw = error instanceof Error ? error.message : String(error);
    const lineMatch = raw.match(/line (\d+) column (\d+)/);
    const positionMatch = raw.match(/position (\d+)/);
    const place = lineMatch
        ? { line: Number(lineMatch[1]), column: Number(lineMatch[2]) }
        : positionMatch
          ? lineAndColumn(text, Number(positionMatch[1]))
          : { line: 1, column: 1 };
    return { ...place, message: `JSON inválido: ${raw}`, where: "" };
}

const TYPE_NAMES: Record<string, string> = {
    string: "texto",
    number: "número",
    boolean: "true ou false",
    array: "lista",
    object: "objeto",
};

interface IssueLike {
    code: string;
    message: string;
    expected?: unknown;
    values?: unknown;
}

function translate(issue: IssueLike): string {
    const expected =
        typeof issue.expected === "string"
            ? (TYPE_NAMES[issue.expected] ?? issue.expected)
            : "";
    switch (issue.code) {
        case "invalid_type":
            return /received undefined/.test(issue.message)
                ? `Campo obrigatório (${expected}).`
                : `Tipo errado: aqui vai ${expected}.`;
        case "invalid_value":
            return Array.isArray(issue.values)
                ? `Valor não aceito. Use um destes: ${issue.values.map((value) => JSON.stringify(value)).join(", ")}.`
                : "Valor não aceito.";
        case "invalid_union":
            return "Valor não aceito aqui. Confira o type e os campos obrigatórios.";
        case "too_small":
            return "Não pode ficar vazio.";
        case "unrecognized_keys":
            return "Tem campos que o Datera não conhece.";
        default:
            return issue.message;
    }
}

export interface CheckResult {
    problems: Problem[];
    value: unknown;
}

export function checkConfig(text: string): CheckResult {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch (error) {
        return { problems: [parseErrorProblem(text, error)], value: undefined };
    }
    const result = etlConfigSchema.safeParse(value);
    if (result.success) return { problems: [], value };

    const locator = new Locator(text);
    locator.run();
    const problems = result.error.issues.map((issue) => {
        const path = issue.path.filter(
            (part): part is string | number =>
                typeof part === "string" || typeof part === "number",
        );
        return {
            ...lineAndColumn(text, offsetOf(locator, path)),
            message: translate(issue),
            where: path.join("."),
        };
    });
    return { problems, value };
}

export function formatJson(text: string): string | null {
    try {
        return `${JSON.stringify(JSON.parse(text), null, 4)}\n`;
    } catch {
        return null;
    }
}
