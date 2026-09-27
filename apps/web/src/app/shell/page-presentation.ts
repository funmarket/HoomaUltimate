export const SHELL_PRESENTATION = {
  STANDARD: "standard",
  MEDIA_FIRST: "media-first",
} as const;

export type ShellPresentation =
  (typeof SHELL_PRESENTATION)[keyof typeof SHELL_PRESENTATION];

export function shellPresentationForPath(pathname: string): ShellPresentation {
  return pathname === "/athletes"
    ? SHELL_PRESENTATION.MEDIA_FIRST
    : SHELL_PRESENTATION.STANDARD;
}
