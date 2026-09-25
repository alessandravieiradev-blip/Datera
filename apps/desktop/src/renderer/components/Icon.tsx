export type IconName =
    | "home"
    | "upload"
    | "rules"
    | "clock"
    | "settings"
    | "help"
    | "database"
    | "check"
    | "alert"
    | "merge"
    | "file"
    | "eye"
    | "arrowRight"
    | "trendDown"
    | "trendUp"
    | "sparkle"
    | "info"
    | "calendar"
    | "folder"
    | "trash"
    | "arrowLeft"
    | "close"
    | "code"
    | "users";

const PATHS: Record<IconName, string[]> = {
    home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h5v-6h4v6h5V9.5"],
    upload: [
        "M12 15V3",
        "M7 8l5-5 5 5",
        "M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
    ],
    rules: ["M4 4h16v16H4z", "M8 9h8", "M8 15h8", "M12 7v4"],
    clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
    settings: [
        "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
        "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    ],
    help: [
        "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
        "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.3",
        "M12 17h.01",
    ],
    database: [
        "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z",
        "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5",
        "M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
    ],
    check: ["M5 12.5 10 17l9-10"],
    alert: ["M12 3 2 20h20L12 3z", "M12 10v4", "M12 17h.01"],
    merge: [
        "M8 4h10a2 2 0 0 1 2 2v10",
        "M4 8h10a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2V8z",
        "M8 14h4",
    ],
    file: [
        "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z",
        "M14 3v6h6",
    ],
    eye: [
        "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z",
        "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    ],
    arrowRight: ["M5 12h14", "M13 6l6 6-6 6"],
    trendDown: ["M3 7l6 6 4-4 8 8", "M21 11v6h-6"],
    trendUp: ["M3 17l6-6 4 4 8-8", "M21 13V7h-6"],
    sparkle: [
        "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
        "M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16z",
    ],
    info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 8h.01"],
    calendar: ["M4 6h16v14H4z", "M4 10h16", "M8 3v4", "M16 3v4"],
    trash: [
        "M4 7h16",
        "M10 11v6",
        "M14 11v6",
        "M6 7l1 13h10l1-13",
        "M9 7V4h6v3",
    ],
    close: ["M6 6l12 12", "M18 6L6 18"],
    code: ["M8 7l-5 5 5 5", "M16 7l5 5-5 5", "M14 4l-4 16"],
    users: [
        "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
        "M2 21v-1a6 6 0 0 1 12 0v1",
        "M16 3.5a4 4 0 0 1 0 7",
        "M22 21v-1a6 6 0 0 0-4-5.6",
    ],
    arrowLeft: ["M19 12H5", "M11 6l-6 6 6 6"],
    folder: [
        "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z",
    ],
};

interface IconProps {
    name: IconName;
    size?: number;
    strokeWidth?: number;
}

export function Icon({ name, size = 22, strokeWidth = 1.8 }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {PATHS[name].map((d) => (
                <path key={d} d={d} />
            ))}
        </svg>
    );
}
