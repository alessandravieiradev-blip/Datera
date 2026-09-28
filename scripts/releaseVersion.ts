import fs from "fs";
import path from "path";

const APPS = ["apps/desktop", "apps/dev"];
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

function versionOf(app: string): string {
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(app, "package.json"), "utf-8"),
    ) as { version?: string };
    return packageJson.version ?? "";
}

const tag = process.argv[2] ?? "";
const version = tag.replace(/^v/, "");

if (!tag.startsWith("v") || !VERSION.test(version)) {
    console.error(`A tag "${tag}" precisa estar no formato v1.2.3.`);
    process.exit(1);
}

const wrong = APPS.map((app) => ({ app, found: versionOf(app) })).filter(
    ({ found }) => found !== version,
);

for (const { app, found } of wrong) {
    console.error(
        `${app}/package.json está na versão ${found}, mas a tag é ${tag}. Deixe as duas iguais antes de publicar.`,
    );
}

if (wrong.length > 0) process.exit(1);
console.log(`A versão ${version} confere nos dois apps.`);
