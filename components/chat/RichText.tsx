"use client";
import { ExternalLink } from "lucide-react";
import { splitLinks, linkLabel } from "@/lib/linkify";

/**
 * PUFAK MATNI — havolalar BOSILADIGAN qilib chiziladi.
 *
 * ⚠️ AI media handoff (euroflowers_ai_media_handoff_frontend.md): AI mijozning
 *    rasm/story/reel'ini tushunmasa, HAVOLANI operatorga uzatadi. O'sha havola
 *    CRM chatida ham turadi — ilgari oddiy matn edi va operator uni qo'lda
 *    ko'chirishga majbur bo'lardi.
 *
 * `tone="brand"` — brend rangidagi pufak (AI/operator): havola pufak matni
 * rangida, faqat tag ostida chiziq bilan ajraladi (primary ko'k rang u yerda
 * ko'rinmasdi).
 */
export default function RichText({ text, tone = "plain" }: { text: string; tone?: "plain" | "brand" }) {
  const parts = splitLinks(text);
  if (parts.length === 0) return null;
  if (parts.every((p) => p.type === "text")) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.type === "url" ? (
          <a
            key={i}
            href={p.value}
            target="_blank"
            rel="noreferrer"
            title={p.value}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex max-w-full items-baseline gap-1 font-semibold underline underline-offset-2 transition-opacity duration-150 hover:opacity-80"
            /* ⚠️ RANG: brend pufagida (AI/operator) — pufak matni rangi; neytral pufakda
               primary matn rangiga BIROZ ARALASHTIRILADI: toza primary qorong'i mavzudagi
               to'q pufak ustida past kontrast berardi (o'lchangan 3.6:1). */
            style={{ color: tone === "brand" ? "inherit" : "color-mix(in srgb, var(--primary) 60%, var(--text))", overflowWrap: "anywhere" }}
          >
            <span className="min-w-0">{linkLabel(p.value)}</span>
            <ExternalLink size={11} strokeWidth={2.2} className="shrink-0 translate-y-px opacity-70" aria-hidden />
          </a>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}
