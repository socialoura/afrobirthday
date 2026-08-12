/** Fired on window when the mobile sticky order CTA bar shows/hides, so other fixed UI (e.g. the chat bubble) can move out of its way. */
export const STICKY_CTA_VISIBILITY_EVENT = "afrobirthday:sticky-cta";

export type StickyCtaVisibilityDetail = { visible: boolean };
