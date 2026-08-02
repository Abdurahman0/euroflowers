"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Drawer, { useDrawerClose } from "./Drawer";
import Select from "./Select";
import DatePicker from "./DatePicker";
import CustomerPicker, { customerPayload, type CustomerPick } from "./CustomerPicker";
import { ARRANGEMENT_LABEL } from "./badges";
import { fmt } from "@/lib/format";
import { FULFILLMENT_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/reservation";
import type { ArrangementType, Fulfillment, PaymentMethod, Reservation } from "@/lib/types";

const Lbl = ({ children }: { children: React.ReactNode }) => <div className="mb-1 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{children}</div>;
function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className="flex-1 rounded-[11px] border-[1.5px] py-2 text-[13px] font-bold transition-colors duration-150"
          style={value === o.value ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-2)" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** BRON YARATISH — mijoz oldindan buyurtma beradi (zaklad). Ixtiyoriy birinchi to'lov shu yerda. */
export default function ReservationCreateDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: (r: Reservation) => void }) {
  const { showToast } = useStore();
  const [cust, setCust] = useState<CustomerPick>({ mode: "none" });
  const [request, setRequest] = useState("");
  const [arr, setArr] = useState<ArrangementType>("bouquet");
  const [price, setPrice] = useState("");
  const [dt, setDt] = useState(""); // "YYYY-MM-DDTHH:mm"
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [address, setAddress] = useState("");
  const [payOn, setPayOn] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const closeAnim = useDrawerClose() ?? onClose;

  const prNum = Math.round(+price || 0);
  const payNum = Math.round(+payAmount || 0);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!request.trim()) e.request = "So'rov matnini kiriting";
    if (!dt) e.dt = "Sanani tanlang";
    if (payOn && payNum <= 0) e.pay = "To'lov summasini kiriting";
    if (payOn && prNum > 0 && payNum > prNum) e.pay = "Zaklad taxminiy narxdan oshib ketdi";
    if (Object.keys(e).length) { setErrs(e); return; }
    setBusy(true); setErrs({});
    const [date, time] = dt.split("T");
    try {
      const created = await api.createReservation({
        request_uz: request.trim(),
        arrangement_type: arr,
        ...(prNum > 0 ? { estimated_price: String(prNum) } : {}),
        desired_date: date,
        ...(time ? { desired_time: time } : {}),
        fulfillment,
        ...(fulfillment === "delivery" && address.trim() ? { delivery_address: address.trim() } : {}),
        ...(customerPayload(cust, false) ?? {}),
      });
      // ⚠️ Birinchi to'lov — create endpoint qabul qilmaydi, shuning uchun ALOHIDA add-payment (bir amal ko'rinishida).
      let final = created;
      if (payOn && payNum > 0) {
        try { await api.addReservationPayment(created.id, { amount: String(payNum), method: payMethod, note: "Zaklad" }); final = await api.reservation(created.id); }
        catch { showToast("Bron yaratildi, lekin to'lovni yozib bo'lmadi — detalda qayta urinib ko'ring"); }
      }
      showToast("✓ Bron yaratildi");
      onSaved(final);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrs(err.fieldErrors);
      showToast(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Drawer onClose={onClose} width={480} title="Yangi bron" sub="Mijoz oldindan buyurtma beradi (zaklad)">
      <div className="flex flex-col gap-4">
        <div><Lbl>Mijoz</Lbl><CustomerPicker value={cust} onChange={setCust} label="Mijoz (ixtiyoriy)" /></div>

        <div>
          <Lbl>So&apos;rov matni</Lbl>
          <textarea className="inp min-h-[70px] resize-y leading-relaxed" value={request} onChange={(e) => { setRequest(e.target.value.slice(0, 600)); setErrs((x) => { const n = { ...x }; delete n.request; return n; }); }} placeholder="Masalan: 25 ta qizil atirgul buketi, tug'ilgan kunga" maxLength={600} />
          {errs.request && <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.request}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Lbl>Turi</Lbl><Select value={arr} onChange={(v) => setArr(v as ArrangementType)} options={(["bouquet", "basket", "box"] as const).map((t) => ({ value: t, label: ARRANGEMENT_LABEL[t] }))} /></div>
          <div><Lbl>Taxminiy narx (so&apos;m)</Lbl><input className="inp" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Masalan: 500000" /></div>
        </div>

        <div>
          <Lbl>Sana va vaqt</Lbl>
          <DatePicker value={dt} onChange={(v) => { setDt(v); setErrs((x) => { const n = { ...x }; delete n.dt; return n; }); }} withTime disablePast placeholder="Yetkazish sanasi va vaqti" ariaLabel="Bron sanasi" />
          {errs.dt && <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.dt}</p>}
        </div>

        <div>
          <Lbl>Yetkazish</Lbl>
          <Seg value={fulfillment} onChange={setFulfillment} options={(["delivery", "pickup"] as const).map((v) => ({ value: v, label: FULFILLMENT_LABEL[v] }))} />
          {fulfillment === "delivery" && (
            <input className="inp mt-2" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Manzil (ixtiyoriy)" />
          )}
        </div>

        {/* ixtiyoriy BIRINCHI to'lov (zaklad) — create'dan keyin add-payment bilan yoziladi */}
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[13px] border px-3.5 py-3" style={{ borderColor: payOn ? "var(--primary)" : "var(--border)", background: payOn ? "var(--primary-soft)" : undefined }}>
          <span className="text-[13px] font-bold">Hozir zaklad olindi</span>
          <input type="checkbox" checked={payOn} onChange={(e) => { setPayOn(e.target.checked); setErrs((x) => { const n = { ...x }; delete n.pay; return n; }); }} className="h-4 w-4 accent-[var(--primary)]" />
        </label>
        {payOn && (
          <div className="flex flex-col gap-2.5 rounded-[13px] border p-3" style={{ borderColor: "var(--border)" }}>
            <div><Lbl>Summa (so&apos;m)</Lbl><input className="inp" type="number" value={payAmount} onChange={(e) => { setPayAmount(e.target.value); setErrs((x) => { const n = { ...x }; delete n.pay; return n; }); }} placeholder="Masalan: 200000" /></div>
            <div><Lbl>Usul</Lbl><Seg value={payMethod} onChange={setPayMethod} options={(["cash", "card", "transfer"] as const).map((v) => ({ value: v, label: PAYMENT_METHOD_LABEL[v] }))} /></div>
            {prNum > 0 && payNum > 0 && payNum <= prNum && <p className="text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>Qoldiq: <b>{fmt(prNum - payNum)}</b></p>}
            {errs.pay && <p className="text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.pay}</p>}
          </div>
        )}

        <div className="mt-1 flex justify-end gap-2.5 max-sm:[&>*]:flex-1">
          <button onClick={() => closeAnim()} className="btn-ghost">Bekor</button>
          <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Bron yaratish"}</button>
        </div>
      </div>
    </Drawer>
  );
}
