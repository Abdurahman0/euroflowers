"use client";
import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import Popover from "./Popover";
import StockLine, { lineFromBatchDetail } from "./StockLine";
import { computeIssueEditDelta, formatStemsAndBunches } from "@/lib/inventory";
import type { FloristStockIssue } from "@/lib/types";

/**
 * FLORISTGA CHIQARILGAN yozuvining QATOR MENYUSI — ✏️ Tuzatish · 🗑 Bekor qilish.
 * ⚠️ Chiqim/qaytarish/chiqit — hammasi endi TAHRIRLANADI va BEKOR QILINADI (gul ishlatilmagan bo'lsa).
 * Tuzatishda faqat SON va IZOH o'zgaradi (florist/partiya emas — ular o'zgarsa boshqa chiqim bo'ladi).
 * Bekor qilish DESTRUKTIV va QAYTMAS: yozuv o'chadi, ikki balans asl holiga qaytadi.
 * Menyu Popover (CloseAdjustMenu bilan bir xil pattern) — inventory MANAGE huquqi bilan.
 */
const KIND_NOUN: Record<FloristStockIssue["kind"], string> = { issue: "chiqim", return: "qaytarish", waste: "chiqit" };

export default function FloristIssueRowMenu({ issue, onDone }: { issue: FloristStockIssue; onDone: () => void }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [cancel, setCancel] = useState(false);
  return (
    <>
      <button ref={anchor} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Amallar"
        className="icon-btn !h-8 !w-8 shrink-0" style={{ color: "var(--text-2)" }}>
        <MoreVertical size={16} strokeWidth={2} />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} width={200}>
        <div className="flex flex-col gap-1 p-1.5">
          <button onClick={() => { setOpen(false); setEdit(true); }} className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ color: "var(--text-2)" }}>
            <Pencil size={14} strokeWidth={2.2} /> Tuzatish
          </button>
          <button onClick={() => { setOpen(false); setCancel(true); }} className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ color: "var(--danger-ink)" }}>
            <Trash2 size={14} strokeWidth={2.2} /> Bekor qilish
          </button>
        </div>
      </Popover>
      {edit && <EditModal issue={issue} onClose={() => setEdit(false)} onDone={onDone} />}
      {cancel && <CancelConfirm issue={issue} onClose={() => setCancel(false)} onDone={onDone} />}
    </>
  );
}

/** TAHRIR — son + izoh. Florist/partiya IMMUTABLE (izoh bilan tushuntiriladi).
    «Skladda: 300 → 280 · Floristda: 30 → 50» delta preview (issue formasi kabi). */
