"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Kichik markaziy tasdiq dialogi — barcha "o'chirish/nofaollashtirish" uchun.
 * BODY PORTALI (sahifa animatsiyasi ostida qolmasin), FAQAT tema tokenlari
 * (bir temada ko'rinmay qolish xatosiga qarshi), Esc/overlay yopadi.
 */
export default function ConfirmDialog({
  title,
  body,
  note,
  confirmLabel = "Tasdiqlash",
  cancelLabel = "Bekor qilish",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-5"
      style={{ background: "rgba(24,17,12,.4)", backdropFilter: "blur(8px)" }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      data-lenis-prevent
    >
      <div className="glass-modal w-[min(400px,100%)] p-6 animate-[rowIn_0.22s_var(--ease)_both]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-bold" style={{ color: "var(--text)" }}>{title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>{body}</p>
        {note && (
          <p className="mt-2 rounded-[11px] bg-peach px-3 py-2 text-[12.5px] font-semibold leading-snug text-peachink">⚠ {note}</p>
        )}
        <div className="mt-5 flex gap-2.5">
          <button onClick={onCancel} className="btn-ghost flex-1">{cancelLabel}</button>
          <button onClick={onConfirm} disabled={busy} className={`${danger ? "btn-danger" : "btn-primary"} flex-1 ${busy ? "btn-loading" : ""}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
