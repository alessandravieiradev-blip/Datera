import type { DateraApi } from "../shared/api";

declare global {
    interface Window {
        datera: DateraApi;
    }
}