function EditModal({ issue, onClose, onDone }: { issue: FloristStockIssue; onClose: () => void; onDone: () => void }) {
  const { showToast } = useStore();
  const spb = issue.batch_detail?.stems_per_bunch || 1;
  const [qty, setQty] = useState(String(issue.quantity_stems));
  const [reason, setReason] = useState(issue.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // HOZIRGI qoldiqlar — delta preview uchun (sklad partiyasi + florist balansi)
  const [skladNow, setSkladNow] = useState<number | null>(null);
  const [floristNow, setFloristNow] = useState<number | null>(null);
  useEffect(() => {
    api.stockBatches({ is_active: true }).then((bs) => { const b = bs.find((x) => x.id === issue.batch); if (b) setSkladNow(b.remaining_stems); }).catch(() => {});
    api.floristStockBalances({ florist: issue.florist, only_available: "false" }).then((bl) => { const r = bl.find((x) => x.batch === issue.batch); setFloristNow(r?.remaining_stems ?? 0); }).catch(() => {});
  }, [issue.batch, issue.florist]);

  const newQty = Math.round(parseFloat(qty) || 0);
  const delta = computeIssueEditDelta(issue.kind, issue.quantity_stems, newQty, skladNow, floristNow);
  const changed = newQty !== issue.quantity_stems || reason.trim() !== (issue.reason ?? "");

  const submit = async () => {
    if (newQty <= 0) return showToast("Soni 0 dan katta bo'lishi kerak");
    setBusy(true); setErr(null);
    try {
      // faqat O'ZGARGAN maydonlar yuboriladi (PATCH); ikkalasi ham o'zgarmasa — shunchaki yopiladi
      await api.floristStockIssueEdit(issue.id, {
        ...(newQty !== issue.quantity_stems ? { quantity_stems: newQty } : {}),
        ...(reason.trim() !== (issue.reason ?? "") ? { reason: reason.trim() } : {}),
      });
      showToast("✓ Tuzatildi");
      onDone();
      onClose();
    } catch (e) {
      const detail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : null;
      setErr(detail || (e instanceof ApiError ? e.message : "Tuzatib bo'lmadi"));
      setBusy(false);
    }
  };

  const Delta = ({ label, d }: { label: string; d: { from: number; to: number } | null }) =>
    d ? <span>{label}: {d.from.toLocaleString("ru")} → <b style={{ color: d.to < 0 ? "var(--danger-ink)" : "var(--primary)" }}>{d.to.toLocaleString("ru")}</b></span> : null;

  return (
    <Modal onClose={onClose} width={460}>
      <ModalHeader icon={<Pencil size={18} strokeWidth={1.9} />} title={`${KIND_NOUN[issue.kind][0].toUpperCase()}${KIND_NOUN[issue.kind].slice(1)}ni tuzatish`} sub={issue.florist_name} onClose={onClose} />

      {/* gul/partiya — O'ZGARMAYDI, faqat ko'rsatiladi */}
      <div className="mt-1 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
        <StockLine data={lineFromBatchDetail(issue.batch_detail)} right={<span className="text-[12px] font-bold" style={{ color: "var(--text-2)" }}>hozir {formatStemsAndBunches(issue.quantity_stems, spb)}</span>} />
      </div>
      <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>Florist va gul o&apos;zgartirilmaydi — boshqa florist/gul kerak bo&apos;lsa, bu yozuvni bekor qilib yangisini kiriting.</p>

      <Field label="Yangi son (dona)" span>
        <input className="inp" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
      </Field>
      <Field label="Izoh" span>
        <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: Tuzatildi" />
      </Field>

      {/* DELTA PREVIEW — «Skladda: 300 → 280 · Floristda: 30 → 50» */}
      {changed && newQty > 0 && (delta.sklad || delta.florist) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-[12px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
          <Delta label="Skladda" d={delta.sklad} />
          <Delta label="Floristda" d={delta.florist} />
        </div>
      )}

      {err && <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={submit} disabled={busy || !changed || newQty <= 0} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
      </ModalFooter>
    </Modal>
  );
}

/** BEKOR QILISH — DESTRUKTIV, QAYTMAS. Kind bo'yicha aniq matn; ishlatilgan gul → 400 AYNAN. */
function CancelConfirm({ issue, onClose, onDone }: { issue: FloristStockIssue; onClose: () => void; onDone: () => void }) {
  const { showToast } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const spb = issue.batch_detail?.stems_per_bunch || 1;
  const n = formatStemsAndBunches(issue.quantity_stems, spb);
  // Bekor = asl harakatning teskarisi: issue→skladga qaytadi; return/waste→floristga qaytadi.
  const effect = issue.kind === "issue"
    ? <><b>{n}</b> skladga qaytadi (floristdan olinadi).</>
    : issue.kind === "return"
      ? <><b>{n}</b> yana floristga qaytadi (skladdan olinadi).</>
      : <><b>{n}</b> floristga qaytadi (chiqit bekor qilinadi).</>;

  const doCancel = async () => {
    setBusy(true); setErr(null);
    try {
      await api.floristStockIssueCancel(issue.id);
      showToast("✓ Bekor qilindi");
      onDone();
      onClose();
    } catch (e) {
      const detail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : null;
      setErr(detail || (e instanceof ApiError ? e.message : "Bekor qilib bo'lmadi"));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={440}>
      <ModalHeader icon={<Trash2 size={18} strokeWidth={1.9} />} title={`${KIND_NOUN[issue.kind][0].toUpperCase()}${KIND_NOUN[issue.kind].slice(1)}ni bekor qilish`} sub={issue.florist_name} onClose={onClose} />

      <div className="mt-1 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
        <StockLine data={lineFromBatchDetail(issue.batch_detail)} right={<span className="text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{n}</span>} />
      </div>

      <p className="mt-3 rounded-[12px] px-3 py-2.5 text-[12.5px] font-semibold leading-snug" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
        {effect} Yozuv <b>butunlay o&apos;chadi</b> — bu amalni <b>orqaga qaytarib bo&apos;lmaydi</b>.
      </p>
      {issue.kind !== "return" && (
        <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
          Gul allaqachon katalogda ishlatilgan bo&apos;lsa bekor bo&apos;lmaydi — ishlatilgan gulni orqaga qaytarib bo&apos;lmaydi.
        </p>
      )}

      {err && <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Yopish</button>
        <button onClick={doCancel} disabled={busy} className="btn-danger disabled:opacity-60">{busy ? "Bekor qilinmoqda…" : "Ha, bekor qilish"}</button>
      </ModalFooter>
    </Modal>
  );
}
