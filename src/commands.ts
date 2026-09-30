import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { CliOptions } from "./cli";
import { checkConfigFile, formatCheck, parseConfig } from "./config";
import {
    convert,
    convertMany,
    dedupe,
    findFiles,
    planOutputs,
    describeColumns,
    destinationFromPath,
    detectFormat,
    listNormalizers,
    merge,
    normalize,
    readRows,
    ReadOptions,
    sourceFromPath,
    writeRows,
    WriteOptions,
} from "./api";
import { Logger } from "./logger";
import { assertSourceIsSafe } from "./io/safety";
import { EtlReport, formatReport, parseMode, runEtl } from "./pipeline";

type RunOptions = Extract<CliOptions, { command: "run" }>;
type InitOptions = Extract<CliOptions, { command: "init" }>;

function assertSafeOutput(cli: {
    input: string;
    output: string;
    read: ReadOptions;
    write: WriteOptions;
}): void {
    assertSourceIsSafe({
        mode: "raw",
        source: sourceFromPath(cli.input, cli.read),
        destination: destinationFromPath(cli.output, cli.write),
    });
}

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

function isBatch(cli: RunOptions): boolean {
    if (cli.outDir !== undefined || cli.to !== undefined) return true;
    if (cli.input === undefined) return false;
    return (
        /[*?]/.test(cli.input) ||
        (fs.existsSync(cli.input) && fs.statSync(cli.input).isDirectory())
    );
}

function sameType(
    base: unknown,
    next: { type: string; path?: string },
): Record<string, unknown> {
    if (
        typeof base === "object" &&
        base !== null &&
        (base as { type?: unknown }).type === next.type
    ) {
        return { ...(base as Record<string, unknown>), path: next.path };
    }
    return next as unknown as Record<string, unknown>;
}

function configTarget(raw: Record<string, unknown>): string | undefined {
    const destination = raw.destination as { path?: unknown } | undefined;
    return typeof destination?.path === "string"
        ? path.extname(destination.path)
        : undefined;
}

async function runOnce(
    raw: Record<string, unknown>,
    cli: RunOptions,
    logger: Logger,
): Promise<EtlReport> {
    const config = parseConfig(raw);
    const report = await runEtl(config, {
        mode: cli.mode === undefined ? undefined : parseMode(cli.mode),
        dryRun: cli.dryRun,
        logger,
    });

    if (report.dryRun && report.preview.length > 0) {
        logger.info(`Primeiras ${report.preview.length} linhas do resultado:`);
        console.table(report.preview);
    }
    logger.info("");
    for (const line of formatReport(report)) logger.info(line);
    return report;
}

async function runConfig(cli: RunOptions, logger: Logger): Promise<number> {
    const configPath = path.resolve(cli.config);
    if (!fs.existsSync(configPath)) {
        throw new Error(
            `Não achei a config ${cli.config}. Se era pra ser um comando, veja a lista com "datera --help".`,
        );
    }
    const folder = path.dirname(configPath);
    dotenv.config({ path: path.join(folder, ".env"), quiet: true });
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<
        string,
        unknown
    >;

    if (isBatch(cli)) {
        if (cli.input === undefined) {
            throw new Error(
                'Com --out-dir ou --to, diga os arquivos com --input (tipo --input "matriculas/*.xlsx").',
            );
        }
        if (cli.output !== undefined) {
            throw new Error(
                "Com vários arquivos, use --out-dir em vez de --output, porque cada arquivo ganha o seu resultado.",
            );
        }
        const target = cli.to ?? configTarget(raw);
        if (target === undefined) {
            throw new Error(
                "O destino da config não é um arquivo, então diga o formato de cada resultado com --to (tipo --to xlsx).",
            );
        }
        const plan = planOutputs(
            findFiles(path.resolve(cli.input)),
            target,
            cli.outDir === undefined ? undefined : path.resolve(cli.outDir),
        );
        process.chdir(folder);
        let rows = 0;
        for (const [index, item] of plan.entries()) {
            logger.info("");
            logger.info(
                `Arquivo ${index + 1} de ${plan.length}: ${item.input}`,
            );
            const report = await runOnce(
                {
                    ...raw,
                    source: sameType(
                        raw.source,
                        sourceFromPath(
                            item.input,
                            (raw.source ?? {}) as ReadOptions,
                        ),
                    ),
                    destination: sameType(
                        raw.destination,
                        destinationFromPath(
                            item.output,
                            (raw.destination ?? {}) as WriteOptions,
                        ),
                    ),
                },
                cli,
                logger,
            );
            rows += report.rowsOut;
        }
        logger.info("");
        logger.info(
            `${plural(plan.length, "arquivo processado", "arquivos processados")}, ${plural(rows, "linha no resultado", "linhas no resultado")} ao todo.`,
        );
        logger.info(
            cli.dryRun ? "Teste concluído." : "ETL concluído com sucesso!",
        );
        return 0;
    }

    const input = cli.input === undefined ? undefined : path.resolve(cli.input);
    const output =
        cli.output === undefined ? undefined : path.resolve(cli.output);
    if (input) raw.source = sourceFromPath(input);
    if (output) raw.destination = destinationFromPath(output);
    process.chdir(folder);

    const report = await runOnce(raw, cli, logger);
    logger.info(
        report.written ? "ETL concluído com sucesso!" : "Teste concluído.",
    );
    return 0;
}

