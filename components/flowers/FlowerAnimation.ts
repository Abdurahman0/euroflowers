/**
 * Premium piyon animatsiya lug'ati — GLB ichidagi klip nomlari va fazalar.
 * GLB tarkibi (tekshirilgan): Closed(1s) · Closing(6s) · FullyBloomed(1s) ·
 * Opening(6s) · WindIdle(8s, doim aylanadi).
 */

export const CLIP = {
  closed: "Closed",
  closing: "Closing",
  fullyBloomed: "FullyBloomed",
  opening: "Opening",
  windIdle: "WindIdle",
} as const;

export type ClipName = (typeof CLIP)[keyof typeof CLIP];

/** Gul hayot fazasi — mahalliy vaqtga bog'liq. */
export type FlowerPhase = "closed" | "opening" | "bloomed" | "closing";

/** Faza → shu fazada turadigan/ijro etiladigan klip. */
export const PHASE_CLIP: Record<FlowerPhase, ClipName> = {
  closed: CLIP.closed,
  opening: CLIP.opening,
  bloomed: CLIP.fullyBloomed,
  closing: CLIP.closing,
};

/** O'tish klipi tugagach qaysi barqaror fazaga o'tiladi. */
export const NEXT_STEADY: Partial<Record<FlowerPhase, FlowerPhase>> = {
  opening: "bloomed",
  closing: "closed",
};

/** Krossfeyd davomiyligi (soniya) — hech qachon keskin almashmaydi. */
export const FADE_S = 0.9;
