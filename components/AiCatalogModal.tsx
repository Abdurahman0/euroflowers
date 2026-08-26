"use client";
import { useState } from "react";
import { Megaphone, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalHeader, ModalFooter, Field } from "./Modal";
import Select from "./Select";
import ImageInput from "./ImageInput";
import { fmt } from "@/lib/format";
import type { AICatalogInput, AICatalogItem } from "@/lib/types";

/**
 * AI KATALOG YOZUVI — /api/ai-catalog/ (backend 20.08.2026, spec §5, §7).
 *
 * ⚠️ BU CRM KATALOGI EMAS: sklad, florist, tannarx va sotuv hisoblari bilan
 *    BOG'LIQ EMAS. Bu — AI mijozga ko'rsatadigan vitrina yozuvi (spec §8).
 *
 * ⚠️ `image_url` va `instagram_link` serverda `format: uri` — noto'g'ri matn 400
 *    qaytaradi, shuning uchun bu yerda oldindan tekshiriladi.
 * ⚠️ `volume` — ERKIN MATN (server maxLength 120), CRM'dagi small/medium/large
 *    enumi emas: tanlagichdan tashqari qiymat ham saqlanib qolaveradi.
 *
 * ⚠️ Yozuv yo'llari JONLI SINALMAGAN (loyiha qoidasi: faqat GET).
 */
const TYPES = [
  { value: "bouquet", label: "Buket" },
  { value: "basket", label: "Savat" },
  { value: "box", label: "Quti" },
  { value: "other", label: "Boshqa" },
];
const VOLUMES = [
  { value: "", label: "— (ko'rsatilmaydi)" },
  { value: "small", label: "Kichik" },
  { value: "medium", label: "O'rta" },
  { value: "large", label: "Katta" },
];

const isUrl = (v: string) => {
  try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
};

