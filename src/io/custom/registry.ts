import { Sink, Source } from "../types";
import { consoleLogger, Logger } from "../../logger";

export type AdapterOptions = Record<string, unknown>;

export interface AdapterContext {
    logger: Logger;
}

export type SourceFactory = (
    options: AdapterOptions,
    context: AdapterContext,
) => Source;
export type SinkFactory = (
    options: AdapterOptions,
    context: AdapterContext,
) => Sink;

const sources = new Map<string, SourceFactory>();
const sinks = new Map<string, SinkFactory>();

function register<T>(
    registry: Map<string, T>,
    kind: string,
    name: string,
    factory: T,
): void {
    const existing = registry.get(name);
    if (existing && existing !== factory) {
        throw new Error(`Já existe ${kind} registrado com o nome "${name}".`);
    }
    registry.set(name, factory);
}

function find<T>(registry: Map<string, T>, kind: string, name: string): T {
    const factory = registry.get(name);
    if (!factory) {
        const available = Array.from(registry.keys());
        const hint =
            available.length > 0 ? available.join(", ") : "nenhum registrado";
        throw new Error(
            `${kind} "${name}" não encontrado. Disponíveis: ${hint}`,
        );
    }
    return factory;
}

export function registerSourceAdapter(
    name: string,
    factory: SourceFactory,
): void {
    register(sources, "uma fonte", name, factory);
}

export function registerSinkAdapter(name: string, factory: SinkFactory): void {
    register(sinks, "um destino", name, factory);
}

export function createCustomSource(
    name: string,
    options: AdapterOptions,
    logger: Logger = consoleLogger,
): Source {
    const source = find(sources, "Fonte", name)(options, { logger });
    if (typeof source?.read !== "function") {
        throw new Error(
            `A fonte "${name}" precisa devolver um objeto com o método read().`,
        );
    }
    return source;
}

export function createCustomSink(
    name: string,
    options: AdapterOptions,
    logger: Logger = consoleLogger,
): Sink {
    const sink = find(sinks, "Destino", name)(options, { logger });
    if (typeof sink?.write !== "function") {
        throw new Error(
            `O destino "${name}" precisa devolver um objeto com o método write().`,
        );
    }
    return sink;
}
