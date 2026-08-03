"use client";
import { useState } from "react";
import clsx from "clsx";
import { Banknote, CreditCard, HandCoins, Info } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader } from "./Modal";
import BackdateField from "./BackdateField";
import { fmt, fmtDate } from "@/lib/format";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { debtPayPayload, canPayDebt, DEBT_ALREADY_PAID, debtQtyLabel } from "@/lib/debt";
import type { Debt, DebtPayMethod } from "@/lib/types";

const METHODS: { value: DebtPayMethod; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Naqd", icon: Banknote },
  { value: "card", label: "Karta", icon: CreditCard },
];

/**
 * QARZNI TO'LASH — kichik tasdiq oynasi.
 *
 * ⚠️ `method` MAJBURIY va SUKUT QIYMATI YO'Q: savdo qaysi ustunga (naqd/karta)
 * tushishi AYNAN shundan kelib chiqadi — tasodifan «naqd» qolib ketmasin.
 * ⚠️ QAYTMAS: OpenAPI'da to'langan qarzni «to'lanmagan»ga qaytarish yo'li YO'Q
 * (is_paid / paid_at / paid_method — readOnly).
 */
export default function DebtPayModal({ debt, onClose, onPaid }: {
  debt: Debt;
  onClose: () => void;
  onPaid: () => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [method, setMethod] = useState<DebtPayMethod | null>(null);
  const [dateOn, setDateOn] = useState(false);
  const [ymd, setYmd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const already = !canPayDebt(debt);
  const cd = debt.catalog_detail;
  const who = debt.customer_detail?.name || "Mijoz";

  const submit = async () => {
    // klient himoyasi — server matni baribir AYNAN ko'rsatiladi (pastda)
    if (already) return setErr(DEBT_ALREADY_PAID);
    const body = debtPayPayload(method, dateOn ? ymd : null);
    if (!body) return setErr("To'lov usulini tanlang — naqd yoki karta.");
    setBusy(true); setErr("");
    try {
      await api.payDebt(debt.id, body);
      // ⚠️ SAVDO KO'CHDI: hisobot keshi majburan yangilanadi.
      notifyReportDataChanged();
      showToast(`✓ ${who}: ${fmt(debt.amount)} to'landi (${method === "card" ? "Karta" : "Naqd"}) — savdoga qo'shildi`);
      onPaid();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "To'lovni yozib bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={420}>
      <ModalHeader
        icon={<HandCoins size={19} strokeWidth={1.8} />}
        title="Qarz to'landi"
        sub={`${who} · ${fmt(debt.amount)}`}
        onClose={onClose}
      />

      {/* nima uchun to'lanayotgani — adashmaslik uchun */}
      <div className="mt-1 rounded-[14px] border px-3.5 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="text-[13px] font-bold">{cd?.name_uz || "Katalog"}</div>
        <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
          {debtQtyLabel(debt.quantity, cd?.stems_total)} · {fmtDate(debt.created_at)} da qarzga berilgan
        </div>
        {debt.note ? <div className="mt-1 text-[11.5px] italic" style={{ color: "var(--text-2)" }}>«{debt.note}»</div> : null}
      </div>

      {/* USUL — sukut YO'Q */}
      <div className="mt-4">
        <div className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>To&apos;lov usuli (majburiy)</div>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => {
            const on = method === m.value;
            const MIcon = m.icon;
            return (
              <button key={m.value} type="button" onClick={() => { setMethod(m.value); setErr(""); }} aria-pressed={on}
                className={clsx("flex items-center justify-center gap-2 rounded-[13px] border-[1.5px] py-2.5 text-[13px] font-bold transition-colors duration-150", on ? "text-white" : "")}
                style={on ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--border)", color: "var(--text-2)" }}>
                <MIcon size={16} strokeWidth={2} /> {m.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex items-start gap-1.5 rounded-[12px] px-3 py-2 text-[11.5px] font-semibold leading-[1.45]"
          style={{ background: "var(--primary-soft)", color: "var(--text-2)" }}>
          <Info size={13} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--primary)" }} />
          <span>Bu summa <b>bugungi savdoga qo&apos;shiladi</b> — tanlangan usul ustuniga ({method ? (method === "card" ? "Karta" : "Naqd") : "naqd yoki karta"}).</span>
        </p>
      </div>

      {/* TARIXIY TO'LOV — ixtiyoriy; tegilmasa kalit YUBORILMAYDI */}
      <div className="mt-4">
        <BackdateField
          value={ymd}
          onChange={setYmd}
          open={dateOn}
          onOpenChange={(v) => { setDateOn(v); if (!v) setYmd(""); }}
          label="To'lov sanasi"
          toggleTitle="Boshqa to'lov sanasi (avvalroq to'langan bo'lsa)"
          retroNote="Savdo o'sha kunga tushadi — o'sha kunlik hisobotlar o'zgaradi."
        />
      </div>

      {(err || already) && (
        <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          {already ? DEBT_ALREADY_PAID : err}
        </p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={submit} disabled={busy || already || !method} className={clsx("btn-primary disabled:opacity-60", busy && "btn-loading")}>
          To&apos;landi deb belgilash
        </button>
      </ModalFooter>
    </Modal>
  );
}
