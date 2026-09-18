import { Command } from "commander";

const program = new Command();

program
    .option("--config <caminho>", "Caminho para o arquivo de config do JSON.")
    .option("--mode <modo>", "Modo de execução do ETL.", "raw");
program.parse(); 

const VALID_MODES = ["raw", "dedupe"] as const;
type Mode = (typeof VALID_MODES)[number];

function validateMode(value: string): Mode {
    if (!VALID_MODES.includes(value as Mode)) {
        console.error(`Modo inválido: "${value}". Modos aceitos: ${VALID_MODES.join(", ")}`);
        process.exit(1);
    }
    return value as Mode;
}

export const options = program.opts();
export const mode: Mode = validateMode(options.mode);