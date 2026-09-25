interface ToastProps {
    text: string | null;
}

export function Toast({ text }: ToastProps) {
    if (!text) return null;
    return (
        <div className="toast" role="status" aria-live="polite">
            {text}
        </div>
    );
}
