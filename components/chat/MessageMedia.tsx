"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, File as FileIcon, Pause, Play, Play as PlayIcon, RotateCcw, X } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InstagramIcon } from "@hugeicons/core-free-icons";
import type { Message } from "@/lib/types";

/**
 * CHAT MEDIASI — rasm / video / ovoz / reel / fayl.
 * Aniqlash logikasi clynica CRM'dan ko'chirilgan (qarang: MEDIA_NOTES.md),
 * ko'rinish esa EuroFlowers tilida qayta yozilgan.
 *
 * Kontrakt (backend Instagram webhook'idan):
 *   metadata.is_non_text_media === true → media
 *   URL       = metadata.media_url (yoki alias) → bo'lmasa xabar matni
 *   Tur       = metadata.media_type (voice/voice_message → audio) → bo'lmasa
 *               URL kengaytmasi/instagram yo'li bo'yicha aniqlanadi
 */

export type MediaKind = "image" | "video" | "audio" | "ig_reel" | "file";
/** ribbon — rasm ustidagi kichik yorliq (masalan "Story"); caption — media ostidagi izoh */
export type MediaPayload = { kind: MediaKind; url: string; ribbon?: string; caption?: string };

const EXT: [MediaKind, RegExp][] = [
  ["audio", /\.(aac|m4a|mp3|ogg|opus|wav|weba)$/i],
  ["video", /\.(m4v|mov|mp4|webm)$/i],
  ["image", /\.(avif|gif|jpe?g|png|webp)$/i],
];
/** hujjat kengaytmalari — bunday link hech qachon video player'ga tushmasin */
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z)$/i;

const parseUrl = (v: string): URL | null => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
};

