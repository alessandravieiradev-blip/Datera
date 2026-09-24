export interface CombineColumnsConfig {
    into: string;
    columns: string[];
    separator?: string | undefined;
    keepSources?: boolean | undefined;
}
