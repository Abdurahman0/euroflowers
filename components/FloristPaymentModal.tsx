"use client";
import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalHeader, ModalFooter, Field } from "./Modal";
import Select from "./Select";
import DatePicker from "./DatePicker";
import { todayTashkent } from "@/lib/backdate";
import { fmt } from "@/lib/format";
import { floristLabel } from "@/lib/floristLabel";
import type { FloristPaymentMethod, FloristProfile } from "@/lib/types";

/**
 * FLORISTGA PUL BERISH — POST /api/florist-payments/ (backend 76b3b72, 20.08.2026).
 *
 * ⚠️ BU OYLIK HISOBLASH EMAS. Hisoblangan oylik katalog/chiqim orqali o'zi yoziladi
 *    (`florist_accrued_total`), bu yerda esa QO'LGA BERILGAN pul qayd etiladi
 *    (`florist_paid_total`). Ikkisining farqi — floristga qolgan qarz.
 *
 * ⚠️ Yozuv yo'li JONLI SINALMAGAN (loyiha qoidasi: faqat GET). Payload spec bo'yicha:
 *    {florist, amount, paid_at, method, note}.
 */
const METHODS: { value: FloristPaymentMethod; label: string }[] = [
  { value: "cash", label: "Naqd" },
  { value: "card", label: "Karta" },
  { value: "transfer", label: "O'tkazma" },
];

export default function FloristPaymentModal({
  florist: fixedFlorist, onClose, onSaved,
}: { florist?: FloristProfile | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useStore();
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  const [florist, setFlorist] = useState<number>(fixedFlorist?.id ?? 0);
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(todayTashkent());
  const [method, setMethod] = useState<FloristPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string[]>([]);

  useEffect(() => {
    if (fixedFlorist) return; // tanlagich kerak emas
    api.florists({ is_active: true, ordering: "user", page_size: "all" })
      .then((fs) => { setFlorists(fs); setFlorist((cur) => cur || fs[0]?.id || 0); })
      .catch(() => showToast("Floristlarni yuklab bo'lmadi"));
  }, [fixedFlorist, showToast]);

  const n = Math.round(+amount || 0);
  const ok = n > 0 && florist > 0;
  const options = useMemo(() => florists.map((f) => ({ value: f.id, label: floristLabel(f) })), [florists]);

  const save = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr([]);
    try {
      await api.createFloristPayment({
        florist,
        amount: String(n),
        ...(at ? { paid_at: at } : {}),
        method,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      showToast(`✓ Floristga berildi: ${fmt(n)}`);
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
        icon={<Wallet size={19} strokeWidth={1.8} />}
        title="Floristga pul berish"
        sub={fixedFlorist ? floristLabel(fixedFlorist) : "Qo'lga berilgan pul qayd etiladi"}
        onClose={onClose}
      />

      {/* ⚠️ HISOBLANGAN OYLIK BILAN ADASHTIRMASLIK — eng tepada */}
      <p className="mt-2 rounded-[11px] px-3 py-2 text-[12px] font-semibold leading-snug"
        style={{ background: "color-mix(in srgb, var(--success, #3d8a5f) 14%, transparent)", color: "var(--success-ink, #3d8a5f)" }}>
        Bu — floristga <b>qo&apos;lga berilgan</b> pul. Hisoblangan oylik alohida yuritiladi;
        ikkisining farqi «Floristlarga qolgan qarz» bo&apos;lib turadi.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {!fixedFlorist && (
          <Field label="Florist" span>
            <Select value={florist} onChange={(v) => { setFlorist(+v); setErr([]); }} searchable placeholder="Floristni tanlang" options={options} />
          </Field>
        )}
        <Field label="Summa (so'm)" span>
          <input className="inp" inputMode="numeric" autoFocus value={amount}
            onChange={(e) => { setAmount(e.target.value.replace(/\D/g, "")); setErr([]); }}
            placeholder="Masalan: 150000" />
        </Field>
        <Field label="Qaysi kunga">
          <DatePicker value={at} onChange={setAt} maxDate={todayTashkent()} ariaLabel="To'lov sanasi" />
        </Field>
        <Field label="To'lov turi">
          <div className="flex gap-1 rounded-md border p-1" style={{ borderColor: "var(--border)" }}>
            {METHODS.map((m) => (
              <button key={m.value} type="button" onClick={() => setMethod(m.value)} aria-pressed={method === m.value}
                className="flex-1 rounded-sm py-1.5 text-[12.5px] font-bold transition-colors duration-150"
                style={method === m.value ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>
                {m.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Izoh (ixtiyoriy)" span>
          <input className="inp" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Masalan: Oy oxiri uchun berildi" />
        </Field>
      </div>

      {err.length > 0 && (
        <p className="mt-2 rounded-md px-3 py-2 text-[12px] font-semibold"
          style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          {err.map((l, i) => <span key={i} className="block">{l}</span>)}
        </p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={!ok || busy} className={`btn-primary disabled:opacity-60 ${busy ? "btn-loading" : ""}`}>
          Pul berish
        </button>
      </ModalFooter>
    </Modal>
  );
}