/** instagram.com/(p|reel|tv)/<id> → embed manzili (aks holda null) */
export const igEmbedUrl = (url: string): string | null => {
  const u = parseUrl(url);
  if (!u || !u.hostname.toLowerCase().endsWith("instagram.com")) return null;
  const m = u.pathname.match(/^\/(p|reel|tv)\/([^/?#]+)/i);
  return m ? `https://www.instagram.com/${m[1].toLowerCase()}/${m[2]}/embed` : null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

const kindFromUrl = (url: string): MediaKind | null => {
  const u = parseUrl(url);
  if (!u) return null;
  if (igEmbedUrl(url)) return "ig_reel";
  const path = u.pathname.toLowerCase();
  return EXT.find(([, re]) => re.test(path))?.[0] ?? null;
};

const URL_RE = /https?:\/\/[^\s]+/gi;
const firstUrl = (text: string): string | null => text.match(URL_RE)?.[0] ?? null;

/** Xom `media_type`/`kind`/`mime` → bizning tur. Explicit=media ekani aniq
    (attachment/is_non_text_media) — bunda kengaytmasiz IG CDN link RASM deb olinadi. */
function classify(raw: string, url: string, explicit: boolean): MediaKind | null {
  const r = raw.toLowerCase();
  if (r === "voice" || r === "voice_message" || r === "audio" || r.startsWith("audio/")) return "audio";
  if (r === "video" || r.startsWith("video/")) return "video";
  if (r === "image" || r === "photo" || r.startsWith("image/")) return "image";
  if (r === "ig_reel" || r === "reel") return "ig_reel";
  // story media (ig_story) — ko'pincha rasm/skrinshot: rasm sifatida ko'rsatamiz
  if (r === "story" || r === "ig_story") return "image";
  if (r === "file" || r === "document" || r === "doc" || r.startsWith("application/")) return "file";
  const byUrl = kindFromUrl(url);
  if (byUrl) return byUrl;
  if (DOC_EXT.test(url)) return "file";
  // kengaytmasiz IG lookaside CDN link (kind:"media", type:"") — RASM deb olamiz
  // (xatoda "asl havolani ochish" fallback ko'rsatiladi). Oddiy matndagi havola
  // media emas — text bubble bo'lib qoladi.
  return explicit ? "image" : null;
}

/** Xabardan media chiqarish — media bo'lmasa null (oddiy text bubble).
    Manba tartibi (real backend kontrakti): attachments[] → image_tool_result →
    media_url alias'lari → matn ichidagi yalang'och havola. */
export function parseMedia(m: Message): MediaPayload | null {
  const meta = (m.metadata ?? {}) as Record<string, unknown>;
  const text = (m.text ?? "").trim();

  // 1) metadata.attachments[] — mijozdan kelgan media/story
  const atts = Array.isArray(meta.attachments) ? (meta.attachments as Record<string, unknown>[]) : [];
  const att = atts.find((a) => a && str(a.url));
  if (att) {
    const url = str(att.url)!;
    const kw = (str(att.kind) ?? "").toLowerCase();
    const raw = str(att.type) || kw; // type bo'sh bo'lsa kind'ga qaraymiz
    const kind = classify(raw, url, true) ?? "image";
    const ribbon = kw === "story" || raw === "ig_story" ? "Story" : undefined;
    return { kind, url, ribbon };
  }

  // 2) metadata.image_tool_result — AI yuborgan katalog rasmi (sender: system)
  const itr = (meta.image_tool_result ?? null) as Record<string, unknown> | null;
  const itrUrl = itr ? str(itr.image_url) : null;
  if (itrUrl) {
    const name = itr ? str(itr.catalog_name) : null;
    return { kind: "image", url: itrUrl, caption: name ? `Katalog rasmi: ${name}` : "Katalog rasmi" };
  }

  // 3) TOP-LEVEL media_url/image_url (AI stock rasm vositasi — d52ad7d) va
  //    metadata media_url alias'lari → 4) matn ichidagi havola
  const isMedia = meta.is_non_text_media === true;
  const topUrl = str(m.media_url) ?? str(m.image_url);
  const aliasUrl = topUrl ?? str(meta.media_url) ?? str(meta.url) ?? str(meta.attachment_url) ?? str(meta.file_url) ?? str(meta.image_url);
  const url = aliasUrl ?? firstUrl(text);
  if (!url) return null;
  const raw = str(meta.media_type) ?? str(meta.type) ?? str(meta.mime_type) ?? str(meta.mime) ?? "";
  const explicit = isMedia || !!aliasUrl;
  const kind = classify(raw, url, explicit);
  if (!kind) return null;
  return { kind, url };
}

/** Media bubble'i bilan birga ko'rsatiladigan MATN — media URL(lar)i va
    endi bo'sh qolgan "Media link:" / "Story link:" yorliq satrlari olib tashlanadi. */
export function mediaBodyText(m: Message, media: MediaPayload | null): string {
  const text = (m.text ?? "").trim();
  if (!media) return text;
  // 1) aynan media URL'ini (nisbiy bo'lsa ham) olib tashlaymiz, 2) qolgan
  // http havolalarni, 3) endi bo'sh qolgan "Media link:"/"Story link:" satrlarini
  const cleaned = text
    .split(media.url).join("")
    .replace(URL_RE, "")
    .split("\n")
    .filter((line) => !/^\s*(media\s*link|story\s*link|media|link|story)\s*:?\s*$/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // matn qolmasa — media caption'i (bo'lsa) ishlatiladi
  return cleaned || media.caption || "";
}

const fileNameOf = (url: string) => {
  try {
    const p = new URL(url).pathname;
    return decodeURIComponent(p.split("/").filter(Boolean).pop() ?? "fayl");
  } catch {
    return "fayl";
  }
};
const extOf = (url: string) => (fileNameOf(url).split(".").pop() ?? "").toUpperCase().slice(0, 5);

/* ===== lazy: element ko'rinmaguncha media yuklanmaydi ===== */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }),
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

/* ===== BITTA vaqtda BITTA ovoz: modul registri ===== */
let playingAudio: HTMLAudioElement | null = null;
const claimAudio = (el: HTMLAudioElement) => {
  if (playingAudio && playingAudio !== el) playingAudio.pause();
  playingAudio = el;
};
const releaseAudio = (el: HTMLAudioElement) => {
  if (playingAudio === el) playingAudio = null;
};

/** id'dan barqaror psevdo-to'lqin (har xabar o'z shakliga ega, render'da o'zgarmaydi) */
const waveform = (seed: number, bars = 34): number[] => {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: bars }, (_, i) => {
    const env = Math.sin((i / (bars - 1)) * Math.PI); // o'rtasi balandroq
    return Math.round(28 + rnd() * 52 * (0.45 + env * 0.75));
  });
};

const mmss = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "--:--";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const SPEEDS = [1, 1.5, 2] as const;

/* ===== OVOZLI XABAR — custom player ===== */
function VoiceBubble({ url, seed, onLight, onReady }: { url: string; seed: number; onLight: boolean; onReady?: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const barsRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(NaN);
  const [speed, setSpeed] = useState<number>(1);
  const [err, setErr] = useState(false);
  const [nonce, setNonce] = useState(0);
  const bars = useMemo(() => waveform(seed), [seed]);
  const pct = Number.isFinite(dur) && dur > 0 ? Math.min(cur / dur, 1) : 0;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { claimAudio(el); el.play().catch(() => setErr(true)); }
    else el.pause();
  };

  // bosish/sudrash bilan seek
  const seekTo = useCallback((clientX: number) => {
    const el = audioRef.current;
    const box = barsRef.current;
    if (!el || !box || !Number.isFinite(el.duration)) return;
    const r = box.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    el.currentTime = ratio * el.duration;
    setCur(el.currentTime);
  }, []);
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    seekTo(e.clientX);
    const move = (ev: PointerEvent) => seekTo(ev.clientX);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = speed;
  }, [speed]);

  const ink = onLight ? "var(--primary)" : "#ffffff";
  const track = onLight ? "color-mix(in srgb, var(--primary) 22%, transparent)" : "rgba(255,255,255,0.32)";
  const sub = onLight ? "var(--muted)" : "rgba(255,255,255,0.75)";

  if (err)
    return <MediaFailed onLight={onLight} onRetry={() => { setErr(false); setNonce((n) => n + 1); }} label="Ovozli xabar ochilmadi" />;

  return (
    <div className="flex w-[min(260px,58vw)] items-center gap-2.5 py-0.5">
      <audio
        ref={audioRef}
        key={nonce}
        src={nonce ? `${url}${url.includes("?") ? "&" : "?"}r=${nonce}` : url}
        preload="metadata"
        onLoadedMetadata={(e) => { setDur(e.currentTarget.duration); onReady?.(); }}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onPlay={(e) => { claimAudio(e.currentTarget); setPlaying(true); }}
        onPause={(e) => { releaseAudio(e.currentTarget); setPlaying(false); }}
        onEnded={(e) => { releaseAudio(e.currentTarget); setPlaying(false); setCur(0); }}
        onError={() => setErr(true)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pauza" : "Tinglash"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
        style={onLight
          ? { background: "var(--primary)", color: "var(--primary-contrast, #fff)" }
          : { background: "rgba(255,255,255,0.92)", color: "var(--primary)" }}
      >
        {playing ? <Pause size={15} strokeWidth={2.4} /> : <Play size={15} strokeWidth={2.4} className="ml-[1px]" />}
      </button>

      <div className="min-w-0 flex-1">
        {/* to'lqin — bosib/sudrab seek qilinadi */}
        <div
          ref={barsRef}
          onPointerDown={onPointerDown}
          role="slider"
          aria-label="Ovoz pozitsiyasi"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct * 100)}
          tabIndex={0}
          onKeyDown={(e) => {
            const el = audioRef.current;
            if (!el || !Number.isFinite(el.duration)) return;
            if (e.key === "ArrowRight") el.currentTime = Math.min(el.currentTime + 2, el.duration);
            if (e.key === "ArrowLeft") el.currentTime = Math.max(el.currentTime - 2, 0);
            if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); }
          }}
          className="flex h-[26px] cursor-pointer touch-none items-center gap-[2px]"
        >
          {bars.map((h, i) => {
            const on = i / bars.length <= pct;
            return (
              <span
                key={i}
                className="flex-1 rounded-full transition-[background-color,height] duration-150"
                style={{ height: `${h}%`, background: on ? ink : track, minWidth: 2 }}
              />
            );
          })}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold tabular-nums" style={{ color: sub }}>
          <span>{playing || cur > 0 ? mmss(cur) : mmss(dur)}</span>
          <button
            type="button"
            onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s as 1) + 1) % SPEEDS.length])}
            className="ml-auto rounded-full border px-1.5 py-[1px] text-[10.5px] leading-none transition-opacity duration-150 hover:opacity-80"
            style={{ borderColor: onLight ? "var(--border)" : "rgba(255,255,255,0.4)", color: sub }}
            title="Ijro tezligi"
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== xato holati — qayta urinish + (bo'lsa) asl havolani ochish ===== */
function MediaFailed({ onLight, onRetry, label, url }: { onLight: boolean; onRetry: () => void; label: string; url?: string }) {
  return (
    <div
      className="flex w-[min(260px,58vw)] items-center gap-2.5 rounded-[13px] border px-3 py-2.5"
      style={{
        background: onLight ? "var(--danger-soft, rgba(160,74,74,.12))" : "rgba(255,255,255,0.16)",
        borderColor: onLight ? "color-mix(in srgb, var(--danger-ink) 30%, transparent)" : "rgba(255,255,255,0.32)",
        color: onLight ? "var(--danger-ink)" : "#fff",
      }}
    >
      <FileIcon size={16} strokeWidth={2} className="shrink-0 opacity-80" />
      <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug">{label}</span>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" title="Asl havolani ochish" aria-label="Asl havolani ochish" className="shrink-0 rounded-full p-1 transition-opacity hover:opacity-70">
          <ExternalLink size={14} strokeWidth={2.2} />
        </a>
      )}
      <button type="button" onClick={onRetry} title="Qayta urinish" aria-label="Qayta urinish" className="shrink-0 rounded-full p-1 transition-opacity hover:opacity-70">
        <RotateCcw size={14} strokeWidth={2.2} />
      </button>
    </div>
  );
}

