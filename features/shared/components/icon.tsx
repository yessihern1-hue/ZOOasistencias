import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "arrow-right"
  | "bell"
  | "calendar"
  | "check"
  | "chevron-down"
  | "clock"
  | "dashboard"
  | "document"
  | "eye"
  | "eye-off"
  | "fingerprint"
  | "logout"
  | "map-pin"
  | "menu"
  | "search"
  | "shield"
  | "sparkles"
  | "trend-down"
  | "trend-up"
  | "users"
  | "x";

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

export function Icon({ name, size = 20, ...props }: IconProps) {
  const paths: Record<IconName, ReactNode> = {
    "arrow-right": <path d="M5 12h14m-5-5 5 5-5 5" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    calendar: (
      <>
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    dashboard: (
      <>
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
      </>
    ),
    document: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5M9 12h6M9 16h6" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    "eye-off": (
      <>
        <path d="m3 3 18 18M10.6 6.2Q11.3 6 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.2 3M6.5 6.5C3.5 8.3 2 12 2 12s3.5 6 10 6a10 10 0 0 0 4-.8" />
      </>
    ),
    fingerprint: (
      <>
        <path d="M12 11a2 2 0 0 0-2 2c0 2-.3 5-2 7" />
        <path d="M12 7a6 6 0 0 0-6 6c0 1.5-.2 3-.8 4.4M12 3a10 10 0 0 0-10 10" />
        <path d="M14 21c1.4-2.4 2-5.1 2-8a4 4 0 0 0-8 0c0 3-.7 5.4-2 7" />
        <path d="M18.5 18.5A15 15 0 0 0 20 13a8 8 0 0 0-8-8" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
      </>
    ),
    "map-pin": (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    sparkles: <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2zM19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7zM5 15l.6 1.9 1.9.6-1.9.6L5 20l-.6-1.9-1.9-.6 1.9-.6z" />,
    "trend-down": <path d="m4 7 6 6 4-4 6 6M15 15h5v-5" />,
    "trend-up": <path d="m4 17 6-6 4 4 6-6M15 9h5v5" />,
    users: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21v-2a6 6 0 0 1 12 0v2M16 4a4 4 0 0 1 0 8M16 15a6 6 0 0 1 6 6" />
      </>
    ),
    x: <path d="M6 6l12 12M18 6 6 18" />,
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
