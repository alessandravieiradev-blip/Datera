export type IconName =
    | "home"
    | "upload"
    | "rules"
    | "clock"
    | "settings"
    | "help"
    | "check"
    | "alert"
    | "file"
    | "arrowRight"
    | "info"
    | "folder"
    | "trash"
    | "arrowLeft"
    | "close"
    | "code"
    | "users"
    | "keyboard"
    | "reset";

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
    check: ["M5 12.5 10 17l9-10"],
    alert: ["M12 3 2 20h20L12 3z", "M12 10v4", "M12 17h.01"],
    file: [
        "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z",
        "M14 3v6h6",
    ],
    arrowRight: ["M5 12h14", "M13 6l6 6-6 6"],
    info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 8h.01"],
    trash: [
        "M4 7h16",
        "M10 11v6",
        "M14 11v6",
        "M6 7l1 13h10l1-13",
        "M9 7V4h6v3",
    ],
    close: ["M6 6l12 12", "M18 6L6 18"],
    code: ["M8 7l-5 5 5 5", "M16 7l5 5-5 5", "M14 4l-4 16"],
    keyboard: [
        "M3 6h18v12H3z",
        "M7 10h.01",
        "M11 10h.01",
        "M15 10h.01",
        "M17 14H7",
    ],
    reset: ["M4 12a8 8 0 1 0 2.3-5.6", "M4 4v5h5"],
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
