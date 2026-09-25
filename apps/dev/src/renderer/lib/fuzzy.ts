function normalize(text: string): string {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matches(query: string, text: string): boolean {
    const target = normalize(text);
    let position = 0;
    for (const char of normalize(query).replace(/\s+/g, "")) {
        position = target.indexOf(char, position);
        if (position === -1) return false;
        position += 1;
    }
    return true;
}

export function score(query: string, text: string): number {
    const target = normalize(text);
    const wanted = normalize(query).trim();
    if (wanted === "") return 0;
    if (target.startsWith(wanted)) return 0;
    if (target.includes(wanted)) return 1;
    return 2;
}
