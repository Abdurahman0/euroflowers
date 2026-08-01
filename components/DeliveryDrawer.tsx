"use client";
import { useCallback, useEffect, useState } from "react";
import { Archive, Pencil, Plus, Truck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { useStore } from "@/lib/store";
import Modal, { ModalHeader } from "./Modal";
import StockLine, { lineFromStockBatch } from "./StockLine";
import StockBatchModal from "./StockBatchModal";
import DeliveryModal from "./DeliveryModal";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import FlowerLoader from "./FlowerLoader";
import { fmt, fmtDate } from "@/lib/format";
import { DELIVERY, formatStemsAndBunches, roundingHint, deliveryRoundingHint } from "@/lib/inventory";
import type { StockBatch, StockDelivery } from "@/lib/types";

/**
 * YUK ichi — sarlavha (raqam · sana · postavshik · izoh, MATN) + partiyalar (/batches/) +
 * «Gul qo'shish» (yuk BOG'LANGAN batch modal). O'chirish → ichida gul bo'lsa ARXIVLANADI.
 * ⚠️ number takrorlanadi → hech qayerda key/lookup EMAS, DOIM id; sana yonida ko'rsatiladi.
 */
export default function DeliveryDrawer({ delivery, onClose, onChanged }: {
  delivery: StockDelivery;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useStore();
  const [d, setD] = useState<StockDelivery>(delivery);
  const [batches, setBatches] = useState<StockBatch[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(() => {
    api.deliveryBatches(d.id, { ordering: "-created_at" }).then(setBatches).catch(() => setBatches([]));
    api.stockDelivery(d.id).then(setD).catch(() => {}); // jami ko'rsatkichlarni yangilaydi
  }, [d.id]);
  useEffect(() => { load(); }, [load]);

  const hasFlowers = (d.batch_count ?? (batches?.length ?? 0)) > 0;

  const doArchive = async () => {
    setArchiving(true);
    try {
      await api.deleteStockDelivery(d.id); // ichida gul bo'lsa server is_active=false qiladi
      showToast(hasFlowers ? "✓ Yuk arxivlandi" : "✓ Yuk o'chirildi");
      notifyReportDataChanged();
      onChanged();
      onClose();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Bajarib bo'lmadi");
      setArchiving(false);
      setConfirmArchive(false);
    }
  };

  return (
    <>
      <Modal onClose={onClose} width={620}>
        <ModalHeader icon={<Truck size={19} strokeWidth={1.8} />} title={DELIVERY.label(d.number, fmtDate(d.received_at))} sub={d.supplier_detail?.name ?? "postavshiksiz"} onClose={onClose} />

        {/* SARLAVHA — plain text (raqam takrorlanadi, sana bilan) */}
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2 rounded-[14px] border p-3.5" style={{ borderColor: "var(--border)" }}>
          <HeaderCell label="Yuk raqami" value={d.number} />
          <HeaderCell label="Sana" value={fmtDate(d.received_at)} />
          <HeaderCell label={DELIVERY.supplierWord} value={d.supplier_detail?.name ?? "—"} />
          <HeaderCell label="Holat" value={d.is_active ? "Faol" : "Arxivlangan"} />
          {d.note && <div className="col-span-2"><HeaderCell label="Izoh" value={d.note} /></div>}
        </div>

        {/* JAMI (server) — Tannarx: yaxlitlangan, ostida aniq hisob + yaxlitlash farqi (agar bo'lsa) */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Xil gul" value={String(d.batch_count)} />
          <Stat label="Qolgan / kelgan" value={`${d.remaining_stems} / ${d.total_stems}`} />
          <Stat label="Tannarx" value={fmt(d.total_cost)} sub={deliveryRoundingHint(d)} />
        </div>

        {/* PARTIYALAR + qo'shish */}
        <div className="mt-4 mb-2 flex items-center justify-between">
          <h3 className="text-[14px] font-bold">Partiyalar</h3>
          <button onClick={() => setAddOpen(true)} className="btn-primary !flex-none rounded-[11px] px-3 py-1.5 text-[13px]">
            <Plus size={16} strokeWidth={2} /> {DELIVERY.addFlower}
          </button>
        </div>
        {batches === null ? <FlowerLoader /> : batches.length === 0 ? (
          <EmptyState title="Bu yukda hali gul yo'q" sub="«Gul qo'shish» orqali shu yukka birinchi partiyani kiriting." />
        ) : (
          <div className="flex flex-col gap-2">
            {batches.map((b) => {
              // ⚠️ SAQLANGAN partiya — narx server `rounding` blokidan; exact FAQAT ko'rsatish, hisobga kirmaydi
              const costHint = roundingHint(b.rounding?.cost);
              const saleHint = roundingHint(b.rounding?.sale);
              return (
                <div key={b.id} className="rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)", opacity: b.remaining_stems === 0 ? 0.6 : 1 }}>
                  <StockLine data={lineFromStockBatch(b)} right={<span className="text-[13px] font-bold tabular-nums">{formatStemsAndBunches(b.remaining_stems, b.stems_per_bunch)}</span>} />
                  <div className="mt-2 flex flex-col gap-0.5 border-t pt-2 text-[12px]" style={{ borderColor: "var(--line2)" }}>
                    {b.cost_per_bunch && +b.cost_per_bunch > 0 && <PriceRow label="Pochka tannarxi" value={fmt(b.cost_per_bunch)} />}
                    <PriceRow label="Dona tannarxi" value={`${fmt(b.cost_per_stem)}/dona`} hint={costHint} />
                    <PriceRow label="Dona sotuv narxi" value={`${fmt(b.sale_price_per_stem)}/dona`} hint={saleHint} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AMALLAR */}
        <div className="mt-5 flex justify-end gap-2.5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setConfirmArchive(true)} className="flex items-center gap-1.5 rounded-[11px] border px-3 py-1.5 text-[13px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--danger-ink)" }}>
            <Archive size={14} strokeWidth={2} /> {hasFlowers ? "Arxivlash" : "O'chirish"}
          </button>
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 rounded-[11px] border px-3 py-1.5 text-[13px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
            <Pencil size={14} strokeWidth={2} /> Tahrirlash
          </button>
        </div>
      </Modal>

      {addOpen && (
        <StockBatchModal delivery={d} onClose={() => setAddOpen(false)} onSaved={() => { load(); notifyReportDataChanged(); onChanged(); }} />
      )}
      {editOpen && (
        <DeliveryModal delivery={d} onClose={() => setEditOpen(false)} onSaved={(upd) => { setD(upd); setEditOpen(false); onChanged(); }} />
      )}
      {confirmArchive && (
        <ConfirmDialog
          title={hasFlowers ? "Yukni arxivlash" : "Yukni o'chirish"}
          body={hasFlowers
            ? "Bu yuk ichida gul bor — o'chirilmaydi, ARXIVLANADI (is_active=false). Partiyalari va tarixi saqlanib qoladi, faqat ro'yxatda ko'rinmaydi."
            : "Bu yuk bo'sh — butunlay o'chiriladi."}
          note={`${DELIVERY.label(d.number, fmtDate(d.received_at))}${d.supplier_detail?.name ? ` · ${d.supplier_detail.name}` : ""}`}
          confirmLabel={hasFlowers ? "Arxivlash" : "O'chirish"}
          danger
          busy={archiving}
          onConfirm={doArchive}
          onCancel={() => setConfirmArchive(false)}
        />
      )}
    </>
  );
}

const HeaderCell = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <div className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{label}</div>
    <div className="truncate text-[13px] font-bold" title={value}>{value}</div>
  </div>
);
const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string | null }) => (
  <div className="rounded-[12px] border px-3 py-2" style={{ borderColor: "var(--border)" }}>
    <div className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{label}</div>
    <div className="text-[15px] font-extrabold tabular-nums">{value}</div>
    {sub && <div className="mt-0.5 text-[10.5px] leading-tight" style={{ color: "var(--mut)" }}>{sub}</div>}
  </div>
);
/** narx qatori — chapda yorliq, o'ngda yaxlitlangan qiymat + (aniq: … · +…) kulrang izoh (bo'lsa). */
const PriceRow = ({ label, value, hint }: { label: string; value: string; hint?: string | null }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span style={{ color: "var(--muted)" }}>{label}</span>
    <span className="flex items-baseline gap-1.5 tabular-nums">
      <b style={{ color: "var(--text-2)" }}>{value}</b>
      {hint && <span className="text-[10.5px]" style={{ color: "var(--mut)" }}>({hint})</span>}
    </span>
  </div>
);
