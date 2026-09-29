export const UNRELEASED = "Não lançado";

const HEADING = /^## \[([^\]]+)\]/;

interface Section {
    name: string;
    start: number;
    end: number;
}

function sections(changelog: string): Section[] {
    const lines = changelog.split("\n");
    const found: Section[] = [];
    lines.forEach((line, index) => {
        const match = line.match(HEADING);
        if (!match?.[1]) return;
        const previous = found[found.length - 1];
        if (previous) previous.end = index;
        found.push({ name: match[1], start: index, end: lines.length });
    });
    return found;
}

function bodyOf(changelog: string, section: Section): string {
    return changelog
        .split("\n")
        .slice(section.start + 1, section.end)
        .join("\n")
        .trim();
}

export function sectionFor(changelog: string, version: string): string | null {
    const section = sections(changelog).find((item) => item.name === version);
    return section ? bodyOf(changelog, section) : null;
}

export function hasEntries(body: string | null): boolean {
    return body !== null && /^\s*- \S/m.test(body);
}

export function releaseChangelog(
    changelog: string,
    version: string,
    date: string,
): string {
    if (sectionFor(changelog, version) !== null) {
        throw new Error(`O CHANGELOG já tem a versão ${version}.`);
    }
    const unreleased = sectionFor(changelog, UNRELEASED);
    if (unreleased === null) {
        throw new Error(
            `O CHANGELOG precisa de uma seção "## [${UNRELEASED}]" com o que mudou.`,
        );
    }
    if (!hasEntries(unreleased)) {
        throw new Error(
            `A seção "${UNRELEASED}" do CHANGELOG está vazia. Escreva o que mudou antes de lançar a versão.`,
        );
    }
    return changelog.replace(
        `## [${UNRELEASED}]`,
        `## [${UNRELEASED}]\n\n## [${version}] - ${date}`,
    );
}
