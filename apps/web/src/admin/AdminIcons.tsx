import type { SVGProps } from "react";

export type AdminIconName =
  | "access"
  | "archive"
  | "car"
  | "check"
  | "chevron"
  | "clear"
  | "communities"
  | "dashboard"
  | "disable"
  | "filter"
  | "gamepad"
  | "key"
  | "loadMore"
  | "moderation"
  | "operations"
  | "people"
  | "redCard"
  | "retry"
  | "search"
  | "teams"
  | "warning"
  | "readOnly";

const paths: Record<AdminIconName, readonly string[]> = {
  access: [
    "M12 3a4 4 0 0 0-4 4v3H6v11h12V10h-2V7a4 4 0 0 0-4-4Z",
    "M10 10V7a2 2 0 1 1 4 0v3",
    "M12 15v2",
  ],
  archive: ["M4 7h16", "M6 7v12h12V7", "M8 4h8l2 3H6l2-3Z", "M10 11h4"],
  car: ["M5 14l2-5h10l2 5", "M6 14h12v4H6v-4Z", "M8 18h.01", "M16 18h.01", "M8 11h8"],
  check: ["M5 12l4 4L19 6"],
  chevron: ["M8 10l4 4 4-4"],
  clear: ["M6 6l12 12", "M18 6L6 18"],
  communities: [
    "M6 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M12 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M8.5 13.5l-2-2",
    "M15.5 13.5l2-2",
  ],
  dashboard: ["M4 5h7v7H4V5Z", "M13 5h7v4h-7V5Z", "M13 11h7v8h-7v-8Z", "M4 14h7v5H4v-5Z"],
  disable: ["M6 6l12 12", "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"],
  filter: ["M4 6h16", "M7 12h10", "M10 18h4"],
  gamepad: [
    "M7 14h.01",
    "M10 11h.01",
    "M16 12h.01",
    "M18 15h.01",
    "M6 9h12l2 7a3 3 0 0 1-5 2l-2-2h-2l-2 2a3 3 0 0 1-5-2l2-7Z",
  ],
  key: ["M14 7a4 4 0 1 0-3.5 5.9L4 19v2h3v-2h2v-2h2l2.1-2.1A4 4 0 0 0 14 7Z", "M14 7h.01"],
  loadMore: ["M12 5v14", "M6 13l6 6 6-6"],
  moderation: ["M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z", "M9 12l2 2 4-5"],
  operations: [
    "M6 7h7",
    "M6 17h7",
    "M15 7h3v3",
    "M15 17h3v-3",
    "M13 7c3 0 5 2 5 5",
    "M13 17c-3 0-5-2-5-5",
  ],
  people: [
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M17 10a3 3 0 1 0 0-6",
    "M3 21a6 6 0 0 1 12 0",
    "M15 18a5 5 0 0 1 6 3",
  ],
  redCard: ["M8 3h8v18H8V3Z", "M10 6h4"],
  retry: ["M20 12a8 8 0 1 1-2.3-5.7", "M20 5v5h-5"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "M20 20l-4-4"],
  teams: [
    "M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M16 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M4 20a5 5 0 0 1 8 0",
    "M12 20a5 5 0 0 1 8 0",
  ],
  warning: ["M12 3l10 18H2L12 3Z", "M12 9v5", "M12 17h.01"],
  readOnly: ["M5 5h10l4 4v10H5V5Z", "M15 5v4h4", "M8 14h8", "M8 17h5"],
};

export function AdminIcon({
  name,
  decorative = true,
  ...props
}: SVGProps<SVGSVGElement> & { readonly name: AdminIconName; readonly decorative?: boolean }) {
  return (
    <svg
      className="admin-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={decorative ? "true" : undefined}
      focusable="false"
      {...props}
    >
      {paths[name].map((path, index) => (
        <path d={path} key={`${name}-${index}`} />
      ))}
    </svg>
  );
}
