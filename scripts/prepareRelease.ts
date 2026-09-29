import fs from "fs";
import path from "path";
import { releaseChangelog } from "./changelog";

const PACKAGES = [".", "apps/desktop", "apps/dev"];
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!VERSION.test(version)) {
    console.error(
        `Passe a versão nova no formato 1.2.3, tipo: npm run release:prepare -- 0.2.0`,
    );
    process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
let changelog: string;
try {
    changelog = releaseChangelog(
        fs.readFileSync("CHANGELOG.md", "utf-8"),
        version,
        today,
    );
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}

for (const folder of PACKAGES) {
    const file = path.join(folder, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(file, "utf-8")) as {
        version?: string;
    };
    packageJson.version = version;
    fs.writeFileSync(file, JSON.stringify(packageJson, null, 4) + "\n");
}
fs.writeFileSync("CHANGELOG.md", changelog);

console.log(
    `Versão ${version} preparada no CHANGELOG e nos três package.json.`,
);
console.log("");
console.log("Agora:");
console.log("  npm install");
console.log(
    "  git add CHANGELOG.md package.json package-lock.json apps/desktop/package.json apps/dev/package.json",
);
console.log(`  git commit -m "chore: lança a versão ${version}"`);
console.log("  git push");
console.log(`  git tag v${version}`);
console.log(`  git push origin v${version}`);
console.log("  npm publish");
