export type MergeColumnStrategy = "concat" | "overwrite" | "extra-column";

export interface MergeColumnConfig {
    column: string;
    strategy: MergeColumnStrategy;
    separator?: string;
};