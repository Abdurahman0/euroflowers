"use client";
import { useState } from "react";
import clsx from "clsx";
import { Info, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { notifyReportDataChanged } from "@/lib/reportCache";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import Select from "./Select";
import DatePicker from "./DatePicker";
import { fmt } from "@/lib/format";
import { todayTashkent } from "@/lib/backdate";
import {
  validateExpense, buildExpensePayload, buildExpenseEditPayload, expenseNum, type ExpenseForm,
} from "@/lib/expenses";
import type { Expense, ExpenseCategories } from "@/lib/types";

const formFrom = (e: Expense | null): ExpenseForm => ({
  amount: e ? String(Math.round(expenseNum(e.amount))) : "",
  destination: e?.destination ?? "",
  category: e?.category ?? "other",
  payment_method: e?.payment_method ?? "cash",
  // ⚠️ YANGI yozuvda BO'SH — backend hozirgi vaqtni qo'yadi (spec §8.1).
  spent_at: e ? (e.spent_at ?? "").slice(0, 10) : "",
  note: e?.note ?? "",
});

/**
 * RASXOD formasi — qo'shish va tahrirlash.
 *
 * ⚠️ SANA SUKUT BO'YICHA BO'SH — katalog/chiqim formalaridan FARQLI o'laroq bu yerda
 * «bugun» QO'YILMAYDI. Spec aniq aytadi: tegilmasa `spent_at` yuborilmaydi va backend
 * o'zi hozirgi vaqtni qo'yadi. `new Date()` yuborish TAQIQLANGAN.
 * ⚠️ Tur/to'lov ro'yxati serverdan keladi — qattiq yozilmaydi.
 */
export default function ExpenseModal({ expense, options, onClose, onSaved }: {
  expense: Expense | null;
  options: ExpenseCategories | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useStore();
  const isEdit = !!expense;
  const [f, setF] = useState<ExpenseForm>(() => formFrom(expense));
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState("");

  const set = (k: keyof ExpenseForm, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrs((x) => { const n = { ...x }; delete n[k]; delete n.detail; return n; });
    setDetail("");
  };

  const submit = async () => {
    const v = validateExpense(f);
    if (!v.ok) return setErrs(v.errors);
    setBusy(true); setErrs({}); setDetail("");
    try {
      if (isEdit) {
        const payload = buildExpenseEditPayload(expense!, f);
        if (Object.keys(payload).length === 0) { showToast("O'zgarish yo'q"); onClose(); return; }
        await api.updateExpense(expense!.id, payload);
        showToast("✓ Rasxod yangilandi");
      } else {
        await api.createExpense(buildExpensePayload(f));
        showToast("✓ Rasxod qo'shildi");
      }
      // ⚠️ Rasxod Hisob-kitobga tushadi — hisobot keshi majburan yangilanadi.
      notifyReportDataChanged();
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrs(e.fieldErrors);
      else if (e instanceof ApiError) setDetail(e.message); // 403 ham shu yerda AYNAN chiqadi
      else setDetail("Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={460}>
      <ModalHeader icon={<Wallet size={19} strokeWidth={1.8} />}
        title={isEdit ? "Rasxodni tahrirlash" : "Rasxod qo'shish"}
        sub={isEdit ? `#${expense!.id}` : "Qo'lda kiritiladigan chiqim"} onClose={onClose} />

      <div className="mt-1 grid grid-cols-1 gap-3">
        <Field label="Summa (so'm) *" span>
          <input className="inp" inputMode="numeric" value={f.amount} autoFocus placeholder="Masalan: 150 000"
            onChange={(e) => set("amount", e.target.value.replace(/\D/g, ""))} />
          {errs.amount && <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.amount}</span>}
        </Field>

        <Field label="Qayerga ketdi *" span>
          <input className="inp" value={f.destination} placeholder="Masalan: Kuryerga"
            onChange={(e) => set("destination", e.target.value)} />
          {errs.destination && <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.destination}</span>}
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Turi">
            {/* ⚠️ Serverdan — yangi tur qo'shilsa frontend o'zgarmasdan ko'rsatadi */}
            <Select value={f.category} onChange={(v) => set("category", String(v))} placeholder="Tanlang"
              options={(options?.categories ?? []).map((c) => ({ value: c.value, label: c.label }))} />
          </Field>
          <Field label="To'lov usuli">
            <Select value={f.payment_method} onChange={(v) => set("payment_method", String(v))} placeholder="Tanlang"
              options={(options?.payment_methods ?? []).map((c) => ({ value: c.value, label: c.label }))} />
          </Field>
        </div>

        {/* ⚠️ SANA — BO'SH qoldirilsa backend hozirgi vaqtni qo'yadi (yubormaymiz) */}
        <Field label="Sana (ixtiyoriy)" span>
          <DatePicker value={f.spent_at} onChange={(v) => set("spent_at", v)} maxDate={todayTashkent()}
            placeholder="Bo'sh qoldirilsa — hozirgi vaqt" ariaLabel="Rasxod sanasi" />
          <span className="mt-1 block text-[11.5px]" style={{ color: "var(--muted)" }}>
            {f.spent_at
              ? "Rasxod shu kunga yoziladi — o'sha davr hisobotiga tushadi."
              : "Tegilmasa bugungi vaqt qo'yiladi."}
          </span>
          {errs.spent_at && <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.spent_at}</span>}
        </Field>

        <Field label="Izoh (ixtiyoriy)" span>
          <textarea className="inp min-h-[70px] py-2" value={f.note} placeholder="Masalan: Chilonzorga dastafka"
            onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>

      {expenseNum(f.amount) > 0 && (
        <p className="mt-3 flex items-start gap-1.5 rounded-[12px] px-3 py-2 text-[11.5px] font-semibold leading-[1.45]"
          style={{ background: "var(--primary-soft)", color: "var(--text-2)" }}>
          <Info size={13} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--primary)" }} />
          <span>
            <b>{fmt(expenseNum(f.amount))}</b> — sotuv foydasiga (<b>Sof foyda</b>) TEGMAYDI; Hisob-kitobda
            «Rasxoddan keyingi foyda» shunga kamayadi.
          </span>
        </p>
      )}

      {detail && (
        <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold"
          style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{detail}</p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={submit} disabled={busy} className={clsx("btn-primary disabled:opacity-60", busy && "btn-loading")}>
          {isEdit ? "Saqlash" : "Qo'shish"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
