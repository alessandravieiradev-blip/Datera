// tudo que o resto do projeto precisa da config sai daqui
export { etlConfigSchema } from "./schema";
export type { EtlConfig } from "./schema";
export type { SourceConfig, DestinationConfig } from "./ioSchema";
export { loadConfig, loadJsonConfig } from "./load";
