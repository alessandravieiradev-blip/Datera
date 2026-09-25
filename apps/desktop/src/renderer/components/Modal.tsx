import { ReactNode, useEffect } from "react";
import { Icon } from "./Icon";

interface ModalProps {
    title: string;
    onClose: () => void;
    footer?: ReactNode;
    children: ReactNode;
}

export function Modal({ title, onClose, footer, children }: ModalProps) {
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
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <header className="modal-header">
                    <h2>{title}</h2>
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
