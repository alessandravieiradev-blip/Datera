import path from "path";
import {
    registerSinkAdapter,
    registerSourceAdapter,
    SinkFactory,
    SourceFactory,
} from "./registry";

interface AdapterModule {
    sources?: Record<string, SourceFactory>;
    sinks?: Record<string, SinkFactory>;
}

function registerAll<T>(
    modulePath: string,
    group: Record<string, T> | undefined,
    register: (name: string, factory: T) => void,
): void {
    for (const [name, factory] of Object.entries(group ?? {})) {
        if (typeof factory !== "function") {
            throw new Error(`Em "${modulePath}", "${name}" não é uma função.`);
        }
        register(name, factory);
    }
}

export function loadAdapterModules(modulePaths: string[]): void {
    for (const modulePath of modulePaths) {
        let loaded: unknown;

        try {
            loaded = require(path.resolve(modulePath));
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error);
            throw new Error(
                `Não consegui carregar o módulo de adapters "${modulePath}": ${reason}`,
            );
        }

        const adapters = (loaded ?? {}) as AdapterModule;
        const hasSources =
            typeof adapters.sources === "object" && adapters.sources !== null;
        const hasSinks =
            typeof adapters.sinks === "object" && adapters.sinks !== null;
        if (!hasSources && !hasSinks) {
            throw new Error(
                `O módulo "${modulePath}" precisa exportar um objeto "sources", um objeto "sinks" ou os dois. Exemplo: export const sources = { minhaFonte };`,
            );
        }

        registerAll(modulePath, adapters.sources, registerSourceAdapter);
        registerAll(modulePath, adapters.sinks, registerSinkAdapter);
    }
}
