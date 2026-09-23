export interface NormalizedKey {
    key: string | number;
    group?: string;
}

export type KeyNormalizer = (raw: string | number) => NormalizedKey | null;

const registry = new Map<string, KeyNormalizer>();

export function registerKeyNormalizer(name: string, normalizer: KeyNormalizer): void {
    const existing = registry.get(name);
    if (existing && existing !== normalizer) {
        throw new Error(`Já existe um normalizador de chave registrado com o nome "${name}".`);
    }
    registry.set(name, normalizer);
}

export function getKeyNormalizer(name: string): KeyNormalizer {
    const normalizer = registry.get(name);
    if (!normalizer) {
        const available = listKeyNormalizers();
        const hint = available.length > 0 ? available.join(", ") : "nenhum registrado";
        throw new Error(`Normalizador de chave "${name}" não encontrado. Disponíveis: ${hint}`);
    }
    return normalizer;
}

export function listKeyNormalizers(): string[] {
    return Array.from(registry.keys());
}
