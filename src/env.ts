export function getOptionalEnv(name: string): string | undefined {
    return process.env[name];
}
