import fs from "fs";
import path from "path";
import { TextResult, WriteResult } from "../shared/api";
import { problemsOf } from "./configFile";

const MODULE_EXTENSIONS = [".cjs", ".js", ".mjs", ".ts"];

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function readConfigText(configPath: string | null): TextResult {
    if (configPath === null)
        return {
            ok: false,
            error: "Escolha o arquivo de configuração primeiro.",
        };
    try {
        return {
            ok: true,
            path: configPath,
            text: fs.readFileSync(configPath, "utf-8"),
        };
    } catch (error) {
        return {
            ok: false,
            error: `Não consegui ler a configuração: ${messageOf(error)}`,
        };
    }
}

export function saveConfigText(
    configPath: string | null,
    text: string,
): WriteResult {
    if (configPath === null)
        return {
            ok: false,
            error: "Escolha o arquivo de configuração primeiro.",
        };
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        return { ok: false, error: `O JSON tem um erro: ${messageOf(error)}` };
    }
    if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
    ) {
        return {
            ok: false,
            error: "A configuração precisa ser um objeto JSON.",
        };
    }
    const problems = problemsOf(parsed as Record<string, unknown>);
    if (problems)
        return {
            ok: false,
            error: `A configuração tem problemas: ${problems}`,
        };
    try {
        fs.writeFileSync(configPath, text.endsWith("\n") ? text : `${text}\n`);
        return { ok: true };
    } catch (error) {
        return { ok: false, error: `Não consegui salvar: ${messageOf(error)}` };
    }
}

export function allowedModulePath(
    configPath: string | null,
    filePath: string,
): string | null {
    if (configPath === null) return null;
    const folder = path.dirname(configPath);
    const resolved = path.resolve(folder, filePath);
    const relative = path.relative(folder, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    if (!MODULE_EXTENSIONS.includes(path.extname(resolved))) return null;
    return resolved;
}

export function readModuleFile(
    configPath: string | null,
    filePath: string,
): TextResult {
    const resolved = allowedModulePath(configPath, filePath);
    if (resolved === null)
        return {
            ok: false,
            error: "Só dá para abrir arquivos .cjs, .js ou .ts da pasta da configuração.",
        };
    try {
        return {
            ok: true,
            path: resolved,
            text: fs.readFileSync(resolved, "utf-8"),
        };
    } catch (error) {
        return {
            ok: false,
            error: `Não consegui ler o arquivo: ${messageOf(error)}`,
        };
    }
}

export function saveModuleFile(
    configPath: string | null,
    filePath: string,
    text: string,
): WriteResult {
    const resolved = allowedModulePath(configPath, filePath);
    if (resolved === null)
        return {
            ok: false,
            error: "Só dá para salvar arquivos .cjs, .js ou .ts na pasta da configuração.",
        };
    try {
        fs.writeFileSync(resolved, text);
        return { ok: true };
    } catch (error) {
        return { ok: false, error: `Não consegui salvar: ${messageOf(error)}` };
    }
}
