export interface Filter<T> {
    apply(rows: T[]): T[];
}