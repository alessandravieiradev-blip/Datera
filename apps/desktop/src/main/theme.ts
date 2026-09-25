import { BrowserWindow, nativeTheme } from "electron";
import { Theme } from "../shared/api";

export const LIGHT_BACKGROUND = "#F8FAFC";
export const DARK_BACKGROUND = "#0B1120";

export function backgroundColor(): string {
    return nativeTheme.shouldUseDarkColors ? DARK_BACKGROUND : LIGHT_BACKGROUND;
}

export function applyTheme(theme: Theme): void {
    nativeTheme.themeSource = theme;
    for (const window of BrowserWindow.getAllWindows()) {
        window.setBackgroundColor(backgroundColor());
    }
}
