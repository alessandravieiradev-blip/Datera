import { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    meta?: ReactNode;
    actions?: ReactNode;
}

export function PageHeader({ title, meta, actions }: PageHeaderProps) {
    return (
        <header className="page-header">
            <div className="page-title">
                <h1>{title}</h1>
                {meta && <p className="page-meta">{meta}</p>}
            </div>
            {actions && <div className="header-actions">{actions}</div>}
        </header>
    );
}
