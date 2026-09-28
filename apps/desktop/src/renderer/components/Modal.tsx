import { ReactNode, useEffect, useId, useRef } from "react";
import { Icon } from "./Icon";
import { focusableIn, useFocusTrap } from "../lib/focusTrap";

interface ModalProps {
    title: string;
    onClose: () => void;
    footer?: ReactNode;
    children: ReactNode;
}

export function Modal({ title, onClose, footer, children }: ModalProps) {
    const dialog = useRef<HTMLDivElement>(null);
    const titleId = useId();

    useFocusTrap(dialog, (root) => {
        const body = root.querySelector<HTMLElement>(".modal-body");
        return body ? focusableIn(body)[0] : null;
    });

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="overlay"
            onMouseDown={(event) =>
                event.target === event.currentTarget && onClose()
            }
        >
            <div
                ref={dialog}
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <header className="modal-header">
                    <h2 id={titleId}>{title}</h2>
                    <button
                        type="button"
                        className="icon-button"
                        aria-label="Fechar"
                        onClick={onClose}
                    >
                        <Icon name="close" />
                    </button>
                </header>
                <div className="modal-body">{children}</div>
                {footer && <footer className="modal-footer">{footer}</footer>}
            </div>
        </div>
    );
}
