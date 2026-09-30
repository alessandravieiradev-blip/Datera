import fs from "fs";
import path from "path";
import { isSameFile } from "../io/safety";
import { detectFormat } from "./formats";

const TARGETS: Record<string, string> = {
    csv: ".csv",
    tsv: ".tsv",
    json: ".json",
    xml: ".xml",
    xlsx: ".xlsx",
    excel: ".xlsx",
    parquet: ".parquet",
    db: ".db",
    sqlite: ".db",
    sqlite3: ".sqlite3",
};

export interface PlannedFile {
    input: string;
    output: string;
    sheet?: string | undefined;
}

function hasWildcard(text: string): boolean {
    return /[*?]/.test(text);
}

function patternToRegExp(pattern: string): RegExp {
    const source = pattern
        .split("")
        .map((char) => {
            if (char === "*") return ".*";
            if (char === "?") return ".";
            return char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        })
        .join("");
    const flags = process.platform === "win32" ? "i" : "";
    return new RegExp(`^${source}$`, flags);
}

function isKnownFormat(file: string): boolean {
    try {
        detectFormat(file);
        return true;
    } catch {
        return false;
    }
}

function filesIn(folder: string, accept: (name: string) => boolean): string[] {
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
        throw new Error(`Não achei a pasta ${folder}.`);
    }
    return fs
        .readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
        .map((entry) => entry.name)
        .filter((name) => accept(name) && isKnownFormat(name))
        .map((name) => path.join(folder, name));
}

function expand(input: string): string[] {
    if (hasWildcard(input)) {
        const folder = path.dirname(input);
        if (hasWildcard(folder)) {
            throw new Error(
                `Em "${input}", o * só pode estar no nome do arquivo, não no nome da pasta.`,
            );
        }
        const pattern = patternToRegExp(path.basename(input));
        return filesIn(folder, (name) => pattern.test(name));
    }
    if (fs.existsSync(input) && fs.statSync(input).isDirectory()) {
        return filesIn(input, () => true);
    }
    if (!fs.existsSync(input)) {
        throw new Error(`Não achei o arquivo ${input}.`);
    }
    return [input];
}

export function findFiles(inputs: string | string[]): string[] {
    const list = Array.isArray(inputs) ? inputs : [inputs];
    const found: string[] = [];
    for (const input of list) {
        for (const file of expand(input)) {
            if (!found.some((other) => isSameFile(other, file))) {
                found.push(file);
            }
        }
    }
    if (found.length === 0) {
        throw new Error(
            `Nenhum arquivo encontrado em ${list.join(", ")}. Confira o caminho e a extensão.`,
        );
    }
    return found.sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

export function extensionFor(target: string): string {
    const key = target.trim().toLowerCase().replace(/^\./, "");
    if (!Object.hasOwn(TARGETS, key)) {
        throw new Error(
            `Não conheço o formato "${target}". Os que dá pra usar: ${Object.keys(TARGETS).join(", ")}.`,
        );
    }
    return TARGETS[key]!;
}

export function fileSafeName(name: string): string {
    const clean = name
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
        .trim()
        .replace(/[. ]+$/, "");
    if (clean === "") return "aba";
    return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(clean) ? `_${clean}` : clean;
}

export function checkPlan(plan: PlannedFile[]): PlannedFile[] {
    const label = (item: PlannedFile) =>
        item.sheet === undefined
            ? item.input
            : `a aba "${item.sheet}" de ${item.input}`;
    plan.forEach((item, index) => {
        const twin = plan.find(
            (other, otherIndex) =>
                otherIndex < index && isSameFile(other.output, item.output),
        );
        if (twin) {
            throw new Error(
                `${label(twin)} e ${label(item)} iam virar o mesmo arquivo (${item.output}). Renomeie um deles ou converta em pastas separadas.`,
            );
        }
        const overwritten = plan.find((other) =>
            isSameFile(other.input, item.output),
        );
        if (overwritten) {
            throw new Error(
                `Converter ${label(item)} ia gravar por cima de ${overwritten.input}, que é uma das entradas. Escolha outro formato ou use --out-dir com outra pasta.`,
            );
        }
    });
    return plan;
}

function outputPath(
    input: string,
    extension: string,
    outDir: string | undefined,
    suffix: string = "",
): string {
    return path.join(
        outDir ?? path.dirname(input),
        `${path.basename(input, path.extname(input))}${suffix}${extension}`,
    );
}

export function planOutputs(
    files: string[],
    target: string,
    outDir?: string,
): PlannedFile[] {
    const extension = extensionFor(target);
    return checkPlan(
        files.map((input) => ({
            input,
            output: outputPath(input, extension, outDir),
        })),
    );
}

export function planSheetOutputs(
    input: string,
    sheets: string[],
    target: string,
    outDir?: string,
): PlannedFile[] {
    const extension = extensionFor(target);
    return sheets.map((sheet) => ({
        input,
        sheet,
        output: outputPath(input, extension, outDir, `-${fileSafeName(sheet)}`),
    }));
}
