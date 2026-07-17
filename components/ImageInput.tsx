"use client";
import { ImagePlus, Link2, X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

/**
 * Yagona rasm yuklash zonasi (UploadZone) — barcha rasm maydonlari shu
 * komponentdan foydalanadi (gul turlari, navlar, katalog, kirim, postlar):
 *   • bosish → tizim fayl tanlagichi; ustiga tortib tashlash ham ishlaydi
 *   • dragover'da aksent chegara + tint
 *   • tur (PNG/JPEG/WebP) va hajm (≤5MB) tekshiruvi, yumshoq atirgul xato
 *   • tanlangandan keyin: preview + fayl nomi/hajmi + olib tashlash (X)
 *   • saqlash quvuri O'ZGARMAGAN: api.upload(file) → {url} → onChange(url)
 *   • URL kiritish faqat ikkilamchi "URL orqali" tugmasi ortida
 */

const MAX_MB = 5;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function ImageInput({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const showToast = useStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState<{ name: string; size: number } | null>(null);
  const [urlMode, setUrlMode] = useState(false);

  const handleFile = async (file: File | null | undefined) => {
    if (!file || busy) return;
    setErr("");
    if (!TYPES.includes(file.type)) {
      setErr("Faqat PNG, JPEG yoki WebP rasm yuklash mumkin.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErr(`Rasm ${MAX_MB}MB dan oshmasin — tanlangani ${(file.size / 1048576).toFixed(1)}MB.`);
      return;
    }
    setBusy(true);
    try {
      const { url } = await api.upload(file);
      onChange(url);
      setMeta({ name: file.name, size: file.size });
      showToast("✓ Rasm yuklandi");
    } catch {
      setErr("Rasm yuklab bo'lmadi — qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {value ? (
        /* tanlangan rasm: preview + nom/hajm + almashtirish/olib tashlash */
        <div className="flex items-center gap-3 rounded-[14px] border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="h-[72px] w-[104px] shrink-0 overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="preview" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold" title={meta?.name ?? value}>{meta?.name ?? value.split("/").pop()}</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              {busy ? "Yuklanmoqda…" : meta ? `${Math.max(1, Math.round(meta.size / 1024))} KB` : "yuklangan rasm"}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="mt-1 text-[12px] font-semibold disabled:opacity-50" style={{ color: "var(--primary)" }}>
              Almashtirish
            </button>
          </div>
          <button
            type="button"
            onClick={() => { onChange(""); setMeta(null); setErr(""); }}
            className="icon-btn icon-btn-danger"
            title="Olib tashlash"
            aria-label="Rasmni olib tashlash"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        /* bo'sh holat: dropzone */
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed px-4 py-6 text-[13px] font-medium transition-colors duration-200 disabled:opacity-60"
          style={{
            borderColor: over ? "var(--primary)" : "var(--border-strong)",
            background: over ? "var(--primary-soft)" : "var(--surface-2)",
            color: "var(--text-2)",
          }}
        >
          <ImagePlus size={22} strokeWidth={1.75} style={{ color: over ? "var(--primary)" : "var(--muted)" }} />
          {busy ? "Yuklanmoqda…" : "Rasm tanlang yoki shu yerga tashlang"}
          <span className="text-[11px] font-normal" style={{ color: "var(--muted)" }}>PNG · JPEG · WebP, maks {MAX_MB}MB</span>
        </button>
      )}

      {err && (
        <p className="rounded-[10px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--danger-soft)", color: "var(--danger-ink)" }} role="alert">
          {err}
        </p>
      )}

      {/* URL orqali — ikkilamchi yo'l (masalan, tashqi CDN havolasi) */}
      {!value && (
        urlMode ? (
          <input
            className="inp"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
            autoFocus
            aria-label="Rasm URL manzili"
          />
        ) : (
          <button type="button" onClick={() => setUrlMode(true)} className="inline-flex items-center gap-1 self-start text-[12px] font-semibold transition-colors duration-200 hover:text-[color:var(--text-2)]" style={{ color: "var(--muted)" }}>
            <Link2 size={13} strokeWidth={1.75} /> URL orqali kiritish
          </button>
        )
      )}
    </div>
  );
}