/* ===== RASM — skelet + lightbox (+ ixtiyoriy "Story" yorlig'i) ===== */
function ImageBubble({ url, ribbon, onOpen, onReady }: { url: string; ribbon?: string; onOpen: (u: string) => void; onReady?: () => void }) {
  const { ref, seen } = useInView<HTMLButtonElement>();
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);
  const [nonce, setNonce] = useState(0);
  // signed IG lookaside link muddati o'tishi mumkin — xatoda "asl havola" beriladi
  if (err) return <MediaFailed onLight onRetry={() => { setErr(false); setNonce((n) => n + 1); }} label="Media ochilmadi" url={url} />;
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(url)}
      className="relative block w-[min(280px,62vw)] overflow-hidden rounded-[13px]"
      style={{ background: "var(--surface-2)", aspectRatio: loaded ? undefined : "4 / 3" }}
      aria-label="Rasmni ochish"
    >
      {!loaded && <span className="absolute inset-0 animate-pulse" style={{ background: "linear-gradient(100deg, var(--surface-2), var(--hover), var(--surface-2))" }} />}
      {seen && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nonce ? `${url}${url.includes("?") ? "&" : "?"}r=${nonce}` : url}
          alt="Chat rasmi"
          loading="lazy"
          onLoad={() => { setLoaded(true); onReady?.(); }}
          onError={() => setErr(true)}
          className="block max-h-[300px] w-full object-cover transition-opacity duration-300"
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
      {ribbon && loaded && (
        <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: "linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)" }}>
          {ribbon}
        </span>
      )}
    </button>
  );
}

