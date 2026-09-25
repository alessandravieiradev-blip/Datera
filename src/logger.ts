export interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string, error?: unknown): void;
}

function withReason(message: string, error: unknown): string {
    if (error === undefined) return message;
    const reason = error instanceof Error ? error.message : String(error);
    return `${message} ${reason}`;
}

export const consoleLogger: Logger = {
    info: (message) => console.log(message),
    warn: (message) => console.warn(message),
    error: (message, error) => console.error(withReason(message, error)),
};

export const silentLogger: Logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
};

export interface MemoryLogger extends Logger {
    messages: string[];
}

export function createMemoryLogger(): MemoryLogger {
    const messages: string[] = [];
    return {
        messages,
        info: (message) => messages.push(message),
        warn: (message) => messages.push(message),
        error: (message, error) => messages.push(withReason(message, error)),
    };
}
