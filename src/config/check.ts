import fs from "fs";
import path from "path";
import { translateIssue } from "./messages";
import { EtlConfig, etlConfigSchema } from "./schema";
import { tableProblem } from "../io/safety";

export interface ConfigProblem {
    where: string;
    message: string;
}

export interface ConfigCheck {
    ok: boolean;
    problems: ConfigProblem[];
}

function pathText(parts: readonly PropertyKey[]): string {
    return parts
        .filter(
            (part): part is string | number =>
                typeof part === "string" || typeof part === "number",
        )
        .map((part, index) =>
            typeof part === "number"
                ? `[${part}]`
                : index === 0
                  ? part
                  : `.${part}`,
        )
        .join("");
}

function filePathOf(side: unknown): string | undefined {
    return typeof side === "object" &&
        side !== null &&
        "path" in side &&
        typeof side.path === "string"
        ? side.path
        : undefined;
}

function missingFiles(config: EtlConfig, folder: string): ConfigProblem[] {
    const files: { where: string; file: string }[] = [];
    const sourcePath = filePathOf(config.source);
    if (sourcePath) files.push({ where: "source.path", file: sourcePath });
    const credentials =
        (config.source?.type === "sheets"
            ? config.source.credentialsPath
            : undefined) ??
        (config.destination?.type === "sheets"
            ? config.destination.credentialsPath
            : undefined) ??
        config.credentialsPath;
    if (credentials)
        files.push({ where: "credentialsPath", file: credentials });
    (config.normalizerModules ?? []).forEach((file, index) =>
        files.push({ where: `normalizerModules[${index}]`, file }),
    );
    (config.adapterModules ?? []).forEach((file, index) =>
        files.push({ where: `adapterModules[${index}]`, file }),
    );
    return files
        .filter(({ file }) => !fs.existsSync(path.resolve(folder, file)))
        .map(({ where, file }) => ({
            where,
            message: `Arquivo não encontrado: ${file}`,
        }));
}

export function checkConfigText(text: string, folder: string): ConfigCheck {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
            ok: false,
            problems: [{ where: "", message: `JSON inválido: ${reason}` }],
        };
    }
    const result = etlConfigSchema.safeParse(value);
    if (!result.success) {
        return {
            ok: false,
            problems: result.error.issues.map((issue) => ({
                where: pathText(issue.path),
                message: translateIssue(issue),
            })),
        };
    }
    const problems = missingFiles(result.data, folder);
    const tables = tableProblem(result.data);
    if (tables !== null)
        problems.push({ where: "destination.table", message: tables });
    return { ok: problems.length === 0, problems };
}

export function checkConfigFile(configPath: string): ConfigCheck {
    const resolved = path.resolve(configPath);
    if (!fs.existsSync(resolved)) {
        return {
            ok: false,
            problems: [
                { where: "", message: `Arquivo não encontrado: ${configPath}` },
            ],
        };
    }
    return checkConfigText(
        fs.readFileSync(resolved, "utf-8"),
        path.dirname(resolved),
    );
}

export function formatCheck(configPath: string, check: ConfigCheck): string[] {
    if (check.ok) return [`${configPath}: configuração válida.`];
    const count = check.problems.length;
    return [
        `${configPath}: ${count} ${count === 1 ? "problema" : "problemas"}.`,
        ...check.problems.map(({ where, message }) =>
            where ? `  ${where}: ${message}` : `  ${message}`,
        ),
    ];
}
