"use client";
import { API_BASE, getTokens } from "./api";

/**
 * Bildirishnoma WebSocket manzili — Channels JWT konvensiyasi:
 *   wss://<host>/ws/notifications/?token=<access>
 * Token bo'lmasa null (ulanmaymiz).
 */
export function notifSocketUrl(): string | null {
  const t = getTokens();
  if (!t) return null;
  const u = new URL(API_BASE);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${u.host}/ws/notifications/?token=${encodeURIComponent(t.access)}`;
}
