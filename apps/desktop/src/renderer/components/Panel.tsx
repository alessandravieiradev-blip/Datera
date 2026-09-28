import { ReactNode } from "react";

interface PanelProps {
    title?: string;
    subtitle?: string;
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}

export function Panel({
    title,
    subtitle,
    action,
    className,
    children,
}: PanelProps) {
    return (
        <section className={className ? `panel ${className}` : "panel"}>
            {(title || action) && (
                <header className="panel-header">
                    <div>
                        {title && <h2 className="section-heading">{title}</h2>}
                        {subtitle && <p className="muted small">{subtitle}</p>}
                    </div>
                    {action}
                </header>
            )}
            {children}
        </section>
    );
}
