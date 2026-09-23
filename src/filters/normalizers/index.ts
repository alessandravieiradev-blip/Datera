import { registerKeyNormalizer } from "../keyNormalizers";
import {
    alphanumericNormalizer,
    digitsOnlyNormalizer,
    lowercaseNormalizer,
    trimNormalizer,
} from "./builtin";

export function registerBuiltinKeyNormalizers(): void {
    registerKeyNormalizer("trim", trimNormalizer);
    registerKeyNormalizer("lowercase", lowercaseNormalizer);
    registerKeyNormalizer("digitsOnly", digitsOnlyNormalizer);
    registerKeyNormalizer("alphanumeric", alphanumericNormalizer);
}

export { loadNormalizerModules } from "./loader";
