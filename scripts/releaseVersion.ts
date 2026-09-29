import fs from "fs";
import path from "path";
import { hasEntries, sectionFor } from "./changelog";

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

const changes = sectionFor(fs.readFileSync("CHANGELOG.md", "utf-8"), version);
if (!hasEntries(changes)) {
    console.error(
        `O CHANGELOG.md não tem o que mudou na versão ${version}. Rode "npm run release:prepare -- ${version}" antes de criar a tag.`,
    );
}

if (wrong.length > 0 || !hasEntries(changes)) process.exit(1);
console.log(
    `A versão ${version} confere no terminal, nos dois apps e no CHANGELOG.`,
);