/* ===== VIDEO — plakat-karta, bosilganda inline ijro (reference kabi) ===== */
function VideoBubble({ url, onReady }: { url: string; onReady?: () => void }) {
  const [play, setPlay] = useState(false);
  const [err, setErr] = useState(false);
  if (err) return <MediaFailed onLight onRetry={() => setErr(false)} label="Videoni ochib bo'lmadi" />;
  if (play)
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={url}
        controls
        autoPlay
        preload="metadata"
        onLoadedData={onReady}
        onError={() => setErr(true)}
        className="block max-h-[320px] w-[min(280px,62vw)] rounded-[13px] bg-black object-contain"
      />
    );
  return (
    <button
      type="button"
      onClick={() => setPlay(true)}
      className="relative flex h-[168px] w-[min(280px,62vw)] items-center justify-center overflow-hidden rounded-[13px] border"
      style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
      aria-label="Videoni ijro etish"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-transform duration-200 hover:scale-105" style={{ background: "var(--primary)", color: "#fff" }}>
        <PlayIcon size={20} strokeWidth={2.2} className="ml-[2px]" />
      </span>
      <span className="absolute bottom-2 left-2.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "color-mix(in srgb, var(--surface-solid) 82%, transparent)", color: "var(--text-2)" }}>
        VIDEO
      </span>
    </button>
  );
}

