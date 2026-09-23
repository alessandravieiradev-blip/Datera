import { KeyNormalizer } from "./keyNormalizers";

export type MergeColumnStrategy = "concat" | "overwrite" | "extra-column";

export type UnkeyedColumnStrategy = "collapse-column";

export interface UnkeyedColumnConfig {
    strategy: UnkeyedColumnStrategy;
    into?: string | undefined;
    separator?: string | undefined;
}

export interface MergeColumnConfig {
    column: string;
    strategy: MergeColumnStrategy;
    separator?: string | undefined;
    unkeyed?: UnkeyedColumnConfig | undefined;
}

export interface MergeFilterOptions {
    emptyKeyLabel?: string | undefined;
    rejectedKeyLabel?: string | undefined;
    keyNormalizer?: string | KeyNormalizer | undefined;
}
