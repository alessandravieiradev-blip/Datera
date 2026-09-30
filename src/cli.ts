import fs from "fs";
import path from "path";
import { Command, InvalidArgumentError, Option } from "commander";
import { ReadOptions, WriteOptions } from "./api/formats";

export type CliOptions =
    | {
          command: "run";
          config: string;
          mode?: string | undefined;
          dryRun: boolean;
          input?: string | undefined;
          outDir?: string | undefined;
          to?: string | undefined;
          output?: string | undefined;
      }
    | { command: "validate"; config: string }
    | {
          command: "init";
          folder: string;
          from?: string | undefined;
          force: boolean;
      }
    | {
          command: "convert";
          input: string;
          output: string;
          read: ReadOptions;
          write: WriteOptions;
      }
    | {
          command: "convert-many";
          inputs: string[];
          to: string;
          outDir?: string | undefined;
          read: ReadOptions;
          write: WriteOptions;
      }
    | {
          command: "dedupe";
          input: string;
          output: string;
          by: string;
          keep: "first" | "last";
          normalizer?: string | undefined;
          read: ReadOptions;
          write: WriteOptions;
      }
    | {
          command: "merge";
          input: string;
          output: string;
          key: string;
          normalizer?: string | undefined;
          separator?: string | undefined;
          overwrite: string[];
          extraColumn: string[];
          read: ReadOptions;
          write: WriteOptions;
      }
    | { command: "columns"; input: string; read: ReadOptions }
    | { command: "preview"; input: string; rows: number; read: ReadOptions }
    | { command: "normalizers" }
    | { command: "normalize"; name: string; value: string };

const DEFAULT_CONFIG = "./config.json";
const DEFAULT_PREVIEW_ROWS = 10;

export function dateraVersion(): string {
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"),
    ) as { version?: string };
    return packageJson.version ?? "0.0.0";
}

interface ReadFlags {
    table?: string;
    sheet?: string;
    recordsPath?: string;
    delimiter?: string;
    encoding?: "utf-8" | "latin1";
}

interface WriteFlags {
    outputTable?: string;
    outputSheet?: string;
    outputDelimiter?: string;
    root?: string;
    record?: string;
}

function withReadFlags(command: Command): Command {
    return command
        .option("--table <tabela>", "Tabela a ler, quando a entrada é SQLite.")
        .option("--sheet <aba>", "Aba a ler, quando a entrada é Excel.")
        .option(
            "--records-path <caminho>",
            "Onde estão os registros no JSON ou XML (ex.: escola.alunos.aluno).",
        )
        .option("--delimiter <separador>", "Separador do CSV de entrada.")
        .addOption(
            new Option(
                "--encoding <codificação>",
                "Codificação do CSV de entrada.",
            ).choices(["utf-8", "latin1"]),
        );
}

function withWriteFlags(command: Command): Command {
    return command
        .option(
            "--output-table <tabela>",
            'Tabela onde gravar, quando a saída é SQLite (padrão: "dados").',
        )
        .option("--output-sheet <aba>", "Nome da aba, quando a saída é Excel.")
        .option("--output-delimiter <separador>", "Separador do CSV de saída.")
        .option("--root <nome>", "Elemento de fora, quando a saída é XML.")
        .option(
            "--record <nome>",
            "Elemento de cada linha, quando a saída é XML.",
        );
}

function readOptions(flags: ReadFlags): ReadOptions {
    return {
        table: flags.table,
        sheet: flags.sheet,
        recordsPath: flags.recordsPath,
        delimiter: flags.delimiter,
        encoding: flags.encoding,
    };
}

function writeOptions(flags: WriteFlags): WriteOptions {
    return {
        table: flags.outputTable,
        sheet: flags.outputSheet,
        delimiter: flags.outputDelimiter,
        root: flags.root,
        record: flags.record,
    };
}

function list(value: string, previous: string[] = []): string[] {
    return [
        ...previous,
        ...value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
    ];
}

function positiveNumber(value: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new InvalidArgumentError(
            "precisa ser um número inteiro maior que zero.",
        );
    }
    return parsed;
}

const TITLES: Record<string, string> = {
    "Usage:": "Uso:",
    "Options:": "Opções:",
    "Commands:": "Comandos:",
    "Arguments:": "Argumentos:",
};

const ERRORS: [RegExp, string][] = [
    [/^error: /, "erro: "],
    [/missing required argument/, "faltou o argumento"],
    [/required option (.+) not specified/, "faltou a opção $1"],
    [/unknown command/, "comando desconhecido"],
    [/unknown option/, "opção desconhecida"],
    [/too many arguments/, "argumentos demais"],
    [/Did you mean (.+)\?/, "Você quis dizer $1?"],
    [/Allowed choices are/, "As opções aceitas são"],
    [
        /option '(.+)' argument '(.+)' is invalid\./,
        "o valor '$2' da opção '$1' não vale:",
    ],
    [/is invalid\./, "não vale."],
];

