"use client";
import { useState } from "react";
import { Calculator, PencilLine, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalHeader, ModalFooter, Field } from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { fmt } from "@/lib/format";
import { salarySourceLabel } from "@/lib/inventory";
import { buildSalaryEditPayload, hasArithmetic, type SalaryEditMode } from "@/lib/decoration";
import type { FloristSalaryEntry } from "@/lib/types";

/**
 * OYLIK YOZUVINI TUZATISH — PATCH /api/florist-salary/{id}/
 *
 * ⚠️ SERVERDA UCHTA XULQ BOR va ular BIR-BIRINI BEKOR QILADI (spec §5):
 *   `quantity`    → summa QAYTA hisoblanadi
 *   `unit_amount` → summa QAYTA hisoblanadi
 *   `amount`      → o'sha qiymat QOLADI, ko'paytirish bekor
 * Shu bois forma UCHTA erkin maydon EMAS — ikkita REJIM:
 *   «Soni/narxi» (summa o'zi chiqadi)  yoki  «Summani qo'lda yozish».
 * Uch maydon bir vaqtda tahrirlansa operator o'zi bilmagan holda hisobni
 * muzlatib qo'yardi (o'zgarmagan `amount` ham yuborilib ketardi).
 */
export default function SalaryEditModal({
  entry, onClose, onSaved,
}: { entry: FloristSalaryEntry; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useStore();
  const calcable = hasArithmetic(entry);
  const [mode, setMode] = useState<SalaryEditMode>(calcable ? "calc" : "manual");
  const [quantity, setQuantity] = useState(String(entry.quantity ?? ""));
  const [unitAmount, setUnitAmount] = useState(entry.unit_amount ? String(Math.round(+entry.unit_amount)) : "");
  const [amount, setAmount] = useState(String(Math.round(+entry.amount) || ""));
  const [busy, setBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [err, setErr] = useState("");

  const payload = buildSalaryEditPayload(entry, { quantity, unitAmount, amount }, mode);
  const dirty = Object.keys(payload).length > 0;
  // rejim «calc» da kutilayotgan summa — operator natijani OLDINDAN ko'radi
  const preview = Math.max(Math.round(+quantity || 0), 0) * Math.max(Math.round(+unitAmount || 0), 0);

  const save = async () => {
    if (!dirty || busy) return;
    setBusy(true); setErr("");
    try {
      await api.updateFloristSalary(entry.id, payload);
      showToast("✓ Yozuv yangilandi");
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    try {
      await api.deleteFloristSalary(entry.id);
      showToast("✓ Yozuv o'chirildi");
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "O'chirib bo'lmadi");
      setBusy(false); setDelOpen(false);
    }
  };

  return (
    <>
      <Modal onClose={onClose} width={460}>
        <ModalHeader icon={<PencilLine size={19} strokeWidth={1.8} />} title="Oylik yozuvini tuzatish"
          sub={`${salarySourceLabel(entry.source)} · ${entry.work_date}`} onClose={onClose} />

        {/* REJIM — ikkitadan BIRI (uch maydon bir vaqtda tahrirlanmaydi) */}
        {calcable && (
          <div className="mt-2 flex gap-1 rounded-md p-1" style={{ background: "var(--surface-2)" }}>
            {([["calc", "Soni / narxi"], ["manual", "Summani qo'lda"]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className="flex-1 rounded-sm py-1.5 text-[12.5px] font-bold transition-colors"
                style={mode === m ? { background: "var(--surface-solid)", color: "var(--primary)" } : { color: "var(--muted)" }}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          {mode === "calc" ? (
            <>
              <Field label="Nechta"><input className="inp" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} /></Field>
              <Field label="Bittasining narxi"><input className="inp" inputMode="numeric" value={unitAmount} onChange={(e) => setUnitAmount(e.target.value.replace(/\D/g, ""))} /></Field>
              <div className="col-span-full rounded-md border px-3 py-2 text-center text-[14px] font-extrabold tabular-nums"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--acc)" }}>
                <Calculator size={13} strokeWidth={2.2} className="mr-1.5 inline" />
                {quantity || 0} × {fmt(unitAmount || 0).replace(" so'm", "")} = {fmt(preview)}
              </div>
              <p className="col-span-full text-[11.5px]" style={{ color: "var(--muted)" }}>
                Summa server tomonda <b>qayta hisoblanadi</b> — qo&apos;lda yozilgan summa yuborilmaydi.
              </p>
            </>
          ) : (
            <>
              <Field label="Summa (so'm)" span><input className="inp" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} /></Field>
              <p className="col-span-full text-[11.5px]" style={{ color: "var(--muted)" }}>
                ⚠️ Qo&apos;lda yozilgan summa <b>ustun turadi</b> — «soni × narxi» hisobi bu yozuv uchun bekor bo&apos;ladi.
              </p>
            </>
          )}
        </div>

        {err && <p className="mt-3 rounded-md px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

        <ModalFooter>
          <button onClick={() => setDelOpen(true)} className="btn-secondary" style={{ color: "var(--danger-ink)" }}>
            <Trash2 size={14} strokeWidth={1.9} /> O&apos;chirish
          </button>
          <button onClick={onClose} className="btn-ghost">Bekor</button>
          <button onClick={save} disabled={!dirty || busy} className={`btn-primary disabled:opacity-60 ${busy ? "btn-loading" : ""}`}>Saqlash</button>
        </ModalFooter>
      </Modal>

      {delOpen && (
        <ConfirmDialog
          title="Oylik yozuvini o'chirish"
          body={`${salarySourceLabel(entry.source)} · ${fmt(entry.amount)} — o'chirilsinmi? Bu florist ish haqini kamaytiradi.`}
          confirmLabel="O'chirish" danger busy={busy}
          onConfirm={del} onCancel={() => setDelOpen(false)}
        />
      )}
    </>
  );
}
