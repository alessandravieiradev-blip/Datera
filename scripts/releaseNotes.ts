import fs from "fs";
import { sectionFor } from "./changelog";

const version = (process.argv[2] ?? "").replace(/^v/, "");
const intro = fs.readFileSync(".github/release-notes.md", "utf-8").trim();
const changes = sectionFor(fs.readFileSync("CHANGELOG.md", "utf-8"), version);

process.stdout.write(
    `${intro}\n\n${changes ?? "Veja o CHANGELOG.md pra lista de mudanças."}\n`,
);
