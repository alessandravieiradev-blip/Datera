import path from "path";
import { KeyNormalizer, registerKeyNormalizer } from "../keyNormalizers";

export function loadNormalizerModules(modulePaths: string[]): void {
    for (const modulePath of modulePaths) {
        let loaded: unknown;

        try {
            loaded = require(path.resolve(modulePath));
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`Não consegui carregar o módulo de normalizadores "${modulePath}": ${reason}`);
        }

        const normalizers = (loaded as { normalizers?: Record<string, KeyNormalizer> } | null)?.normalizers;
        if (!normalizers || typeof normalizers !== "object") {
            throw new Error(
                `O módulo "${modulePath}" precisa exportar um objeto chamado "normalizers". Exemplo: export const normalizers = { meuNormalizador };`
            );
        }

        for (const [name, normalizer] of Object.entries(normalizers)) {
            if (typeof normalizer !== "function") {
                throw new Error(`Em "${modulePath}", "${name}" não é uma função.`);
            }
            registerKeyNormalizer(name, normalizer);
        }
    }
}
