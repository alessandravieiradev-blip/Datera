import { RefObject, useEffect } from "react";

const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function focusableIn(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.getClientRects().length > 0,
    );
}

export function useFocusTrap(
    ref: RefObject<HTMLElement | null>,
    pickInitial?: (root: HTMLElement) => HTMLElement | null | undefined,
): void {
    useEffect(() => {
        const root = ref.current;
        if (!root) return;
        const previous =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        const initial = pickInitial?.(root) ?? focusableIn(root)[0] ?? root;
        initial.focus();

        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Tab") return;
            const items = focusableIn(root);
            const first = items[0];
            const last = items[items.length - 1];
            if (!first || !last) {
                event.preventDefault();
                return;
            }
            const active = document.activeElement;
            const outside = !root.contains(active);
            if (event.shiftKey && (active === first || outside)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (active === last || outside)) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("keydown", onKey, true);
            if (previous?.isConnected) previous.focus();
        };
    }, []);
}

export function prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
