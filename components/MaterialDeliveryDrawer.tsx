"use client";
import { useCallback, useEffect, useState } from "react";
import { PackageOpen, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/api";
import Modal, { ModalHeader } from "./Modal";
import MaterialReceiveModal from "./MaterialReceiveModal";
import MaterialDeliveryModal from "./MaterialDeliveryModal";
import EmptyState from "./EmptyState";
import FlowerLoader from "./FlowerLoader";
import { fmt, fmtDate, fmtTime } from "@/lib/format";
import { MATERIAL_DELIVERY } from "@/lib/inventory";
import type { MaterialDelivery, MaterialMovement } from "@/lib/types";

/**
 * MATERIAL YUKI ichi — sarlavha (raqam·sana·postavshik·izoh, MATN) + kiritilgan materiallar
 * (/items/ = receive harakatlari, unit_cost bilan) + «Material kiritish» tugmasi.
 * ⚠️ number takrorlanadi → key/lookup DOIM id; sana raqam yonida. O'CHIRISH YO'Q (spec bermaydi).
 */
export default function MaterialDeliveryDrawer({ delivery, onClose, onChanged }: {
  delivery: MaterialDelivery;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [d, setD] = useState<MaterialDelivery>(delivery);
  const [items, setItems] = useState<MaterialMovement[] | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(() => {
    api.materialDeliveryItems(d.id, { ordering: "-created_at" }).then(setItems).catch(() => setItems([]));
    api.materialDelivery(d.id).then(setD).catch(() => {}); // jamilarni yangilaydi
  }, [d.id]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <Modal onClose={onClose} width={620}>
        <ModalHeader icon={<PackageOpen size={19} strokeWidth={1.8} />} title={MATERIAL_DELIVERY.label(d.number, fmtDate(d.received_at))} sub={d.supplier_detail?.name ?? "postavshiksiz"} onClose={onClose} />

        {/* SARLAVHA — plain text */}
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2 rounded-[14px] border p-3.5" style={{ borderColor: "var(--border)" }}>
          <HeaderCell label="Yuk raqami" value={d.number} />
          <HeaderCell label="Sana" value={fmtDate(d.received_at)} />
          <HeaderCell label={MATERIAL_DELIVERY.supplierWord} value={d.supplier_detail?.name ?? "—"} />
          <HeaderCell label="Holat" value={d.is_active ? "Faol" : "Arxivlangan"} />
          {d.note && <div className="col-span-2"><HeaderCell label="Izoh" value={d.note} /></div>}
        </div>

        {/* JAMI (server) */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Xil material" value={String(d.item_count)} />
          <Stat label="Jami dona" value={String(d.total_quantity)} />
          <Stat label="Tannarx" value={fmt(d.total_cost)} />
        </div>

        {/* MATERIALLAR + kiritish */}
        <div className="mt-4 mb-2 flex items-center justify-between">
          <h3 className="text-[14px] font-bold">Kiritilgan materiallar</h3>
          <button onClick={() => setReceiveOpen(true)} className="btn-primary !flex-none rounded-[11px] px-3 py-1.5 text-[13px]">
            <Plus size={16} strokeWidth={2} /> {MATERIAL_DELIVERY.receive}
          </button>
        </div>
        {items === null ? <FlowerLoader /> : items.length === 0 ? (
          <EmptyState title="Bu yukka hali material kiritilmagan" sub="«Material kiritish» orqali shu yukka birinchi materialni kiriting." />
        ) : (
          <div className="flex flex-col gap-2">
            {/* key = id (movement) */}
            {items.map((it) => {
              const md = it.packaging_detail ?? it.material_detail;
              return (
                <div key={it.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold">{md?.name_uz || md?.name_ru || `Material #${it.packaging ?? "—"}`}</div>
                    <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{fmtTime(it.created_at)}{it.reason ? ` · ${it.reason}` : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-bold tabular-nums">{it.quantity} dona</div>
                    {/* eski receive'da unit_cost bo'lmaydi — bo'shni ko'rsatmaymiz (null/tozalik) */}
                    {it.unit_cost != null && +it.unit_cost > 0 && <div className="text-[11px]" style={{ color: "var(--muted)" }}>{fmt(it.unit_cost)}/dona</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AMALLAR — faqat TAHRIRLASH (o'chirish yo'q, spec bermaydi) */}
        <div className="mt-5 flex justify-end border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 rounded-[11px] border px-3 py-1.5 text-[13px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
            <Pencil size={14} strokeWidth={2} /> Tahrirlash
          </button>
        </div>
      </Modal>

      {receiveOpen && (
        <MaterialReceiveModal delivery={d} onClose={() => setReceiveOpen(false)} onReceived={() => { load(); onChanged(); }} />
      )}
      {editOpen && (
        <MaterialDeliveryModal delivery={d} onClose={() => setEditOpen(false)} onSaved={(upd) => { setD(upd); setEditOpen(false); onChanged(); }} />
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
const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[12px] border px-3 py-2" style={{ borderColor: "var(--border)" }}>
    <div className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{label}</div>
    <div className="text-[15px] font-extrabold tabular-nums">{value}</div>
  </div>
);
