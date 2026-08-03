"use client";
import { useEffect, useMemo, useState } from "react";
import { Package, Truck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import StemGauge from "./StemGauge";
import { fmtDate } from "@/lib/format";
import { stems, freshness, MOVEMENT_LABEL, DELIVERY, compareBatchNewestFirst, isFreeBatch } from "@/lib/inventory";
import FreeBatchChip from "./FreeBatchChip";
import type { MovementType, StockBatch, StockMovement, Supplier } from "@/lib/types";

/** Yetkazib beruvchi — yaratish/tahrirlash (o'ng drawer). */
export function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: (s: Supplier) => void }) {
  const { showToast } = useStore();
  const [f, setF] = useState({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    notes: supplier?.notes ?? "",
    is_active: supplier?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!f.name.trim()) return showToast("Nomini kiriting");
    setBusy(true);
    try {
      const payload = { name: f.name.trim(), phone: f.phone.trim(), notes: f.notes.trim(), is_active: f.is_active };
      const saved = supplier ? await api.updateSupplier(supplier.id, payload) : await api.createSupplier(payload);
      showToast(supplier ? "✓ Yetkazib beruvchi yangilandi" : "✓ Yetkazib beruvchi qo'shildi");
      onSaved(saved);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={480}>
      <ModalHeader icon={<Truck size={20} strokeWidth={1.75} />} title={supplier ? "Yetkazib beruvchini tahrirlash" : "Yangi yetkazib beruvchi"} sub="Partiyalar shu manbaga bog'lanadi" onClose={onClose} />
      <Section>Ma&apos;lumot</Section>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Nomi" span>
          <input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Masalan: Golland Flora" autoFocus />
        </Field>
        <Field label="Telefon" span>
          <input className="inp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Masalan: +998901234567" inputMode="tel" />
        </Field>
        <Field label="Izoh" span>
          <textarea className="inp min-h-[70px] resize-y" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Masalan: haftada 2 marta yetkazadi" />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: "var(--text-2)" }}>
          <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
          Faol
        </label>
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : supplier ? "Saqlash" : "Qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}

const StatChip = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[13px] border px-3 py-2 text-center" style={{ borderColor: "var(--border)" }}>
    <div className="text-[15px] font-bold tabular-nums">{value}</div>
    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</div>
  </div>
);

/** Yetkazib beruvchi tafsiloti — statistika + 2 tab (Partiyalar / Harakatlar). */
export function SupplierDetail({ supplier, onClose, onEdit, onOpenBatch }: { supplier: Supplier; onClose: () => void; onEdit?: () => void; onOpenBatch?: (b: StockBatch) => void }) {
  const [tab, setTab] = useState<"batches" | "moves">("batches");
  const [batches, setBatches] = useState<StockBatch[] | null>(null);
  const [moves, setMoves] = useState<StockMovement[] | null>(null);

  useEffect(() => {
    // ⚠️ server bir kun ichida beqaror — klientda barqaror «yangi birinchi» (Partiyalar bilan bir qoida)
    api.stockBatches({ supplier: supplier.id, ordering: "-received_at" }).then((bs) => setBatches([...bs].sort(compareBatchNewestFirst))).catch(() => setBatches([]));
    api.stockMovements({ supplier: supplier.id, ordering: "-created_at" }).then(setMoves).catch(() => setMoves([]));
  }, [supplier.id]);

  // §4 YUK bo'yicha guruhlar — tartib partiya tartibidan meros (batches allaqachon saralangan)
  const batchGroups = useMemo(() => {
    const m = new Map<string, { key: string; title: string; rows: StockBatch[]; totalStems: number }>();
    for (const b of batches ?? []) {
      const dd = b.delivery_detail;
      const key = dd ? `d${dd.id}` : "none";
      const title = dd ? DELIVERY.label(dd.number, fmtDate(dd.received_at)) : "Yuksiz partiyalar (eski yozuvlar)";
      const g = m.get(key) ?? { key, title, rows: [], totalStems: 0 };
      g.rows.push(b);
      g.totalStems += b.received_stems || 0;
      m.set(key, g);
    }
    // «Yuksiz» guruh DOIM oxirida; qolganlari birinchi qatorining tartibini saqlaydi (yangi birinchi)
    return Array.from(m.values()).sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : 0));
  }, [batches]);

  return (
    <Modal onClose={onClose} width={560}>
      <div className="flex flex-wrap items-center gap-3 pt-6">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
          <Truck size={24} strokeWidth={1.75} />
        </span>
        <div className="min-w-[140px] flex-1">
          <div className="text-[18px] font-extrabold">{supplier.name}</div>
          <div className="text-[13px]" style={{ color: "var(--text-2)" }}>{supplier.phone || "telefon yo'q"}</div>
        </div>
        {!supplier.is_active && <span className="rounded-full bg-rose px-3 py-1 text-[11px] font-extrabold text-roseink">NOFAOL</span>}
        {onEdit && (
          <button type="button" onClick={onEdit} className="icon-btn border !h-8 !w-8" style={{ borderColor: "var(--border)" }} aria-label="Tahrirlash">
            <Package size={15} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <StatChip label="Partiya" value={`${supplier.batches_count}`} />
        <StatChip label="Jami kelgan" value={stems(supplier.total_received_stems)} />
      </div>
      {supplier.notes && (
        <p className="mt-3.5 rounded-[14px] bg-[color:var(--surface-2)] px-4 py-3 text-[13px] leading-relaxed">{supplier.notes}</p>
      )}

      <div className="mt-4 flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)" }}>
        {(["batches", "moves"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className="flex-1 rounded-full py-1.5 text-[12.5px] font-bold transition-colors duration-150" style={tab === t ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>
            {t === "batches" ? "Partiyalar" : "Harakatlar"}
          </button>
        ))}
      </div>

      {tab === "batches" ? (
        <div className="mt-3 flex flex-col gap-3">
          {batches == null && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
          {batches?.length === 0 && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Partiya yo&apos;q.</p>}
          {/* ⚠️ §4 YUK BO'YICHA GURUHLASH — yuk detali bilan AYNAN bir grammatika
              (sarlavha: yuk raqami · sana · jamilar). Guruhlar ham «yangi birinchi».
              Yuksiz (eski) partiyalar alohida guruhga tushadi — jimgina tushib qolmaydi. */}
          {batchGroups.map((g) => (
            <div key={g.key} className="rounded-[14px] border" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <Truck size={13} strokeWidth={2} style={{ color: "var(--primary)" }} />
                  <span className="truncate text-[12.5px] font-bold">{g.title}</span>
                </span>
                <span className="shrink-0 text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
                  {g.rows.length} partiya · {stems(g.totalStems)}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {g.rows.map((b: StockBatch) => {
                  const fr = freshness(b.received_at);
                  return (
                    <button key={b.id} type="button" onClick={() => onOpenBatch?.(b)} className="rounded-[12px] border p-3 text-left transition-colors duration-150 hover:border-[color:var(--primary)]" style={{ borderColor: "var(--border)" }}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[13px] font-bold">{b.variant_detail?.flower_detail?.name_uz} — {b.variant_detail?.name_uz}</span>
                          {isFreeBatch(b) && <FreeBatchChip />}
                        </span>
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `color-mix(in srgb, ${fr.hue} 15%, transparent)`, color: fr.hue }}>{fr.label}</span>
                      </div>
                      <StemGauge batch={b} compact />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {moves == null && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
          {moves?.length === 0 && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Harakat yo&apos;q.</p>}
          {moves?.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 border-t py-2 text-[13px] first:border-t-0" style={{ borderColor: "var(--line2)" }}>
              <span className="min-w-0 truncate">{MOVEMENT_LABEL[m.movement_type as MovementType] ?? m.movement_type} · {m.batch_detail?.variant_detail?.name_uz ?? `#${m.batch}`}</span>
              <span className="shrink-0 font-semibold tabular-nums">{stems(m.quantity_stems)}</span>
              <span className="shrink-0 text-[12px]" style={{ color: "var(--muted)" }}>{fmtDate(m.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
