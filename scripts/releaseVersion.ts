import fs from "fs";
import path from "path";

const PACKAGES = [".", "apps/desktop", "apps/dev"];
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

function versionOf(folder: string): string {
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(folder, "package.json"), "utf-8"),
    ) as { version?: string };
    return packageJson.version ?? "";
}

const tag = process.argv[2] ?? "";
const version = tag.replace(/^v/, "");

if (!tag.startsWith("v") || !VERSION.test(version)) {
    console.error(`A tag "${tag}" precisa estar no formato v1.2.3.`);
    process.exit(1);
}

const wrong = PACKAGES.map((folder) => ({
    file: path.join(folder, "package.json"),
    found: versionOf(folder),
})).filter(({ found }) => found !== version);

for (const { file, found } of wrong) {
    console.error(
        `${file} está na versão ${found}, mas a tag é ${tag}. Deixe todos iguais antes de publicar.`,
    );
}

if (wrong.length > 0) process.exit(1);
console.log(`A versão ${version} confere no terminal e nos dois apps.`);
