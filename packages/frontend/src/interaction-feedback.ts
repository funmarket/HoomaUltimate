export type InteractionNotice = {
  readonly kind: "success";
  readonly message: string;
};

const INTERACTION_NOTICE_STATE_KEY = "hoomaInteractionNotice";

export function successNavigationState(message: string): Record<string, InteractionNotice> {
  return {
    [INTERACTION_NOTICE_STATE_KEY]: {
      kind: "success",
      message,
    },
  };
}

export function readInteractionNotice(state: unknown): InteractionNotice | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const candidate = (state as Record<string, unknown>)[INTERACTION_NOTICE_STATE_KEY];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;

  const notice = candidate as Record<string, unknown>;
  if (notice.kind !== "success" || typeof notice.message !== "string") return null;
  const message = notice.message.trim();
  return message ? { kind: "success", message } : null;
}

export function clearInteractionNoticeState(state: unknown): Record<string, unknown> | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const next = { ...(state as Record<string, unknown>) };
  delete next[INTERACTION_NOTICE_STATE_KEY];
  return Object.keys(next).length ? next : null;
}
