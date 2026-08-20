"use client";
import { useState } from "react";
import { HandCoins } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalHeader, ModalFooter, Field } from "./Modal";
import DatePicker from "./DatePicker";
import { todayTashkent } from "@/lib/backdate";
import { fmt } from "@/lib/format";
import type { Supplier } from "@/lib/types";

/**
 * QO'LDA QARZ QO'SHISH — POST /api/supplier-debts/ (deploy 20.08.2026).
 *
 * ⚠️ BU TO'LOV EMAS, AKSINCHASI. Tizimga kiritilmagan ESKI qarzni yozish uchun:
 * summa postavshikning balansiga QO'SHILADI (`balance_total` oshadi), to'lov esa
 * uni kamaytiradi. Ikkalasi bitta ekranda turgani uchun matn ochiq yozilgan —
 * operator adashib to'lovni shu yerga kiritmasin.
 *
 * ⚠️ Bu yo'l JONLI SINALMAGAN (loyiha qoidasi: faqat GET). Payload spec va jonli
 * OpenAPI bo'yicha qurilgan: {supplier, amount, adjusted_at?, note?}.
 */
export default function SupplierDebtModal({
  supplier, onClose, onSaved,
}: { supplier: Supplier; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useStore();
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(todayTashkent());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string[]>([]);

  const n = Math.round(+amount || 0);
  const ok = n > 0;

  const save = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr([]);
    try {
      await api.createSupplierDebt({
        supplier: supplier.id,
        amount: String(n),
        ...(at ? { adjusted_at: at } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      showToast(`✓ Qarz qo'shildi: ${fmt(n)}`);
      onSaved();
    } catch (e) {
      const ae = e as ApiError;
      setErr(String(ae?.message ?? "Saqlab bo'lmadi").split("\n"));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={440}>
      <ModalHeader
        icon={<HandCoins size={19} strokeWidth={1.8} />}
        title="Qarz qo'shish"
        sub={supplier.name}
        onClose={onClose}
      />

      {/* ⚠️ TO'LOV BILAN ADASHTIRMASLIK — eng tepada, katta harflarda emas, aniq matn */}
      <p className="mt-2 rounded-[11px] px-3 py-2 text-[12px] font-semibold leading-snug"
        style={{ background: "color-mix(in srgb, var(--danger-ink) 12%, transparent)", color: "var(--danger-ink)" }}>
        Bu summa postavshikka bo&apos;lgan qarzni <b>OSHIRADI</b>. To&apos;lov kiritmoqchi bo&apos;lsangiz
        «To&apos;lov qo&apos;shish» dan foydalaning.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Summa (so'm)" span>
          <input className="inp" inputMode="numeric" autoFocus value={amount}
            onChange={(e) => { setAmount(e.target.value.replace(/\D/g, "")); setErr([]); }}
            placeholder="Masalan: 500000" />
        </Field>
        <Field label="Qaysi kunga">
          <DatePicker value={at} onChange={setAt} maxDate={todayTashkent()} ariaLabel="Qarz sanasi" />
        </Field>
        <Field label="Izoh (ixtiyoriy)" span>
          <input className="inp" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Masalan: Oldingi qarz qo'lda qo'shildi" />
        </Field>
      </div>

      {n > 0 && (
        <p className="mt-2 rounded-[11px] px-3 py-2 text-center text-[13px] font-bold"
          style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
          Qarz {fmt(n)} ga oshadi
        </p>
      )}

      {err.length > 0 && (
        <p className="mt-2 rounded-md px-3 py-2 text-[12px] font-semibold"
          style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          {err.map((l, i) => <span key={i} className="block">{l}</span>)}
        </p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={!ok || busy} className={`btn-primary disabled:opacity-60 ${busy ? "btn-loading" : ""}`}>
          Qarz qo&apos;shish
        </button>
      </ModalFooter>
    </Modal>
  );
}
