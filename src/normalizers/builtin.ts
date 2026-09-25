import { KeyNormalizer } from "./registry";

export const trimNormalizer: KeyNormalizer = (raw) => ({
    key: typeof raw === "string" ? raw.trim() : raw,
});

export const lowercaseNormalizer: KeyNormalizer = (raw) => ({
    key: String(raw).trim().toLowerCase(),
});

export const digitsOnlyNormalizer: KeyNormalizer = (raw) => {
    const digits = String(raw).replace(/\D/g, "");
    return digits === "" ? null : { key: digits };
};

export const alphanumericNormalizer: KeyNormalizer = (raw) => {
    const clean = String(raw)
        .replace(/[^\p{L}\p{N}]/gu, "")
        .toLowerCase();
    return clean === "" ? null : { key: clean };
};
