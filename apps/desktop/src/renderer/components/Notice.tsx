import { ReactNode } from "react";
import { Icon, IconName } from "./Icon";

type NoticeTone = "info" | "success" | "warning" | "error";

const ICONS: Record<NoticeTone, IconName> = {
    info: "info",
    success: "check",
    warning: "alert",
    error: "alert",
};

interface NoticeProps {
    tone: NoticeTone;
    title: string;
    children?: ReactNode;
    action?: ReactNode;
}

export function Notice({ tone, title, children, action }: NoticeProps) {
    return (
        <div
            className={`notice notice-${tone}`}
            role={tone === "error" ? "alert" : "status"}
        >
            <span className="notice-icon">
                <Icon name={ICONS[tone]} />
            </span>
            <div className="notice-body">
                <strong>{title}</strong>
                {children && <div className="small">{children}</div>}
            </div>
            {action}
        </div>
    );
}
