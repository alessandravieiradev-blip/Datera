interface ToastProps {
    text: string | null;
}

export function Toast({ text }: ToastProps) {
    return (
        <div className="toast-region" role="status" aria-live="polite">
            {text && <div className="toast">{text}</div>}
        </div>
    );
}
