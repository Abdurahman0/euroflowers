"use client";
import { useState } from "react";
import clsx from "clsx";
import { CalendarClock, Info, Trash2, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { notifyReportDataChanged } from "@/lib/reportCache";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import DatePicker from "./DatePicker";
import { fmt } from "@/lib/format";
import { todayTashkent } from "@/lib/backdate";
import {
  validateExpense, buildExpenseEditPayload, quickAddSpentAt, expenseNum,
  spentDate, spentTime, MONTHS_UZ, PAYMENT_DOT, type ExpenseForm,
} from "@/lib/expenses";
import type { Expense, ExpenseOptions } from "@/lib/types";

/**
 * TEZ QO'SHISH — Google Calendar'dagi «Yangi hodisa» kabi ixcham modal.
 *
 * ⚠️ SANA QOIDASI (spec §3.2) — uchta holat:
 *   1) [+] dan ochilgan va sanaga TEGILMAGAN → `spent_at` UMUMAN yuborilmaydi
 *      (backend hozirgi vaqtni qo'yadi). `new Date()` YUBORILMAYDI.
 *   2) Kun katakchasidan ochilgan → o'sha kun ANIQ yuboriladi (T00:00:00+05:00).
 *   3) «o'zgartir» bilan sana/vaqt tanlangan → o'sha qiymat.
 */
export default function ExpenseQuickAdd({ expense, day, options, onClose, onSaved, onDelete }: {
  expense: Expense | null;
  /** kun katakchasidan ochilgan bo'lsa — o'sha sana (YYYY-MM-DD) */
  day: string | null;
  options: ExpenseOptions | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const { showToast } = useStore();
  const isEdit = !!expense;
  const [amount, setAmount] = useState(expense ? String(Math.round(expenseNum(expense.amount))) : "");
  const [destination, setDestination] = useState(expense?.destination ?? "");
  const [paymentMethod, setPaymentMethod] = useState(expense?.payment_method ?? "cash");
  const [note, setNote] = useState(expense?.note ?? "");
  // ⚠️ TEGILGANMI — tegilmagan bo'lsa (va kun berilmagan bo'lsa) kalit yuborilmaydi
  const [dateOpen, setDateOpen] = useState(false);
  const [pickedDay, setPickedDay] = useState(expense ? spentDate(expense.spent_at) : (day ?? ""));
  const [pickedTime, setPickedTime] = useState(expense ? spentTime(expense.spent_at) : "");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState("");

  const form: ExpenseForm = { amount, destination, payment_method: paymentMethod, spent_at: pickedDay, note };
  const methods = options?.payment_methods ?? [{ value: "cash", label: "Naqd" }, { value: "card", label: "Karta" }, { value: "transfer", label: "O'tkazma" }];

  const dateLabel = pickedDay
    ? `${+pickedDay.slice(8)}-${MONTHS_UZ[+pickedDay.slice(5, 7) - 1].toLowerCase()} ${pickedDay.slice(0, 4)}${pickedTime ? `, ${pickedTime}` : ""}`
    : "Hozirgi vaqt";

  const submit = async () => {
    const v = validateExpense(form);
    if (!v.ok) return setErrs(v.errors);
    setBusy(true); setErrs({}); setDetail("");
    try {
      if (isEdit) {
        const payload = buildExpenseEditPayload(expense!, form);
        if (Object.keys(payload).length === 0) { showToast("O'zgarish yo'q"); onClose(); return; }
        await api.updateExpense(expense!.id, payload);
        showToast("✓ Rasxod yangilandi");
      } else {
        await api.createExpense({
          amount: String(expenseNum(amount)),
          destination: destination.trim(),
          ...(paymentMethod ? { payment_method: paymentMethod } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          // ⚠️ tegilmagan bo'lsa BO'SH obyekt — kalit umuman yo'q
          ...quickAddSpentAt(pickedDay || null, pickedTime || null),
        });
        showToast("✓ Rasxod qo'shildi");
      }
      notifyReportDataChanged(); // rasxod Hisob-kitobga tushadi
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrs(e.fieldErrors);
      else if (e instanceof ApiError) setDetail(e.message); // 403 ham AYNAN shu yerda
      else setDetail("Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={400}>
      <ModalHeader icon={<Wallet size={18} strokeWidth={1.8} />}
        title={isEdit ? "Rasxodni tahrirlash" : "Yangi rasxod"} sub={isEdit ? `#${expense!.id}` : "Summa va qayerga ketgani yetarli"} onClose={onClose} />

      <div className="mt-1 grid gap-2.5"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && (e.target as HTMLElement).tagName !== "TEXTAREA") { e.preventDefault(); submit(); } }}>
        <Field label="Summa" span>
          <input className="inp" inputMode="numeric" value={amount} autoFocus placeholder="150 000"
            onChange={(e) => { setAmount(e.target.value.replace(/\D/g, "")); setErrs((x) => { const n = { ...x }; delete n.amount; return n; }); }} />
          {errs.amount && <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.amount}</span>}
        </Field>

        <Field label="Qayerga ketdi" span>
          <input className="inp" value={destination} placeholder="Kuryerga"
            onChange={(e) => { setDestination(e.target.value); setErrs((x) => { const n = { ...x }; delete n.destination; return n; }); }} />
          {errs.destination && <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.destination}</span>}
        </Field>

        {/* SANA qatori — «o'zgartir» bilan ochiladi */}
        <div className="flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ background: "var(--surface-2)" }}>
          <CalendarClock size={15} strokeWidth={2} style={{ color: "var(--muted)" }} />
          <span className="flex-1 text-[12.5px] font-semibold" style={{ color: pickedDay ? "var(--text)" : "var(--muted)" }}>{dateLabel}</span>
          <button type="button" onClick={() => setDateOpen((v) => !v)}
            className="text-[11.5px] font-bold underline underline-offset-2" style={{ color: "var(--primary)" }}>
            {dateOpen ? "yopish" : "o'zgartir"}
          </button>
        </div>
        {dateOpen && (
          <div className="grid grid-cols-2 gap-2">
            <DatePicker value={pickedDay} onChange={setPickedDay} maxDate={todayTashkent()} placeholder="Sana" ariaLabel="Rasxod sanasi" />
            <input className="inp" type="time" value={pickedTime} onChange={(e) => setPickedTime(e.target.value)} aria-label="Rasxod vaqti" />
          </div>
        )}
        {!pickedDay && !isEdit && (
          <p className="-mt-1 text-[11px]" style={{ color: "var(--muted)" }}>Tegilmasa server hozirgi vaqtni qo&apos;yadi.</p>
        )}

        {/* TO'LOV — radio, sukut Naqd */}
        <div className="flex flex-wrap items-center gap-1.5">
          {methods.map((m) => {
            const on = paymentMethod === m.value;
            return (
              <button key={m.value} type="button" onClick={() => setPaymentMethod(m.value)} aria-pressed={on}
                className="flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[12px] font-bold transition-colors"
                style={on ? { borderColor: "var(--primary)", color: "var(--primary)", background: "var(--primary-soft)" } : { borderColor: "var(--border)", color: "var(--muted)" }}>
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: PAYMENT_DOT[m.value] ?? "var(--muted)" }} />
                {m.label}
              </button>
            );
          })}
        </div>

        <Field label="Izoh (ixtiyoriy)" span>
          <textarea className="inp min-h-[56px] py-2" value={note} placeholder="Chilonzorga dastafka"
            onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      {expenseNum(amount) > 0 && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-[11px] px-3 py-2 text-[11px] font-semibold leading-[1.45]"
          style={{ background: "var(--primary-soft)", color: "var(--text-2)" }}>
          <Info size={12} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--primary)" }} />
          <span><b>{fmt(expenseNum(amount))}</b> — sotuv foydasiga tegmaydi; «Rasxoddan keyingi foyda» shunga kamayadi.</span>
        </p>
      )}

      {detail && (
        <p className="mt-2.5 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold"
          style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{detail}</p>
      )}

      <ModalFooter>
        {onDelete && (
          <button onClick={onDelete} className="mr-auto flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: "var(--danger-ink)" }}>
            <Trash2 size={14} /> O&apos;chirish
          </button>
        )}
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={submit} disabled={busy} className={clsx("btn-primary disabled:opacity-60", busy && "btn-loading")}>Saqlash</button>
      </ModalFooter>
    </Modal>
  );
}
