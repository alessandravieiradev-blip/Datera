export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  return process.env[name];
};