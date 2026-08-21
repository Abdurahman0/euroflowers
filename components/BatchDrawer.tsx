"use client";
import { useEffect, useState } from "react";
import { Pencil, Plus, ShoppingCart } from "lucide-react";
import clsx from "clsx";
import Drawer from "./Drawer";
import { BatchMovementModal } from "./BatchMovementModal";
import BatchEditModal from "./BatchEditModal";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmt, fmtDate, fmtTime, movementRefLabel } from "@/lib/format";
import { formatStemsAndBunches, roundingHint, isFreeBatch, batchCostLabel } from "@/lib/inventory";
import { batchTitleNoHeight, variantColor } from "@/lib/stockLabel";
import FreeBatchChip from "./FreeBatchChip";
import StockBatchSellModal from "./StockBatchSellModal";
import type { StockBatch, StockMovement } from "@/lib/types";

/**
 * Partiya batafsil (VIEW) modali — barcha amallar shu yerda:
 * meta-ma'lumot + harakatlar tarixi (timeline), "Harakat / Chiqit" (BatchMovementModal),
 * "Tahrirlash" (BatchEditModal — narx/pochka-dona logikasi create bilan bir xil, changed-only
 * PATCH, retroaktiv ogoh) va nofaollashtirish (PATCH is_active=false).
 */

const MOVE_LABEL: Record<string, string> = {
  in: "KIRIM", out: "CHIQIM", adjustment: "TUZATISH", waste: "CHIQIT", transfer_out: "O'TKAZMA →", transfer_in: "→ O'TKAZMA",
};
const MOVE_IN = new Set(["in", "transfer_in", "adjustment"]);

function Meta({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string | null }) {
  return (
    <div className="rounded-[12px] border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">{label}</div>
      <div className="mt-0.5 text-[14px] font-semibold">{value}</div>
      {/* ⚠️ DISPLAY-ONLY: server rounding blokidan aniq hisob (is_rounded=true bo'lganda) */}
      {sub && <div className="mt-0.5 text-[10.5px] font-medium" style={{ color: "var(--mut)" }}>({sub})</div>}
    </div>
  );
}

