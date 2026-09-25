import type { DateraApi } from "../../../desktop/src/shared/api";

declare global {
    interface Window {
        datera: DateraApi;
    }
}
