import crypto from "crypto";
import fs from "fs";
import path from "path";
import { BrowserWindow, dialog, MessageBoxOptions } from "electron";
import { isInsideFolder } from "./safe";
import { readJson, writeJson } from "./storage";

const FILE = "confianca.json";

type Trusted = Record<string, string>;

function readTrusted(): Trusted {
    const saved = readJson<unknown>(FILE, {});
    if (typeof saved !== "object" || saved === null || Array.isArray(saved))
        return {};
    const result: Trusted = {};
    for (const [key, value] of Object.entries(saved)) {
        if (typeof value === "string") result[key] = value;
    }
    return result;
}

function keyOf(filePath: string): string {
    const resolved = path.resolve(filePath);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function fingerprint(filePath: string): string | null {
    try {
        return crypto
            .createHash("sha256")
            .update(fs.readFileSync(filePath))
            .digest("hex");
    } catch {
        return null;
    }
}

export function trustFile(filePath: string): void {
    const hash = fingerprint(filePath);
    if (hash === null) return;
    writeJson(FILE, { ...readTrusted(), [keyOf(filePath)]: hash });
}

export function codeFilesOf(config: {
    normalizerModules?: unknown;
    adapterModules?: unknown;
}): string[] {
    const files: string[] = [];
    for (const list of [config.normalizerModules, config.adapterModules]) {
        if (!Array.isArray(list)) continue;
        for (const item of list) if (typeof item === "string") files.push(item);
    }
    return files;
}

async function askUser(folder: string, files: string[]): Promise<boolean> {
    const list = files
        .map((file) => `- ${path.relative(folder, file)}`)
        .join("\n");
    const options: MessageBoxOptions = {
        type: "warning",
        title: "Arquivos de código",
        message: "Esta configuração vai executar arquivos de código.",
        detail: `${list}\n\nEsses arquivos rodam no seu computador com as mesmas permissões que você. Só continue se eles foram criados por você ou por alguém de confiança. Se mudarem depois, o Datera pergunta de novo.`,
        buttons: ["Confiar e continuar", "Cancelar"],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
    };
    const window = BrowserWindow.getFocusedWindow();
    const { response } = window
        ? await dialog.showMessageBox(window, options)
        : await dialog.showMessageBox(options);
    return response === 0;
}

export async function confirmCodeFiles(
    configPath: string,
    modulePaths: string[],
): Promise<void> {
    const folder = path.dirname(configPath);
    const outside = modulePaths.filter((item) => !isInsideFolder(folder, item));
    if (outside.length > 0) {
        throw new Error(
            `Por segurança, os arquivos de código precisam ficar na pasta da configuração ou numa subpasta dela. Fora da pasta: ${outside.join(", ")}`,
        );
    }
    const trusted = readTrusted();
    const pending = [
        ...new Set(modulePaths.map((item) => path.resolve(folder, item))),
    ].filter((file) => {
        const hash = fingerprint(file);
        return hash !== null && trusted[keyOf(file)] !== hash;
    });
    if (pending.length === 0) return;
    if (!(await askUser(folder, pending))) {
        throw new Error(
            "Os arquivos de código não foram aprovados, então nada foi executado.",
        );
    }
    for (const file of pending) trustFile(file);
}
