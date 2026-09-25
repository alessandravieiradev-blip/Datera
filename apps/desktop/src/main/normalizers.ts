import fs from "fs";
import path from "path";
import { listKeyNormalizers } from "../../../../src/normalizers/registry";
import { registerBuiltinKeyNormalizers } from "../../../../src/normalizers";
import {
    NormalizerTestResult,
    NormalizersResult,
    RawConfig,
    TemplateResult,
} from "../shared/api";
import { readConfigFile, writeConfigFile } from "./configFile";
import { enableTypeScriptModules, forgetModule } from "./etl";

const TEMPLATE_NAME = "normalizadores.cjs";

const TEMPLATE = `const matriculaComOitoDigitos = (valor) => {
    const digitos = String(valor).replace(/\\D/g, "");
    if (digitos.length !== 8) return null;
    return { key: digitos };
};

const semAcento = (valor) => {
    const texto = String(valor)
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "")
        .trim()
        .toLowerCase();
    if (texto === "") return null;
    return { key: texto };
};

module.exports = {
    normalizers: {
        matriculaComOitoDigitos,
        semAcento,
    },
};
`;

function modulesOf(config: RawConfig): string[] {
    const modules = config.normalizerModules;
    return Array.isArray(modules)
        ? modules.filter((item): item is string => typeof item === "string")
        : [];
}

function normalizersIn(filePath: string): Record<string, unknown> {
    forgetModule(filePath);
    const loaded = require(filePath) as { normalizers?: unknown } | null;
    const normalizers = loaded?.normalizers;
    if (typeof normalizers !== "object" || normalizers === null) {
        throw new Error(
            `O arquivo ${path.basename(filePath)} precisa exportar um objeto "normalizers".`,
        );
    }
    return normalizers as Record<string, unknown>;
}

function namesIn(filePath: string): string[] {
    return Object.keys(normalizersIn(filePath));
}

function describeResult(result: unknown): { text: string; valid: boolean } {
    if (result === null)
        return { text: "null (vai para Pendências)", valid: false };
    if (typeof result === "object" && result !== null && "key" in result) {
        const { key, group } = result as { key: unknown; group?: unknown };
        const groupText = group === undefined ? "" : `, grupo ${String(group)}`;
        return {
            text: `chave ${JSON.stringify(key)}${groupText}`,
            valid: true,
        };
    }
    return {
        text: `resposta inesperada: ${JSON.stringify(result)}`,
        valid: false,
    };
}

export function testNormalizer(
    filePath: string,
    name: string,
    values: string[],
): NormalizerTestResult {
    enableTypeScriptModules();
    try {
        const normalizer = normalizersIn(filePath)[name];
        if (typeof normalizer !== "function") {
            return {
                ok: false,
                error: `"${name}" não é uma função exportada em normalizers.`,
            };
        }
        const results = values.map((value) => {
            try {
                const { text, valid } = describeResult(normalizer(value));
                return { value, result: text, valid };
            } catch (error) {
                const reason =
                    error instanceof Error ? error.message : String(error);
                return { value, result: `erro: ${reason}`, valid: false };
            }
        });
        return { ok: true, results };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
            ok: false,
            error: `Não consegui carregar o arquivo: ${reason}`,
        };
    }
}

export function listNormalizers(configPath: string | null): NormalizersResult {
    registerBuiltinKeyNormalizers();
    const builtin = listKeyNormalizers();
    if (configPath === null)
        return { ok: true, builtin, custom: [], files: [] };

    const read = readConfigFile(configPath);
    if (!read.ok) return read;

    enableTypeScriptModules();
    const folder = path.dirname(configPath);
    const files = modulesOf(read.config).map((item) =>
        path.resolve(folder, item),
    );
    const custom: string[] = [];
    try {
        for (const file of files) custom.push(...namesIn(file));
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
            ok: false,
            error: `Não consegui ler os normalizadores: ${reason}`,
        };
    }
    return { ok: true, builtin, custom, files };
}

export function createNormalizerTemplate(
    configPath: string | null,
): TemplateResult {
    if (configPath === null) {
        return { ok: false, error: "Escolha a configuração primeiro." };
    }
    const read = readConfigFile(configPath);
    if (!read.ok) return read;

    const folder = path.dirname(configPath);
    const filePath = path.join(folder, TEMPLATE_NAME);
    const relative = `./${TEMPLATE_NAME}`;

    try {
        if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, TEMPLATE);
        const modules = modulesOf(read.config);
        const alreadyListed = modules.some(
            (item) => path.resolve(folder, item) === filePath,
        );
        if (!alreadyListed) {
            writeConfigFile(configPath, {
                ...read.config,
                normalizerModules: [...modules, relative],
            });
        }
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `Não consegui criar o arquivo: ${reason}` };
    }
    return { ok: true, path: filePath };
}
