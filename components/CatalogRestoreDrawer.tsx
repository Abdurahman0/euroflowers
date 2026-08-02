"use client";
import { useEffect, useMemo, useState } from "react";
import { Recycle, ArrowRight, Trash2, PackageOpen, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Drawer, { useDrawerClose } from "./Drawer";
import Select from "./Select";
import { fmt } from "@/lib/format";
import type { CatalogItem, FloristProfile, StockBatch, FlowerVariant } from "@/lib/types";

const Lbl = ({ children }: { children: React.ReactNode }) => <div className="mb-1 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{children}</div>;
const variantLabel = (v?: FlowerVariant | null) => v ? `${v.flower_detail?.name_uz ?? "Gul"} ${v.name_uz ?? ""}${v.color_uz ? ` · ${v.color_uz}` : ""}`.trim() : "Gul";
const floristName = (fp: FloristProfile) => { const u = fp.user_detail; return [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.username || `#${fp.id}`; };

/**
 * RESTAVRATSIYA — katalog tarkibidagi bir gulni (eski, so'lgan) yangi gul bilan almashtirish.
 * POST /api/catalog/{id}/restore-flowers/  { florist, old_batch, new_batch, quantity_stems, reason }
 * 3 ta oqibat submitdan OLDIN aniq ko'rsatiladi. Muvaffaqiyatdan keyin: item, tarkib, partiyalar VA balanslar yangilanadi.
 */
export default function CatalogRestoreDrawer({ item, onClose, onDone }: { item: CatalogItem; onClose: () => void; onDone: (updated: CatalogItem) => void }) {
  const { showToast } = useStore();
  const closeAnim = useDrawerClose() ?? onClose;
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [florist, setFlorist] = useState(0);
  const [oldBatch, setOldBatch] = useState(0);
  const [newBatch, setNewBatch] = useState(0);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.florists({ is_active: true, ordering: "user" }).then(setFlorists).catch(() => {});
    api.stockBatches({ is_active: true }).then((bs) => setBatches(bs.filter((b) => (b.remaining_stems ?? 0) > 0))).catch(() => {});
  }, []);

  // ESKI gul — item tarkibidan (batch_detail bo'yicha), o'z hissasi (quantity_stems) bilan
  const oldOpts = useMemo(() => (item.composition ?? []).filter((c) => c.batch_detail?.id).map((c) => ({
    value: String(c.batch_detail!.id), label: `${variantLabel(c.batch_detail!.variant_detail)} — ${c.quantity_stems} dona`,
  })), [item.composition]);
  const oldComp = (item.composition ?? []).find((c) => c.batch_detail?.id === oldBatch);
  const oldMax = oldComp?.quantity_stems ?? 0;

  // YANGI gul — skladdagi qoldiqli partiyalar (tugaganlari yo'q)
  const newOpts = useMemo(() => batches.map((b) => ({
    value: String(b.id), label: `${variantLabel(b.variant_detail)} · №${b.batch_number} · ${b.remaining_stems} dona`,
  })), [batches]);
  const newBatchObj = batches.find((b) => b.id === newBatch);
  const newMax = newBatchObj?.remaining_stems ?? 0;

  const n = Math.round(+qty || 0);
  const overOld = oldBatch > 0 && n > oldMax;
  const overNew = newBatch > 0 && n > newMax;
  const ready = florist > 0 && oldBatch > 0 && newBatch > 0 && n > 0 && !overOld && !overNew;

  const submit = async () => {
    if (!ready) return;
    setBusy(true); setErr(null);
    try {
      const updated = await api.restoreCatalogFlowers(item.id, { florist, old_batch: oldBatch, new_batch: newBatch, quantity_stems: n, reason: reason.trim() || undefined });
      showToast("✓ Restavratsiya bajarildi");
      onDone(updated);
    } catch (e) {
      const d = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : null;
      setErr(d || (e instanceof ApiError ? e.message : "Restavratsiya bajarilmadi"));
      showToast(e instanceof ApiError ? e.message : "Bajarib bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Drawer onClose={onClose} width={480} title="Restavratsiya" sub={item.name_uz || item.name_ru}>
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-1.5 rounded-[12px] px-3.5 py-2.5 text-[12.5px] leading-snug" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
          <Recycle size={15} className="mt-px shrink-0" style={{ color: "var(--primary)" }} />
          So&apos;lgan gulni yangisiga almashtiring. Eski gul chiqitga, yangi gul skladdan floristga o&apos;tadi.
        </p>

        <div><Lbl>Florist</Lbl><Select value={florist ? String(florist) : ""} onChange={(v) => setFlorist(+v)} options={[{ value: "", label: "Floristni tanlang" }, ...florists.map((f) => ({ value: String(f.id), label: floristName(f) }))]} /></div>

        <div>
          <Lbl>Eski gul (chiqitga)</Lbl>
          <Select value={oldBatch ? String(oldBatch) : ""} onChange={(v) => { setOldBatch(+v); setErr(null); }} options={[{ value: "", label: oldOpts.length ? "Tarkibdan tanlang" : "Tarkib bo'sh" }, ...oldOpts]} />
        </div>

        <div className="flex items-center justify-center py-0.5"><ArrowRight size={18} style={{ color: "var(--muted)" }} /></div>

        <div>
          <Lbl>Yangi gul (skladdan)</Lbl>
          <Select value={newBatch ? String(newBatch) : ""} onChange={(v) => { setNewBatch(+v); setErr(null); }} options={[{ value: "", label: newOpts.length ? "Skladdan tanlang" : "Qoldiqli partiya yo'q" }, ...newOpts]} />
        </div>

        <div>
          <Lbl>Nechta dona</Lbl>
          <input className="inp" type="number" value={qty} onChange={(e) => { setQty(e.target.value); setErr(null); }} placeholder="Masalan: 5" />
          <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
            {oldBatch > 0 && <span style={{ color: overOld ? "var(--danger-ink)" : undefined }}>Eski hissa: {oldMax} dona{overOld ? " — oshib ketdi" : ""}</span>}
            {newBatch > 0 && <span style={{ color: overNew ? "var(--danger-ink)" : undefined }}>Sklad qoldig&apos;i: {newMax} dona{overNew ? " — yetmaydi" : ""}</span>}
          </div>
        </div>

        <div><Lbl>Sabab (ixtiyoriy)</Lbl><input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: Gul so'lgan" /></div>

        {/* 3 OQIBAT — submitdan OLDIN aniq */}
        {ready && (
          <ol className="flex flex-col gap-2 rounded-[14px] border p-3.5 text-[12.5px]" style={{ borderColor: "var(--primary)", background: "var(--primary-soft)" }}>
            <li className="flex items-start gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "var(--danger-ink)" }}>1</span><span><Trash2 size={12} className="mr-1 inline" />Eski gul <b>{n} dona</b> chiqitga yoziladi</span></li>
            <li className="flex items-start gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "var(--primary)" }}>2</span><span><PackageOpen size={12} className="mr-1 inline" />Yangi gul <b>{n} dona</b> floristga chiqariladi (sklad {newMax} → {newMax - n})</span></li>
            <li className="flex items-start gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "var(--acc)" }}>3</span><span><RefreshCw size={12} className="mr-1 inline" />Katalog tarkibi yangilanadi (eski → yangi gul)</span></li>
          </ol>
        )}

        {err && <p className="whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

        <div className="mt-1 flex justify-end gap-2.5 max-sm:[&>*]:flex-1">
          <button onClick={() => closeAnim()} className="btn-ghost">Bekor</button>
          <button onClick={submit} disabled={!ready || busy} className="btn-primary disabled:opacity-60">{busy ? "Bajarilmoqda…" : "Restavratsiya qilish"}</button>
        </div>
      </div>
    </Drawer>
  );
}
