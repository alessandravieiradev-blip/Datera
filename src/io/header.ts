import { TableRow } from "../types";

// junta as colunas de todas as linhas e poe coluna_2, coluna_3... logo depois da coluna base
export function buildHeader(data: TableRow[]): string[] {
    const seen = new Set<string>();
    const orderedKeys: string[] = [];

    for (const row of data) {
        for (const key of Object.keys(row)) {
            if (!seen.has(key)) {
                seen.add(key);
                orderedKeys.push(key);
            }
        }
    }

    const suffixPattern = /^(.+)_(\d+)$/;
    const variantsByBase = new Map<string, number[]>();
    const baseKeys: string[] = [];

    for (const key of orderedKeys) {
        const match = key.match(suffixPattern);
        if (match && seen.has(match[1]!)) {
            const base = match[1]!;
            const n = Number(match[2]!);
            if (!variantsByBase.has(base)) variantsByBase.set(base, []);
            variantsByBase.get(base)!.push(n);
        } else {
            baseKeys.push(key);
        }
    }

    const header: string[] = [];
    for (const base of baseKeys) {
        header.push(base);
        const variants = variantsByBase.get(base);
        if (variants) {
            variants.sort((a, b) => a - b);
            for (const n of variants) header.push(`${base}_${n}`);
        }
    }

    return header;
}
