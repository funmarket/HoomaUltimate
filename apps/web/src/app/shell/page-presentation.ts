export const SHELL_PRESENTATION = {
  STANDARD: "standard",
  MEDIA_FIRST: "media-first",
} as const;

export type ShellPresentation = (typeof SHELL_PRESENTATION)[keyof typeof SHELL_PRESENTATION];

export const SHELL_INLINE_PRESENTATION = {
  LEGACY: "legacy",
  EDGE_CAPABLE: "edge-capable",
} as const;

export type ShellInlinePresentation =
  (typeof SHELL_INLINE_PRESENTATION)[keyof typeof SHELL_INLINE_PRESENTATION];

export function shellPresentationForPath(pathname: string): ShellPresentation {
  return pathname === "/athletes" || pathname === "/athletes/"
    ? SHELL_PRESENTATION.MEDIA_FIRST
    : SHELL_PRESENTATION.STANDARD;
}

export function shellInlinePresentationForPath(pathname: string): ShellInlinePresentation {
  void pathname;
  return SHELL_INLINE_PRESENTATION.EDGE_CAPABLE;
}