export default function AiCatalogModal({
  item, onClose, onSaved,
}: { item: AICatalogItem | null; onClose: () => void; onSaved: (x: AICatalogItem) => void }) {
  const { showToast } = useStore();
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState(item?.arrangement_type || "bouquet");
  const [qty, setQty] = useState(String(item?.quantity ?? 1));
  const [volume, setVolume] = useState(item?.volume ?? "");
  const [price, setPrice] = useState(item?.price ? String(Math.round(+item.price)) : "");
  const [note, setNote] = useState(item?.note ?? "");
  const [image, setImage] = useState(item?.image_url ?? "");
  const [insta, setInsta] = useState(item?.instagram_link ?? "");
  const [adId, setAdId] = useState(item?.instagram_ad_id ?? "");
  const [adPostId, setAdPostId] = useState(item?.instagram_ad_post_id ?? "");
  const [active, setActive] = useState(item?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const price0 = Math.round(+price || 0);
  const instaTrim = insta.trim();

  const save = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Nomini kiriting";
    if (price0 <= 0) next.price = "Narxini kiriting";
    // ⚠️ server `format: uri` talab qiladi — bo'sh bo'lmagan noto'g'ri havola 400 beradi
    if (instaTrim && !isUrl(instaTrim)) next.instagram_link = "To'liq havola bo'lishi kerak (https://…)";
    setErrs(next);
    if (Object.keys(next).length || busy) return;

    setBusy(true);
    try {
      const payload: AICatalogInput = {
        name: name.trim(),
        arrangement_type: type,
        quantity: Math.max(0, Math.floor(+qty || 0)),
        volume: volume.trim(),
        price: String(price0),
        note: note.trim(),
        image_url: image.trim(),
        instagram_link: instaTrim,
        // ⚠️ HAR DOIM yuboriladi (bo'sh bo'lsa ham): bo'sh satr mappingni TOZALAYDI.
        //    Kalit tushirilsa tahrirlashda eski reklama bog'lanishi qolib ketardi.
        instagram_ad_id: adId.trim(),
        instagram_ad_post_id: adPostId.trim(),
        is_active: active,
      };
      const saved = item ? await api.updateAICatalogItem(item.id, payload) : await api.createAICatalogItem(payload);
      showToast(item ? "✓ AI katalog yangilandi" : "✓ AI katalogga qo'shildi");
      onSaved(saved);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  const Err = ({ k }: { k: string }) =>
    errs[k] ? <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs[k]}</span> : null;

  return (
    <Modal onClose={onClose} width={620}>
      <ModalHeader
        icon={<Sparkles size={19} strokeWidth={1.8} />}
        title={item ? "AI katalogni tahrirlash" : "AI katalogga qo'shish"}
        sub="Mijozga AI orqali ko'rsatiladi — CRM katalogi bilan aralashmaydi"
        onClose={onClose}
      />

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nomi" span>
          <input className="inp" value={name} onChange={(e) => { setName(e.target.value.slice(0, 180)); setErrs((x) => ({ ...x, name: "" })); }}
            placeholder="Masalan: Gortenziya Mix savat" autoFocus />
          <Err k="name" />
        </Field>

        <Field label="Turi">
          <Select value={type} onChange={(v) => setType(String(v))} options={TYPES} />
        </Field>
        <Field label="Soni">
          <input className="inp" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1" />
        </Field>

        <Field label="Hajmi">
          <Select value={volume} onChange={(v) => setVolume(String(v))} options={VOLUMES} />
        </Field>
        <Field label="Narxi (so'm)">
          <input className="inp" inputMode="numeric" value={price}
            onChange={(e) => { setPrice(e.target.value.replace(/\D/g, "")); setErrs((x) => ({ ...x, price: "" })); }}
            placeholder="Masalan: 1200000" />
          {price0 > 0 && <span className="mt-0.5 block text-[11.5px] font-semibold" style={{ color: "var(--acc)" }}>{fmt(price0)}</span>}
          <Err k="price" />
        </Field>

        <Field label="Izoh (mijozga ko'rinadi)" span>
          <textarea className="inp min-h-[80px] resize-y leading-relaxed" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Masalan: 25 ta atirgul, sovg'a qutisi bilan" />
        </Field>

        <Field label="Rasm" span>
          <ImageInput value={image} onChange={setImage} />
        </Field>

        <Field label="Instagram havolasi" span>
          <input className="inp" value={insta} onChange={(e) => { setInsta(e.target.value); setErrs((x) => ({ ...x, instagram_link: "" })); }}
            placeholder="https://instagram.com/p/…" />
          <Err k="instagram_link" />
        </Field>
      </div>

      {/* ⚠️ META ADS MAPPING — reklama orqali kelgan mijozga AI aynan shu reklamadagi
          gullarni ko'rsatadi. Ikkalasi ham IXTIYORIY: oddiy yozuvda bo'sh qoladi. */}
      <div className="mt-3 rounded-[14px] border p-3" style={{ borderColor: adId.trim() || adPostId.trim() ? "var(--primary)" : "var(--border)", background: "var(--surface-2)" }}>
        <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>
          <Megaphone size={13} strokeWidth={2.2} style={{ color: "var(--primary)" }} /> Meta Ads mapping
          <span className="font-semibold" style={{ color: "var(--muted)" }}>· ixtiyoriy</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Instagram Ad ID">
            <input className="inp" inputMode="numeric" value={adId} onChange={(e) => setAdId(e.target.value.slice(0, 120))} placeholder="Masalan: 120240146122130452" />
          </Field>
          <Field label="Instagram Ad Post ID">
            <input className="inp" inputMode="numeric" value={adPostId} onChange={(e) => setAdPostId(e.target.value.slice(0, 120))} placeholder="Masalan: 938672392402515" />
          </Field>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: "var(--muted)" }}>
          Target yoqilganda Meta Ads Manager yoki reklama tafsilotlaridan olingan IDlarni kiriting.
          Bitta reklamada bir nechta gul bo&apos;lsa, bir xil Ad ID va Post ID bir nechta AI katalog mahsulotiga qo&apos;yilishi mumkin.
          {item && (adId.trim() || adPostId.trim()) ? " Bo'shatib saqlasangiz bog'lanish uziladi." : ""}
        </p>
      </div>

      {/* ⚠️ FAOL — AI mijozga FAQAT shu belgilangan yozuvlarni ko'rsatadi */}
      <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border px-3.5 py-3"
        style={{ borderColor: active ? "var(--primary)" : "var(--border)", background: active ? "var(--primary-soft)" : undefined }}>
        <span className="min-w-0">
          <span className="block text-[13px] font-bold">AI ko&apos;rsatadi</span>
          <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>
            O&apos;chirilsa yozuv saqlanadi, lekin mijozga taklif qilinmaydi
          </span>
        </span>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
      </label>

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className={`btn-primary disabled:opacity-60 ${busy ? "btn-loading" : ""}`}>
          {item ? "Saqlash" : "Qo'shish"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
