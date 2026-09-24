export interface CombinePart {
    column: string;
    fallbackColumns?: string[] | undefined;
    default?: string | undefined;
}

export interface CombineColumnsConfig {
    into: string;
    parts: CombinePart[];
    separator?: string | undefined;
    keepSources?: boolean | undefined;
}