export default function BatchDrawer({
  batch,
  onClose,
  onChanged,
}: {
  batch: StockBatch;
  onClose: () => void;
  onChanged: (b: StockBatch | null) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const { canControl } = usePerm();
  const control = canControl("inventory");
  const [b, setB] = useState(batch);
  const [moves, setMoves] = useState<StockMovement[] | null>(null);
  const [movesErr, setMovesErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  // amallar — barchasi shu view modal ichida
  const [wasteOpen, setWasteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false); // BatchEditModal (kartadagi bilan bir xil forma)
  const [sellOpen, setSellOpen] = useState(false);

  const v = b.variant_detail;

  const loadMoves = () =>
    api.stockMovements({ batch: batch.id, ordering: "-created_at", page_size: 50 })
      .then(setMoves)
      .catch((e) => setMovesErr(e instanceof Error ? e.message : "Tarixni yuklab bo'lmadi"));

  // tarix HAR DOIM asl partiya id'si bilan so'raladi (batch.id — o'zgarmas prop)
  useEffect(() => { loadMoves(); /* eslint-disable-next-line */ }, [batch.id]);

  // chiqit/harakat modalidan qaytgach — partiya + tarix yangilanadi
  const onMovementDone = (upd: StockBatch) => {
    setB(upd);
    onChanged(upd);
    loadMoves().catch(() => {});
    setWasteOpen(false);
  };

  const deactivate = async () => {
    setSaving(true);
    try {
      await api.deactivateStockBatch(batch.id);
      showToast("✓ Partiya nofaollashtirildi");
      onChanged(null);
      onClose();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Amalga oshmadi");
    } finally {
      setSaving(false);
      setConfirmOff(false);
    }
  };

  const low = b.remaining_stems > 0 && b.remaining_stems <= b.minimum_sale_stems * 2;

  return (
    <Drawer
      onClose={onClose}
      width={560}
      title={batchTitleNoHeight(b)}
      sub={`Partiya №${b.batch_number}`}
      badges={
        <>
          {b.remaining_stems === 0 && <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-bold">TUGADI</span>}
          {low && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: "var(--danger)" }}>KAM QOLDI</span>}
          {!b.is_active && <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-bold">NOFAOL</span>}
          {/* ⚠️ rang FAQAT haqiqiy navda — aks holda bo'sh «pilyulya» qolardi */}
          {variantColor(b) && <span className="rounded-full bg-[color:var(--hover)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--text-2)]">{variantColor(b)}</span>}
          <span className="rounded-full bg-[color:var(--hover)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--text-2)]">{b.height_cm} sm</span>
        </>
      }
    >
      {/* rasm */}
      {(b.image_url || v?.image_url) && (
        <div className="mb-4 h-[160px] overflow-hidden rounded-[14px] border border-[color:var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.image_url || v.image_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {/* AMALLAR — barchasi shu view modal ichida */}
      {control && b.is_active && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => setWasteOpen(true)} className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]" style={{ borderColor: "var(--border-strong)", color: "var(--danger-ink)" }}>
            <Plus size={15} strokeWidth={2} /> Harakat / Chiqit
          </button>
          <button onClick={() => setSellOpen(true)} disabled={b.remaining_stems <= 0} className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition-colors duration-150 hover:bg-[var(--hover)] disabled:opacity-50" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
            <ShoppingCart size={15} strokeWidth={2} /> Sotish
          </button>
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>
            <Pencil size={15} strokeWidth={2} /> Tahrirlash
          </button>
        </div>
      )}

      {(
        <>
          {/* meta */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Meta label="Qoldiq" value={formatStemsAndBunches(b.remaining_stems, b.stems_per_bunch)} />
            <Meta label="Qabul qilingan" value={`${b.received_stems} dona`} />
            <Meta label="Dona narxi" value={fmt(b.sale_price_per_stem)} sub={roundingHint(b.rounding?.sale)} />
            <Meta label="Pochka narxi" value={fmt(b.sale_price_per_bunch)} />
            <Meta label="Tannarx (dona)" value={batchCostLabel(b, fmt(b.cost_per_stem))} sub={isFreeBatch(b) ? null : roundingHint(b.rounding?.cost)} />
            {b.cost_per_bunch && +b.cost_per_bunch > 0 && <Meta label="Tannarx (pochka)" value={fmt(b.cost_per_bunch)} />}
            <Meta label="Sklad qiymati" value={fmt(b.stock_value)} />
            <Meta label="Keldi" value={fmtDate(b.received_at)} />
            {b.delivery_detail && <Meta label="Yuk" value={`${b.delivery_detail.number} · ${fmtDate(b.delivery_detail.received_at)}`} />}
            <Meta label="Minimal sotuv" value={`${b.minimum_sale_stems} dona`} />
          </div>
          {b.notes && (
            <div className="mt-3 rounded-[12px] border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2.5 text-[13px] leading-relaxed text-[color:var(--text-2)]">
              {b.notes}
            </div>
          )}
        </>
      )}

      {/* tarix — timeline */}
      <div className="mt-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: "var(--primary)" }}>Harakatlar tarixi</div>
        {movesErr && <p className="text-[13px] font-semibold text-[color:var(--danger-ink)]">{movesErr}</p>}
        {!movesErr && moves === null && <p className="text-[13px] text-[color:var(--muted)]">Yuklanmoqda…</p>}
        {moves && moves.length === 0 && <p className="text-[13px] text-[color:var(--muted)]">Bu partiyada hali harakat yo&apos;q.</p>}
        {moves && moves.length > 0 && (
          <ol className="relative ml-2 border-l border-[color:var(--border)] pl-4">
            {moves.map((m) => {
              const isIn = MOVE_IN.has(m.movement_type);
              const who = m.performed_by_detail
                ? [m.performed_by_detail.first_name, m.performed_by_detail.last_name].filter(Boolean).join(" ") || m.performed_by_detail.username
                : "Tizim";
              return (
                <li key={m.id} className="relative pb-3.5 last:pb-0">
                  <span className={clsx("absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--surface-solid)]", isIn ? "bg-[var(--success)]" : "bg-[var(--warning)]")} />
                  <div className="text-[13px] font-semibold">
                    {MOVE_LABEL[m.movement_type] ?? m.movement_type} · {m.quantity_stems} dona
                    {m.reason ? <span className="font-normal text-[color:var(--text-2)]"> — {m.reason}</span> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[color:var(--muted)]">
                    <span>{who} · {fmtTime(m.created_at)}</span>
                    {/* ⚠️ ILGARI faqat `florist*` ko'rsatilardi — `catalog_rework` (va boshqa yangi
                        turlar) jurnalda KO'RINMAY qolardi. Endi yorlig'i bor har qanday tur chiqadi. */}
                    {movementRefLabel(m.reference_type) && (
                      <span className="rounded-full px-1.5 py-px text-[10.5px] font-bold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>{movementRefLabel(m.reference_type)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* audit */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-[color:var(--border)] pt-4 text-[12px] text-[color:var(--muted)]">
        <span>Yaratilgan: {fmtTime(b.created_at)}</span>
        <span className="text-right">Yangilangan: {fmtTime(b.updated_at)}</span>
      </div>

      {/* xavfli amal */}
      {control && b.is_active && (
        <div className="mt-4">
          {!confirmOff ? (
            <button onClick={() => setConfirmOff(true)} className="w-full rounded-[12px] border border-[color:var(--border)] py-2.5 text-[13px] font-bold text-[color:var(--danger-ink)] transition-colors duration-200 hover:bg-[color:var(--hover)]">
              Partiyani nofaollashtirish
            </button>
          ) : (
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmOff(false)} className="btn-ghost flex-1">Bekor</button>
              <button onClick={deactivate} disabled={saving} className={clsx("btn-danger flex-1", saving && "btn-loading")}>Tasdiqlash</button>
            </div>
          )}
        </div>
      )}

      {/* chiqit / harakat modali — view modal ichidan ochiladi */}
      {wasteOpen && <BatchMovementModal batch={b} onClose={() => setWasteOpen(false)} onDone={onMovementDone} />}
      {/* TAHRIRLASH — kartadagi bilan AYNAN bir xil forma (BatchEditModal) */}
      {editOpen && <BatchEditModal batch={b} onClose={() => setEditOpen(false)} onSaved={(upd) => { setB(upd); onChanged(upd); setEditOpen(false); }} />}
      {sellOpen && <StockBatchSellModal batch={b} onClose={() => setSellOpen(false)} onDone={(upd) => { setB(upd); onChanged(upd); loadMoves().catch(() => {}); }} />}
    </Drawer>
  );
}
