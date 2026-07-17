"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import Drawer from "./Drawer";
import Select from "./Select";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmt, fmtDate, fmtTime } from "@/lib/format";
import type { MovementType, StockBatch, StockMovement } from "@/lib/types";

/**
 * Partiya batafsil ko'rinishi — premium drawer:
 * meta-ma'lumot, harakatlar tarixи (timeline), tezkor amal (kirim/chiqim/
 * chiqit) va nofaollashtirish (kontrakt: PATCH is_active=false).
 */

const MOVE_LABEL: Record<string, string> = {
  in: "KIRIM", out: "CHIQIM", adjustment: "TUZATISH", waste: "CHIQIT", transfer_out: "O'TKAZMA →", transfer_in: "→ O'TKAZMA",
};
const MOVE_IN = new Set(["in", "transfer_in", "adjustment"]);

const MOVE_OPTIONS: { value: MovementType; label: string }[] = [
  { value: "in", label: "Kirim (+)" },
  { value: "out", label: "Chiqim (−)" },
  { value: "waste", label: "Chiqit" },
  { value: "adjustment", label: "Tuzatish" },
];

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">{label}</div>
      <div className="mt-0.5 text-[14px] font-semibold">{value}</div>
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
  const [mvType, setMvType] = useState<MovementType>("out");
  const [mvQty, setMvQty] = useState("");
  const [mvReason, setMvReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const v = b.variant_detail;

  useEffect(() => {
    api.stockMovements({ batch: b.id, ordering: "-created_at", page_size: 50 })
      .then(setMoves)
      .catch((e) => setMovesErr(e instanceof Error ? e.message : "Tarixni yuklab bo'lmadi"));
  }, [b.id]);

  const addMovement = async () => {
    const qty = +mvQty;
    if (!qty || qty <= 0) return showToast("Miqdorni kiriting");
    setSaving(true);
    try {
      const upd = await api.batchMovement(b.id, { movement_type: mvType, quantity_stems: qty, reason: mvReason.trim() });
      setB(upd);
      onChanged(upd);
      setMvQty("");
      setMvReason("");
      const fresh = await api.stockMovements({ batch: b.id, ordering: "-created_at", page_size: 50 });
      setMoves(fresh);
      showToast("✓ Harakat qayd etildi");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Qayd etib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setSaving(true);
    try {
      await api.deactivateStockBatch(b.id);
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
      title={`${v?.flower_detail?.name_uz ?? ""} — ${v?.name_uz ?? ""}`}
      sub={`Partiya №${b.batch_number} · ${b.branch_detail?.name}`}
      badges={
        <>
          {b.remaining_stems === 0 && <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-bold">TUGADI</span>}
          {low && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: "var(--danger)" }}>KAM QOLDI</span>}
          {!b.is_active && <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-bold">NOFAOL</span>}
          <span className="rounded-full bg-[color:var(--hover)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--text-2)]">{v?.color_uz}</span>
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

      {/* meta */}
      <div className="grid grid-cols-2 gap-2.5">
        <Meta label="Qoldiq" value={`${b.remaining_stems} dona · ${b.remaining_bunches} pochka`} />
        <Meta label="Qabul qilingan" value={`${b.received_stems} dona`} />
        <Meta label="Dona narxi" value={fmt(b.sale_price_per_stem)} />
        <Meta label="Pochka narxi" value={fmt(b.sale_price_per_bunch)} />
        <Meta label="Tannarx (dona)" value={fmt(b.cost_per_stem)} />
        <Meta label="Sklad qiymati" value={fmt(b.stock_value)} />
        <Meta label="Keldi" value={fmtDate(b.received_at)} />
        <Meta label="Minimal sotuv" value={`${b.minimum_sale_stems} dona`} />
      </div>

      {b.notes && (
        <div className="mt-3 rounded-[12px] border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2.5 text-[13px] leading-relaxed text-[color:var(--text-2)]">
          {b.notes}
        </div>
      )}

      {/* tezkor amal */}
      {control && b.is_active && (
        <div className="mt-5">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[2px]" style={{ color: "var(--accL)" }}>Tezkor harakat</div>
          <div className="grid grid-cols-[1.2fr_1fr] gap-2.5">
            <Select value={mvType} options={MOVE_OPTIONS} onChange={(x) => setMvType(String(x) as MovementType)} />
            <input className="inp" inputMode="numeric" value={mvQty} onChange={(e) => setMvQty(e.target.value.replace(/\D/g, ""))} placeholder="Dona" aria-label="Miqdor (dona)" />
          </div>
          <div className="mt-2.5 flex gap-2.5">
            <input className="inp flex-1" value={mvReason} onChange={(e) => setMvReason(e.target.value)} placeholder="Sabab (ixtiyoriy)" onKeyDown={(e) => e.key === "Enter" && addMovement()} />
            <button onClick={addMovement} disabled={saving} className={clsx("btn-primary !flex-none px-5", saving && "btn-loading")}>Qayd etish</button>
          </div>
        </div>
      )}

      {/* tarix — timeline */}
      <div className="mt-5">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[2px]" style={{ color: "var(--accL)" }}>Harakatlar tarixi</div>
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
                  <span className={clsx("absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[rgba(26,21,17,1)]", isIn ? "bg-[var(--success)]" : "bg-[var(--warning)]")} />
                  <div className="text-[13px] font-semibold">
                    {MOVE_LABEL[m.movement_type] ?? m.movement_type} · {m.quantity_stems} dona
                    {m.reason ? <span className="font-normal text-[color:var(--text-2)]"> — {m.reason}</span> : null}
                  </div>
                  <div className="text-[12px] text-[color:var(--muted)]">{who} · {fmtTime(m.created_at)}</div>
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
    </Drawer>
  );
}
