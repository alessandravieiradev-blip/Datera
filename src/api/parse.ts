import { z } from "zod";
import { translateIssue } from "../config/messages";

function where(path: readonly PropertyKey[]): string {
    return path
        .filter(
            (part): part is string | number =>
                typeof part === "string" || typeof part === "number",
        )
        .join(".");
}

export function parseWith<T extends z.ZodType>(
    schema: T,
    value: unknown,
    label: string,
): z.infer<T> {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    const problems = result.error.issues.map((issue) => {
        const place = where(issue.path);
        return `${place ? `${place}: ` : ""}${translateIssue(issue)}`;
    });
    throw new Error(`${label} com problema: ${problems.join(" ")}`);
}