/* ===== INSTAGRAM REEL — kompakt karta, so'ralganda embed ===== */
function ReelBubble({ url }: { url: string }) {
  const embed = igEmbedUrl(url);
  const [open, setOpen] = useState(false);
  return (
    <div className="w-[min(280px,62vw)] overflow-hidden rounded-[13px] border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      {open && embed ? (
        <iframe title="Instagram reel" src={embed} loading="lazy" className="block h-[380px] w-full border-0" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" />
      ) : (
        <button type="button" onClick={() => embed && setOpen(true)} disabled={!embed} className="flex w-full items-center gap-2.5 p-3 text-left disabled:cursor-default" aria-label="Reelni ko'rish">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)" }}>
            <HugeiconsIcon icon={InstagramIcon} size={16} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold">Instagram reel</span>
            <span className="block truncate text-[11.5px]" style={{ color: "var(--muted)" }}>{embed ? "Ko'rish uchun bosing" : "Ko'rib bo'lmaydi"}</span>
          </span>
        </button>
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[11.5px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]"
        style={{ borderColor: "var(--border)", color: "var(--primary)" }}
      >
        Instagramda ochish <ExternalLink size={13} strokeWidth={2} />
      </a>
    </div>
  );
}

/* ===== FAYL ===== */
function FileBubble({ url, onLight }: { url: string; onLight: boolean }) {
  const name = fileNameOf(url);
  const ext = extOf(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download
      className="flex w-[min(268px,60vw)] items-center gap-2.5 rounded-[13px] border px-3 py-2.5 transition-colors duration-150"
      style={{
        background: onLight ? "var(--hover)" : "rgba(255,255,255,0.14)",
        borderColor: onLight ? "var(--border)" : "rgba(255,255,255,0.28)",
        color: onLight ? "var(--text)" : "#fff",
      }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]" style={{ background: onLight ? "var(--primary-soft)" : "rgba(255,255,255,0.2)", color: onLight ? "var(--primary)" : "#fff" }}>
        <FileIcon size={16} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold">{name}</span>
        <span className="block text-[11px] font-semibold" style={{ color: onLight ? "var(--muted)" : "rgba(255,255,255,0.72)" }}>
          {ext ? `${ext} fayl` : "Fayl"} · yuklab olish
        </span>
      </span>
      <Download size={15} strokeWidth={2} className="shrink-0 opacity-70" />
    </a>
  );
}

/* ===== LIGHTBOX — frosted panel, Esc/overlay yopadi ===== */
export function MediaLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey, true); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8"
      style={{ background: "rgba(24,17,12,.52)", backdropFilter: "blur(10px) saturate(1.1)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Rasm ko'rinishi"
      data-lenis-prevent
    >
      <div
        className="relative max-h-full animate-[rowIn_0.24s_var(--ease)_both] overflow-hidden rounded-[20px] border p-2 shadow-2xl"
        style={{ background: "color-mix(in srgb, var(--surface-solid) 94%, transparent)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Chat rasmi" className="block max-h-[78vh] max-w-[86vw] rounded-[14px] object-contain" />
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            download
            onClick={(e) => e.stopPropagation()}
            title="Yuklab olish"
            aria-label="Rasmni yuklab olish"
            className="flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors duration-150 hover:bg-[var(--hover)]"
            style={{ background: "var(--surface-solid)", borderColor: "var(--border)", color: "var(--text-2)" }}
          >
            <Download size={16} strokeWidth={2} />
          </a>
          <button
            type="button"
            onClick={onClose}
            title="Yopish"
            aria-label="Yopish"
            className="flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors duration-150 hover:bg-[var(--hover)]"
            style={{ background: "var(--surface-solid)", borderColor: "var(--border)", color: "var(--text-2)" }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Bubble ichidagi media — tur bo'yicha tarmoqlanadi */
export default function MessageMedia({
  media,
  seed,
  onLight,
  onOpenImage,
  onReady,
}: {
  media: MediaPayload;
  /** to'lqin shakli uchun barqaror urug' (xabar id'si) */
  seed: number;
  /** bubble foni yorug'mi (mijoz pufagi) — kontrast shunga qarab tanlanadi */
  onLight: boolean;
  onOpenImage: (url: string) => void;
  /** media yuklanib balandlik o'zgarganda — skrollni pastda ushlash uchun */
  onReady?: () => void;
}) {
  switch (media.kind) {
    case "audio":
      return <VoiceBubble url={media.url} seed={seed} onLight={onLight} onReady={onReady} />;
    case "image":
      return <ImageBubble url={media.url} ribbon={media.ribbon} onOpen={onOpenImage} onReady={onReady} />;
    case "video":
      return <VideoBubble url={media.url} onReady={onReady} />;
    case "ig_reel":
      return <ReelBubble url={media.url} />;
    default:
      return <FileBubble url={media.url} onLight={onLight} />;
  }
}
