"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, ImageOff, X } from "lucide-react";
import { PHOTO_EXPIRED_TEXT } from "@/lib/leadDetails";

/**
 * MIJOZ YUBORGAN RASMLAR (`details.photo_urls`).
 *
 * ⚠️ HAVOLALAR BIZNIKI EMAS. Ular Instagram/Telegram CDN'iga qaraydi va o'z
 * serverimizga KO'CHIRILMAYDI — Telegram havolalari bir muddatdan keyin
 * ishlamay qoladi (spec). Shu bois:
 *   • har rasmda ALOHIDA `onError` bor: siniq rasm belgisi ham, «xatolik» ham
 *     ko'rsatilmaydi — operatorga NIMA QILISH kerakligi aytiladi;
 *   • yonida doim «Yangi oynada ochish» havolasi turadi, chunki brauzer
 *     ba'zan `<img>` ni bloklab, to'g'ridan-to'g'ri ochilganda ko'rsatadi.
 */
export default function LeadPhotos({ urls, compact = false }: { urls: string[]; compact?: boolean }) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);

  const markFailed = useCallback((u: string) => setFailed((p) => (p[u] ? p : { ...p, [u]: true })), []);

  // lightbox — Esc bilan yopiladi
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!urls.length) return null;
  const size = compact ? 64 : 88;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="flex flex-col gap-1">
            {failed[u] ? (
              // ⚠️ MUDDATI O'TGAN — spec matni AYNAN; siniq rasm YOKI xato holati EMAS
              <div
                className="flex flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed px-2 text-center"
                style={{ width: size * 1.9, height: size, borderColor: "var(--border-strong)", background: "var(--surface-2)" }}
              >
                <ImageOff size={15} strokeWidth={1.9} style={{ color: "var(--muted)" }} />
                <span className="text-[10px] font-semibold leading-tight" style={{ color: "var(--text-2)" }}>{PHOTO_EXPIRED_TEXT}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(u)}
                className="overflow-hidden rounded-[12px] border transition-transform duration-150 hover:scale-[1.03]"
                style={{ width: size, height: size, borderColor: "var(--border)", background: "var(--surface-2)" }}
                title="Kattalashtirib ko'rish"
                aria-label={`${i + 1}-rasmni ochish`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`Mijoz yuborgan rasm ${i + 1}`} loading="lazy"
                  onError={() => markFailed(u)}
                  className="h-full w-full object-cover" />
              </button>
            )}
            {/* ⚠️ Havola DOIM bor — brauzer <img> ni bloklasa ham rasm shu yerdan ochiladi.
                Matn KESILMAYDI: tor eskiz ostida ikki qatorga o'tadi (spec matni to'liq ko'rinsin). */}
            <a href={u} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-1 text-[10.5px] font-semibold leading-tight hover:underline"
              style={{ color: "var(--primary)", maxWidth: failed[u] ? size * 1.9 : size }}
              title="Yangi oynada ochish">
              <ExternalLink size={10} strokeWidth={2.2} className="mt-px shrink-0" />
              <span>Yangi oynada ochish</span>
            </a>
          </div>
        ))}
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "color-mix(in srgb, #000 78%, transparent)" }}
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Rasm"
        >
          <button type="button" onClick={() => setOpen(null)} aria-label="Yopish"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "var(--surface-solid)", color: "var(--text)" }}>
            <X size={18} strokeWidth={2.2} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open} alt="Mijoz yuborgan rasm" onClick={(e) => e.stopPropagation()}
            onError={() => { markFailed(open); setOpen(null); }}
            className="max-h-[88vh] max-w-[92vw] rounded-[16px] object-contain" />
        </div>,
        document.body
      )}
    </>
  );
}
