"use client";
import { ImagePlus, Link2, X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { humanMB, isImageFile, isUploadForbidden, normalizeImageUrl, prepareImage, uploadErrorText } from "@/lib/imageFile";
import { useStore } from "@/lib/store";

/**
 * Yagona rasm yuklash zonasi (UploadZone) — barcha rasm maydonlari shu
 * komponentdan foydalanadi (gul turlari, navlar, katalog, kirim, postlar):
 *   • bosish → tizim fayl tanlagichi; ustiga tortib tashlash ham ishlaydi
 *   • dragover'da aksent chegara + tint
 *   • HAR QANDAY rasm qabul qilinadi — telefon surati ham (HEIC/HEIF, MIME'siz):
 *     yuklashdan oldin brauzerda kichraytirilib JPEG'ga o'giriladi
 *   • yumshoq atirgul xato matni
 *   • tanlangandan keyin: preview + fayl nomi/hajmi + olib tashlash (X)
 *   • saqlash quvuri: api.upload(file) → {url} → onChange(url)
 *   • ⚠️ ZAXIRA YO'L (`onFile` berilsa): yuklash rad etilsa (masalan OPERATOR
 *     roliga `/api/uploads/` 403 qaytaradi) fayl MAHALLIY saqlanadi va
 *     chaqiruvchiga beriladi — u faylni asosiy so'rov bilan birga yuboradi.
 *     Bunda qizil xato emas, yumshoq izoh ko'rsatiladi.
 *   • URL kiritish faqat ikkilamchi "URL orqali" tugmasi ortida
 */

/** Tanlash chegarasi — kichraytirishdan OLDIN (zamonaviy kamera surati 10-20MB bo'ladi). */
const MAX_MB = 25;
/** Serverga ketadigan yakuniy hajm — kichraytirishdan KEYIN. */
const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export default function ImageInput({ value, onChange, onFile }: {
  value: string;
  onChange: (url: string) => void;
  /** Berilsa — yuklash muvaffaqiyatsiz bo'lganda fayl shu yerga qaytadi
      (chaqiruvchi uni o'z so'rovi bilan multipart qilib yuboradi). */
  onFile?: (file: File | null) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState<{ name: string; size: number } | null>(null);
  const [urlMode, setUrlMode] = useState(false);
  /** ⚠️ QORALAMA ALOHIDA: ilgari har harf `onChange` ga ketardi va birinchi
      belgidayoq `value` to'lib, maydon UNMOUNT bo'lardi — havolani yozib
      bo'lmasdi (ko'rinishda `<img src="h">` qolardi). Endi faqat tasdiqlanganda. */
  const [urlDraft, setUrlDraft] = useState("");
  /** zaxira yo'l: mahalliy ko'rinish (object URL) — server havolasi yo'q */
  const [localUrl, setLocalUrl] = useState("");
  const [deferred, setDeferred] = useState(false);

  const dropLocal = () => {
    setLocalUrl((u) => { if (u) URL.revokeObjectURL(u); return ""; });
    setDeferred(false);
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file || busy) return;
    setErr("");
    if (!isImageFile(file.name, file.type)) {
      setErr("Bu rasm fayli emas — surat yoki PNG/JPEG tanlang.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErr(`Rasm ${MAX_MB}MB dan oshmasin — tanlangani ${humanMB(file.size)}MB.`);
      return;
    }
    setBusy(true);
    dropLocal();
    let ready: File | null = null;
    try {
      // telefon surati (HEIC/katta JPEG) shu yerda kichik JPEG'ga aylanadi
      ready = await prepareImage(file, { maxBytes: UPLOAD_MAX_BYTES });
      const { url } = await api.upload(ready);
      onChange(url);
      onFile?.(null);
      setMeta({ name: ready.name, size: ready.size });
      showToast("✓ Rasm yuklandi");
    } catch (e) {
      // ⚠️ ZAXIRA: yuklash rad etildi, lekin fayl TAYYOR — chaqiruvchi uni
      //    o'z so'rovi bilan birga yuborsa bo'ladi (operator roli uchun aynan shu).
      if (ready && onFile) {
        setLocalUrl(URL.createObjectURL(ready));
        setDeferred(true);
        setMeta({ name: ready.name, size: ready.size });
        onFile(ready);
      } else {
        setErr(uploadErrorText(e));
        // ⚠️ RUXSAT YO'Q (operator roli): katalog/AI-katalog kontrakti faqat
        //    `image_url` HAVOLASINI qabul qiladi — faylni emas. Shu bois yagona
        //    ishlaydigan yo'lni O'ZIMIZ ochamiz, operator uni izlab yurmasin.
        if (isUploadForbidden(e)) setUrlMode(true);
      }
    } finally {
      setBusy(false);
    }
  };

  /** Qo'lda kiritilgan havolani TASDIQLASH — tekshiruvdan o'tsa qiymatga aylanadi. */
  const applyUrl = () => {
    const { url, error } = normalizeImageUrl(urlDraft);
    if (error) { setErr(error); return; }
    setErr("");
    setMeta(null);
    dropLocal();
    onFile?.(null);
    onChange(url);
    setUrlDraft("");
    setUrlMode(false);
  };

  // server havolasi bo'lmasa mahalliy (object URL) ko'rinish ishlatiladi
  const shown = value || localUrl;

  return (
    <div className="flex flex-col gap-2">
      {/* ⚠️ `capture` ATAYLAB YO'Q — u telefonda kamerani TO'G'RIDAN-TO'G'RI ochib,
          galereyani butunlay yashiradi. Usiz iOS/Android o'zi «Suratga olish /
          Galereyadan tanlash» menyusini beradi, ya'ni ikkala yo'l ham ochiq. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {shown ? (
        /* tanlangan rasm: preview + nom/hajm + almashtirish/olib tashlash */
        <div className="flex items-center gap-3 rounded-[14px] border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="h-[72px] w-[104px] shrink-0 overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt="preview" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold" title={meta?.name ?? shown}>{meta?.name ?? shown.split("/").pop()}</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              {busy ? "Yuklanmoqda…" : meta ? `${Math.max(1, Math.round(meta.size / 1024))} KB` : "yuklangan rasm"}
              {deferred && " · saqlashda birga yuboriladi"}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="mt-1 text-[12px] font-semibold disabled:opacity-50" style={{ color: "var(--primary)" }}>
              Almashtirish
            </button>
          </div>
          <button
            type="button"
            onClick={() => { onChange(""); setMeta(null); setErr(""); dropLocal(); onFile?.(null); setUrlDraft(""); setUrlMode(false); }}
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
          <span className="text-[11px] font-normal" style={{ color: "var(--muted)" }}>Telefon surati ham bo'ladi · maks {MAX_MB}MB</span>
        </button>
      )}

      {deferred && (
        <p className="rounded-[10px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
          Rasm shu qurilmada turibdi va <b>saqlash tugmasi bosilganda</b> sotuv bilan birga yuboriladi.
        </p>
      )}

      {err && (
        <p className="rounded-[10px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--danger-soft)", color: "var(--danger-ink)" }} role="alert">
          {err}
        </p>
      )}

      {/* URL orqali — ikkilamchi yo'l; ruxsat yo'q rollarda YAGONA yo'l */}
      {!shown && urlMode && err && (
        <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
          Rasm havolasini qo&apos;ying — masalan Telegram yoki Instagramdagi suratning manzili.
        </p>
      )}
      {!shown && (
        urlMode ? (
          <div className="flex gap-2">
            <input
              className="inp"
              value={urlDraft}
              onChange={(e) => { setUrlDraft(e.target.value); setErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyUrl(); } }}
              placeholder="Masalan: https://rasm.uz/gul.jpg"
              autoFocus
              aria-label="Rasm URL manzili"
            />
            <button
              type="button"
              onClick={applyUrl}
              disabled={!urlDraft.trim()}
              className="shrink-0 rounded-[12px] px-3.5 text-[13px] font-bold text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              Qo&apos;yish
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setUrlMode(true)} className="inline-flex items-center gap-1 self-start text-[12px] font-semibold transition-colors duration-200 hover:text-[color:var(--text-2)]" style={{ color: "var(--muted)" }}>
            <Link2 size={13} strokeWidth={1.75} /> URL orqali kiritish
          </button>
        )
      )}
    </div>
  );
}
