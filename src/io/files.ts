import fs from "fs";
import path from "path";

export type FileEncoding = "utf-8" | "latin1";

export function slugify(name: string): string {
    return name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function extraOutputPath(
    mainPath: string,
    name: string | undefined,
): string {
    if (name === undefined) return mainPath;
    const ext = path.extname(mainPath);
    const base = mainPath.slice(0, mainPath.length - ext.length);
    return `${base}.${slugify(name) || "extra"}${ext}`;
}

export function readTextFile(
    filePath: string,
    encoding: FileEncoding = "utf-8",
): string {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
    }
    return fs.readFileSync(filePath, encoding === "latin1" ? "latin1" : "utf8");
}

export function writeTextFile(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
}
