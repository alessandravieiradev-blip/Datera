import { KeyNormalizer } from "../normalizers/registry";

export type MergeColumnStrategy = "concat" | "overwrite" | "extra-column";

export type UnkeyedColumnStrategy = "collapse-column";

export interface UnkeyedColumnConfig {
    strategy: UnkeyedColumnStrategy;
    into?: string | undefined;
    separator?: string | undefined;
}

export interface DistributeConfig {
    columns: string[];
    overflowInto?: string | undefined;
    sources?: string[] | undefined;
}

export interface GroupColumnOverride {
    strategy: MergeColumnStrategy;
    separator?: string | undefined;
    into?: string | undefined;
    distribute?: DistributeConfig | undefined;
}

export interface MergeColumnConfig {
    column: string;
    strategy: MergeColumnStrategy;
    separator?: string | undefined;
    distribute?: DistributeConfig | undefined;
    unkeyed?: UnkeyedColumnConfig | undefined;
    byGroup?: Record<string, GroupColumnOverride> | undefined;
}

export interface MergeFilterOptions {
    emptyKeyLabel?: string | undefined;
    rejectedKeyLabel?: string | undefined;
    keyNormalizer?: string | KeyNormalizer | undefined;
}