function translateError(text: string): string {
    return ERRORS.reduce(
        (current, [pattern, replacement]) =>
            current.replace(pattern, replacement),
        text,
    );
}

export function convertRequest(
    files: string[],
    flags: ReadFlags & WriteFlags & { to?: string; outDir?: string },
): CliOptions {
    const read = readOptions(flags);
    const write = writeOptions(flags);
    if (flags.to !== undefined) {
        return {
            command: "convert-many",
            inputs: files,
            to: flags.to,
            outDir: flags.outDir,
            read,
            write,
        };
    }
    if (flags.outDir !== undefined) {
        throw new Error(
            "Com --out-dir, diga também o formato da saída com --to (tipo --to csv).",
        );
    }
    if (files.length === 1) {
        throw new Error(
            'Faltou dizer a saída. Use "datera convert entrada.csv saida.xlsx" ou "datera convert entrada.csv --to xlsx".',
        );
    }
    if (files.length > 2) {
        throw new Error(
            "Pra converter vários arquivos, use --to com o formato (e --out-dir se quiser outra pasta).",
        );
    }
    return {
        command: "convert",
        input: files[0]!,
        output: files[1]!,
        read,
        write,
    };
}

export function buildProgram(
    onCommand: (options: CliOptions) => void,
): Command {
    const program = new Command();

    program
        .configureHelp({ styleTitle: (title) => TITLES[title] ?? title })
        .configureOutput({
            outputError: (text, write) => write(translateError(text)),
        })
        .name("datera")
        .description(
            "Limpa, junta, converte e organiza dados bagunçados de banco, planilha ou arquivo.",
        )
        .version(dateraVersion(), "-v, --version", "Mostra a versão.")
        .helpOption("-h, --help", "Mostra essa ajuda.")
        .helpCommand("help [comando]", "Mostra a ajuda de um comando.")
        .showSuggestionAfterError();

    program
        .command("run", { isDefault: true })
        .description("Roda uma config inteira: lê, aplica as regras e grava.")
        .argument("[config]", "Caminho da config.")
        .option("--config <caminho>", "Caminho da config (jeito antigo).")
        .option(
            "--mode <modo>",
            "Troca o modo da config (raw, dedupe ou merge).",
        )
        .option("--dry-run", "Roda tudo e mostra o resultado, sem gravar nada.")
        .option(
            "--input <arquivo>",
            "Lê desse arquivo em vez da fonte da config.",
        )
        .option(
            "--output <arquivo>",
            "Grava nesse arquivo em vez do destino da config.",
        )
        .option(
            "--out-dir <pasta>",
            'Com vários arquivos no --input (tipo "matriculas/*.xlsx"), grava um resultado pra cada um nessa pasta.',
        )
        .option(
            "--to <formato>",
            "Formato de cada resultado quando são vários arquivos (csv, xlsx, json, xml, parquet ou db).",
        )
        .action(
            (
                config: string | undefined,
                flags: {
                    config?: string;
                    mode?: string;
                    dryRun?: boolean;
                    input?: string;
                    output?: string;
                    outDir?: string;
                    to?: string;
                },
            ) =>
                onCommand({
                    command: "run",
                    config: config ?? flags.config ?? DEFAULT_CONFIG,
                    mode: flags.mode,
                    dryRun: flags.dryRun ?? false,
                    input: flags.input,
                    output: flags.output,
                    outDir: flags.outDir,
                    to: flags.to,
                }),
        );

    program
        .command("validate")
        .description(
            "Confere a config e os arquivos que ela cita, sem ler dados.",
        )
        .argument("[config]", "Caminho da config.")
        .action((config: string | undefined) =>
            onCommand({
                command: "validate",
                config: config ?? DEFAULT_CONFIG,
            }),
        );

    program
        .command("init")
        .description("Cria uma config.json pra começar.")
        .argument("[pasta]", "Pasta onde criar a config.", ".")
        .option("--from <arquivo>", "Já monta a config lendo desse arquivo.")
        .option("--force", "Troca a config.json se ela já existir.")
        .action((folder: string, flags: { from?: string; force?: boolean }) =>
            onCommand({
                command: "init",
                folder,
                from: flags.from,
                force: flags.force ?? false,
            }),
        );

    withWriteFlags(
        withReadFlags(
            program
                .command("convert")
                .description(
                    'Converte de um formato pra outro, sem mexer nos dados. Com --to, converte vários de uma vez (tipo "matriculas/*.xlsx").',
                )
                .argument(
                    "<arquivos...>",
                    "A entrada e a saída, ou só as entradas quando usar --to. Aceita pasta e * no nome do arquivo.",
                )
                .option(
                    "--to <formato>",
                    "Formato da saída de cada arquivo (csv, xlsx, json, xml, parquet ou db).",
                )
                .option(
                    "--out-dir <pasta>",
                    "Pasta onde gravar os convertidos. Sem ela, ficam do lado de cada entrada.",
                ),
        ),
    ).action(
        (
            files: string[],
            flags: ReadFlags & WriteFlags & { to?: string; outDir?: string },
            command: Command,
        ) => {
            try {
                onCommand(convertRequest(files, flags));
            } catch (error) {
                command.error(
                    `erro: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        },
    );

    withWriteFlags(
        withReadFlags(
            program
                .command("dedupe")
                .description("Tira as linhas repetidas olhando uma coluna.")
                .argument("<entrada>", "Arquivo de entrada.")
                .argument("<saida>", "Arquivo de saída.")
                .requiredOption(
                    "--by <coluna>",
                    "Coluna que diz se a linha é repetida.",
                )
                .addOption(
                    new Option("--keep <qual>", "Qual linha manter.")
                        .choices(["first", "last"])
                        .default("first"),
                )
                .option(
                    "--normalizer <nome>",
                    "Normalizador aplicado antes de comparar (ex.: lowercase).",
                ),
        ),
    ).action(
        (
            input: string,
            output: string,
            flags: ReadFlags &
                WriteFlags & {
                    by: string;
                    keep: "first" | "last";
                    normalizer?: string;
                },
        ) =>
            onCommand({
                command: "dedupe",
                input,
                output,
                by: flags.by,
                keep: flags.keep,
                normalizer: flags.normalizer,
                read: readOptions(flags),
                write: writeOptions(flags),
            }),
    );

    withWriteFlags(
        withReadFlags(
            program
                .command("merge")
                .description(
                    "Junta as linhas com a mesma chave sem perder informação.",
                )
                .argument("<entrada>", "Arquivo de entrada.")
                .argument("<saida>", "Arquivo de saída.")
                .requiredOption(
                    "--key <coluna>",
                    "Coluna que identifica cada registro.",
                )
                .option(
                    "--normalizer <nome>",
                    "Normalizador da chave (ex.: digitsOnly).",
                )
                .option(
                    "--separator <texto>",
                    'Separador quando junta valores diferentes (padrão " | ").',
                )
                .option(
                    "--overwrite <colunas>",
                    "Colunas em que vale o último valor, separadas por vírgula.",
                    list,
                )
                .option(
                    "--extra-column <colunas>",
                    "Colunas em que cada valor diferente vira uma coluna nova.",
                    list,
                ),
        ),
    ).action(
        (
            input: string,
            output: string,
            flags: ReadFlags &
                WriteFlags & {
                    key: string;
                    normalizer?: string;
                    separator?: string;
                    overwrite?: string[];
                    extraColumn?: string[];
                },
        ) =>
            onCommand({
                command: "merge",
                input,
                output,
                key: flags.key,
                normalizer: flags.normalizer,
                separator: flags.separator,
                overwrite: flags.overwrite ?? [],
                extraColumn: flags.extraColumn ?? [],
                read: readOptions(flags),
                write: writeOptions(flags),
            }),
    );

    withReadFlags(
        program
            .command("columns")
            .description(
                "Mostra as colunas com quantas estão preenchidas, vazias e diferentes.",
            )
            .argument("<entrada>", "Arquivo de entrada."),
    ).action((input: string, flags: ReadFlags) =>
        onCommand({ command: "columns", input, read: readOptions(flags) }),
    );

    withReadFlags(
        program
            .command("preview")
            .description("Mostra as primeiras linhas de um arquivo.")
            .argument("<entrada>", "Arquivo de entrada.")
            .option(
                "-n, --rows <quantidade>",
                "Quantas linhas mostrar.",
                positiveNumber,
                DEFAULT_PREVIEW_ROWS,
            ),
    ).action((input: string, flags: ReadFlags & { rows: number }) =>
        onCommand({
            command: "preview",
            input,
            rows: flags.rows,
            read: readOptions(flags),
        }),
    );

    program
        .command("normalizers")
        .description("Lista os normalizadores prontos.")
        .action(() => onCommand({ command: "normalizers" }));

    program
        .command("normalize")
        .description("Mostra como um normalizador transforma um valor.")
        .argument("<nome>", "Nome do normalizador.")
        .argument("<valor>", "Valor pra testar.")
        .action((name: string, value: string) =>
            onCommand({ command: "normalize", name, value }),
        );

    return program;
}

export function parseCli(argv: string[] = process.argv): CliOptions {
    let result: CliOptions | undefined;
    buildProgram((options) => {
        result = options;
    }).parse(argv);
    if (!result) throw new Error("Comando não reconhecido.");
    return result;
}