function relativeTo(folder: string, file: string): string {
    const relative = path.relative(folder, path.resolve(file));
    if (path.isAbsolute(relative)) return relative;
    const posix = relative.split(path.sep).join("/");
    return posix.startsWith("..") ? posix : `./${posix}`;
}

function starterConfig(from: string | undefined): Record<string, unknown> {
    if (from === undefined) {
        return {
            source: { type: "csv", path: "./dados.csv" },
            destination: {
                type: "csv",
                path: "./saida/resultado.csv",
                delimiter: ";",
            },
            mode: "raw",
        };
    }
    const format = detectFormat(from);
    const extension = format === "sqlite" ? ".csv" : path.extname(from);
    return {
        source: sourceFromPath(from, { table: "NOME_DA_TABELA" }),
        destination: destinationFromPath(`./saida/resultado${extension}`),
        mode: "raw",
    };
}

function init(cli: InitOptions, logger: Logger): number {
    const target = path.resolve(cli.folder, "config.json");
    if (fs.existsSync(target) && !cli.force) {
        logger.error(
            `Já existe uma config em ${target}. Use --force se quiser trocar.`,
        );
        return 1;
    }
    const from =
        cli.from === undefined
            ? undefined
            : relativeTo(path.dirname(target), cli.from);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
        target,
        JSON.stringify(starterConfig(from), null, 4) + "\n",
    );
    logger.info(`Config criada em ${target}.`);
    logger.info(
        'Confira com "datera validate", teste com "datera run --dry-run" e depois rode "datera run".',
    );
    return 0;
}

export async function runCommand(
    cli: CliOptions,
    logger: Logger,
): Promise<number> {
    switch (cli.command) {
        case "run":
            return runConfig(cli, logger);

        case "validate": {
            const check = checkConfigFile(cli.config);
            for (const line of formatCheck(cli.config, check)) {
                if (check.ok) logger.info(line);
                else logger.error(line);
            }
            return check.ok ? 0 : 1;
        }

        case "init":
            return init(cli, logger);

        case "convert": {
            const count = await convert(cli.input, cli.output, {
                read: cli.read,
                write: cli.write,
            });
            logger.info(
                `${plural(count, "linha convertida", "linhas convertidas")} de ${cli.input} pra ${cli.output}.`,
            );
            return 0;
        }

        case "convert-many": {
            const results = await convertMany(cli.inputs, {
                to: cli.to,
                outDir: cli.outDir,
                read: cli.read,
                write: cli.write,
            });
            for (const item of results) {
                const from =
                    item.sheet === undefined
                        ? item.input
                        : `${item.input} (aba ${item.sheet})`;
                logger.info(
                    `${from} → ${item.output} (${plural(item.rows, "linha", "linhas")})`,
                );
            }
            logger.info(
                `${plural(results.length, "arquivo convertido", "arquivos convertidos")}.`,
            );
            return 0;
        }

        case "dedupe": {
            assertSafeOutput(cli);
            const rows = await readRows(cli.input, cli.read);
            const result = dedupe(rows, cli.by, {
                keep: cli.keep,
                normalizer: cli.normalizer,
            });
            await writeRows(result, cli.output, cli.write);
            logger.info(
                `${plural(rows.length, "linha lida", "linhas lidas")}, ${plural(rows.length - result.length, "repetida tirada", "repetidas tiradas")}, ${plural(result.length, "linha gravada", "linhas gravadas")} em ${cli.output}.`,
            );
            return 0;
        }

        case "merge": {
            assertSafeOutput(cli);
            const rows = await readRows(cli.input, cli.read);
            const result = merge(rows, cli.key, {
                normalizer: cli.normalizer,
                separator: cli.separator,
                overwrite: cli.overwrite,
                extraColumn: cli.extraColumn,
            });
            await writeRows(result, cli.output, cli.write);
            logger.info(
                `${plural(rows.length, "linha lida", "linhas lidas")}, juntadas em ${plural(result.length, "registro", "registros")} gravados em ${cli.output}.`,
            );
            return 0;
        }

        case "columns": {
            const rows = await readRows(cli.input, cli.read);
            logger.info(
                `${cli.input}: ${plural(rows.length, "linha", "linhas")}.`,
            );
            console.table(
                describeColumns(rows).map((column) => ({
                    coluna: column.name,
                    preenchidas: column.filled,
                    vazias: column.empty,
                    diferentes: column.distinct,
                    tipo: column.kind,
                    exemplos: column.examples.join(" · "),
                })),
            );
            return 0;
        }

        case "preview": {
            const rows = await readRows(cli.input, cli.read);
            logger.info(
                `${cli.input}: ${plural(rows.length, "linha", "linhas")}. Mostrando ${Math.min(cli.rows, rows.length)}.`,
            );
            console.table(rows.slice(0, cli.rows));
            return 0;
        }

        case "normalizers":
            for (const name of listNormalizers()) logger.info(name);
            return 0;

        case "normalize": {
            const key = normalize(cli.name, cli.value);
            logger.info(
                key === null
                    ? `"${cli.value}" não vira chave nenhuma com ${cli.name} (a linha seria tratada como sem chave).`
                    : `"${cli.value}" → "${key}"`,
            );
            return 0;
        }
    }
}
