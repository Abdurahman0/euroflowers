"use client";
import { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarClock, CreditCard, Info, Minus, Plus, Tag, X } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import DatePicker from "./DatePicker";
import CustomerPicker, { customerPayload, type CustomerPick } from "./CustomerPicker";
import { fmt } from "@/lib/format";
import { paymentProgress } from "@/lib/reservation";
import type { CatalogItem, PaymentType, Reservation } from "@/lib/types";

const custLabel = (r: Reservation) => r.customer_detail?.name || r.customer_name || `Bron #${r.id}`;

const PAYMENTS: { value: PaymentType; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Naqd", icon: Banknote },
  { value: "card", label: "Karta", icon: CreditCard },
];

/**
 * KATALOGDAN SOTISH — soni, ixtiyoriy chegirma narxi va sabab.
 * Kontrakt (POST /api/catalog/{id}/sell/):
 *   {quantity}                                   — oddiy sotuv
 *   {quantity, sale_price, discount_reason}      — arzonroq sotuv
 * `sale_price` DONA narxi. U katalog narxidan PAST bo'lsa `discount_reason`
 * MAJBURIY — backend chegirmani hisoblab sotuv tarixiga yozadi.
 *
 * MIJOZ: sell endpoint mijoz maydonlarini QABUL QILMAYDI (CatalogSellRequest'da yo'q),
 * shuning uchun mijoz o'zgargan bo'lsa avval PATCH /api/catalog/{id}/ (customer /
 * customer_name+customer_phone / null), so'ng sell. PATCH muvaffaqiyatsiz bo'lsa —
 * sotuv umuman yuborilmaydi (yarim holat yo'q).
 */
export default function KatalogSellModal({
  item,
  onClose,
  onSold,
  presetReservation = null,
}: {
  item: CatalogItem;
  onClose: () => void;
  onSold: (updated: CatalogItem) => void;
  /** §2: bronni ulash — detail drawer «Katalogdan sotish»dan yoki ?reservation= orqali oldindan tanlanadi */
  presetReservation?: Reservation | null;
}) {
  const showToast = useStore((s) => s.showToast);
  const total = item.quantity_total ?? 1;
  const sold = item.quantity_sold ?? (item.status === "sold" ? total : 0);
  const left = Math.max(total - sold, 0) || 1;
  const listPrice = Math.round(+item.price || 0);

  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState<PaymentType>("cash");
  const [discountOn, setDiscountOn] = useState(false);
  const [price, setPrice] = useState(String(listPrice));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  // MIJOZ — item'da biriktirilgan bo'lsa oldindan tanlanadi
  const hadCustomer = !!(item.customer_detail || item.customer);
  const [cust, setCust] = useState<CustomerPick>(
    item.customer_detail
      ? { mode: "existing", id: item.customer_detail.id, detail: item.customer_detail }
      : { mode: "none" }
  );
  // SOTUV SANASI — ixtiyoriy; yoqilib o'zgartirilsagina yuboriladi (aks holda backend: hozir)
  const [dateOn, setDateOn] = useState(false);
  const [soldAt, setSoldAt] = useState("");

  // §2 BRON — ulanган bo'lsa: to'liq sotuv narxi daromad, oldingi zaklad esa ALLAQACHON cashflow (ikki marta sanamang).
  const [resv, setResv] = useState<Reservation | null>(presetReservation);
  const [pickerOn, setPickerOn] = useState(false);
  const [resvList, setResvList] = useState<Reservation[] | null>(null);
  const [resvQ, setResvQ] = useState("");

  // Bron tanlanganda: mijozni va (chegirma yoqilmagan bo'lsa) narxni oldindan to'ldiramiz
  useEffect(() => {
    if (!resv) return;
    if (resv.customer_detail && !hadCustomer) setCust({ mode: "existing", id: resv.customer_detail.id, detail: resv.customer_detail });
    const est = Math.round(+(resv.estimated_price ?? 0) || 0);
    if (est > 0 && est !== listPrice && !discountOn) { setDiscountOn(true); setPrice(String(est)); }
    setQty(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resv?.id]);

  const openPicker = async () => {
    setPickerOn(true);
    if (resvList) return;
    try { const d = await api.reservations({ status: "active", ordering: "desired_date", page_size: 100 }); setResvList(d); }
    catch { setResvList([]); }
  };
  const pickable = useMemo(() => {
    const xs = resvList ?? [];
    const q = resvQ.trim().toLowerCase();
    return q ? xs.filter((r) => custLabel(r).toLowerCase().includes(q) || (r.request_uz || "").toLowerCase().includes(q)) : xs;
  }, [resvList, resvQ]);

  const salePrice = discountOn ? Math.round(+price || 0) : listPrice;
  const calc = useMemo(() => {
    const unitDiscount = Math.max(listPrice - salePrice, 0);
    return {
      unitDiscount,
      percent: listPrice > 0 ? Math.round((unitDiscount / listPrice) * 1000) / 10 : 0,
      totalSum: salePrice * qty,
      totalDiscount: unitDiscount * qty,
    };
  }, [listPrice, salePrice, qty]);

  const needsReason = discountOn && calc.unitDiscount > 0;

  const submit = async () => {
    const next: Record<string, string> = {};
    if (discountOn && (!price || salePrice <= 0)) next.sale_price = "Narxni kiriting";
    if (needsReason && !reason.trim()) next.discount_reason = "Chegirma sababini yozing";
    if (Object.keys(next).length) return setErrs(next);
    setBusy(true);
    setErrs({});
    // 1-QADAM: mijoz o'zgargan bo'lsa katalog itemni PATCH qilamiz (sell mijozni qabul qilmaydi).
    //          Muvaffaqiyatsiz bo'lsa — sotuv YUBORILMAYDI.
    const custBody = customerPayload(cust, hadCustomer);
    let patched: CatalogItem | null = null;
    if (custBody) {
      try {
        patched = await api.updateCatalogItem(item.id, custBody);
      } catch (e) {
        if (e instanceof ApiError && e.fieldErrors) setErrs(e.fieldErrors);
        showToast(e instanceof ApiError ? e.message : "Mijozni biriktirib bo'lmadi");
        setBusy(false);
        return;
      }
    }
    // 2-QADAM: sotuv
    try {
      const updated = await api.sellCatalogItem(item.id, {
        quantity: qty,
        payment_type: payment,
        ...(discountOn ? { sale_price: salePrice.toFixed(2), discount_reason: reason.trim() || undefined } : {}),
        ...(dateOn && soldAt ? { sold_at: soldAt } : {}),
        ...(resv ? { reservation: resv.id } : {}),
      });
      // customer_detail — PATCH javobidan (backend mavjud mijozga ULAGAN bo'lsa ismi ko'rinsin)
      const linked = updated.customer_detail || patched?.customer_detail;
      const who = linked ? ` → ${linked.name}${linked.masked_phone ? ` (${linked.masked_phone})` : ""}` : "";
      showToast(
        calc.totalDiscount > 0
          ? `✓ ${qty} ta sotildi · chegirma ${fmt(calc.totalDiscount)}${who}`
          : `✓ «${item.name_uz || item.name_ru}»: ${qty} ta sotildi${who}`
      );
      onSold(updated);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrs(e.fieldErrors);
      showToast(e instanceof ApiError ? e.message : "Sotib bo'lmadi");
      setBusy(false);
    }
  };

  const step = (d: number) => setQty((n) => Math.min(Math.max(n + d, 1), left));

  return (
    <Modal onClose={onClose} width={460}>
      <ModalHeader
        icon={<Tag size={19} strokeWidth={1.8} />}
        title="Katalogdan sotish"
        sub={`${item.name_uz || item.name_ru} · ${fmt(listPrice)} / dona`}
        onClose={onClose}
      />

      {/* §2 BRON ULASH + HISOB-KITOB */}
      {!resv ? (
        <button type="button" onClick={openPicker} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[13px] border-[1.5px] border-dashed py-2.5 text-[12.5px] font-bold transition-colors" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
          <Tag size={14} strokeWidth={1.9} /> Bronga bog&apos;lash (ixtiyoriy)
        </button>
      ) : (
        <div className="mt-1 rounded-[16px] border p-3.5" style={{ borderColor: "var(--primary)", background: "var(--primary-soft)" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--primary)" }}>Bronga bog&apos;landi</div>
              <div className="truncate text-[14px] font-bold">{custLabel(resv)}</div>
            </div>
            <button type="button" onClick={() => setResv(null)} className="icon-btn !h-7 !w-7 shrink-0" aria-label="Bronni uzish"><X size={14} /></button>
          </div>
          {(() => {
            const est = Math.round(+(resv.estimated_price ?? 0) || 0);
            const prog = paymentProgress(resv.paid_amount, resv.estimated_price);
            const diff = calc.totalSum - est;
            return (
              <>
                <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                  <SettleCell label="Bron summasi" value={fmt(est)} />
                  <SettleCell label="Oldindan to'langan" value={fmt(prog.paid)} hue="var(--acc)" />
                  <SettleCell label="Qolgan to'lov" value={fmt(prog.remaining)} hue={prog.remaining > 0 ? "var(--danger-ink)" : "var(--success-ink, #3d8a5f)"} />
                </div>
                {est > 0 && diff !== 0 && (
                  <p className="mt-2 text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>
                    Sotuv narxi bron summasidan {diff > 0 ? "yuqori" : "past"}: <b style={{ color: diff > 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)" }}>{diff > 0 ? "+" : "−"}{fmt(Math.abs(diff))}</b>
                  </p>
                )}
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: "var(--muted)" }}>
                  <Info size={13} className="mt-px shrink-0" />
                  To&apos;liq sotuv narxi <b>daromad</b> sifatida yoziladi. Oldindan olingan zaklad ({fmt(prog.paid)}) esa allaqachon cashflow&apos;ga kirgan — hisob-kitobda uni ikki marta sanamang.
                </p>
              </>
            );
          })()}
        </div>
      )}

      {/* BRON TANLASH — ro'yxat (faol bronlar) */}
      {pickerOn && !resv && (
        <div className="mt-2 rounded-[14px] border" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 border-b px-2.5 py-2" style={{ borderColor: "var(--border)" }}>
            <input className="inp !h-9 flex-1" autoFocus value={resvQ} onChange={(e) => setResvQ(e.target.value)} placeholder="Bron qidirish (mijoz, so'rov)…" />
            <button type="button" onClick={() => setPickerOn(false)} className="icon-btn !h-8 !w-8 shrink-0" aria-label="Yopish"><X size={14} /></button>
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            {resvList === null ? <p className="px-2 py-3 text-[12.5px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>
              : pickable.length === 0 ? <p className="px-2 py-3 text-[12.5px]" style={{ color: "var(--muted)" }}>Faol bron topilmadi</p>
              : pickable.map((r) => (
                <button key={r.id} type="button" onClick={() => { setResv(r); setPickerOn(false); }} className="flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-[var(--hover)]">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{custLabel(r)}</span>
                    <span className="block truncate text-[11px]" style={{ color: "var(--muted)" }}>{r.request_uz || "—"}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] font-semibold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(r.estimated_price)}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* SONI — stepper */}
      <Field label="Nechta sotiladi" span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} disabled={qty <= 1} className="icon-btn !h-10 !w-10 shrink-0 disabled:opacity-40" aria-label="Kamaytirish">
            <Minus size={16} strokeWidth={2} />
          </button>
          <input
            className="inp !h-10 min-w-0 flex-1 text-center !text-[16px] font-bold"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(Math.min(Math.max(+e.target.value.replace(/\D/g, "") || 1, 1), left))}
            aria-label="Soni"
          />
          <button type="button" onClick={() => step(1)} disabled={qty >= left} className="icon-btn !h-10 !w-10 shrink-0 disabled:opacity-40" aria-label="Ko'paytirish">
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>
        <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>Sotuvda {left} ta bor</span>
      </Field>

      {/* TO'LOV TURI — naqd / karta */}
      <Field label="To'lov turi" span>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENTS.map((p) => {
            const on = payment === p.value;
            const PIcon = p.icon;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPayment(p.value)}
                aria-pressed={on}
                className={clsx("flex items-center justify-center gap-2 rounded-[13px] border-[1.5px] py-2.5 text-[13px] font-bold transition-colors duration-150", on ? "text-white" : "")}
                style={on ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--border)", color: "var(--text-2)" }}
              >
                <PIcon size={16} strokeWidth={2} /> {p.label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* CHEGIRMA — ixtiyoriy */}
      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border px-3.5 py-3" style={{ borderColor: discountOn ? "var(--primary)" : "var(--border)", background: discountOn ? "var(--primary-soft)" : undefined }}>
        <span className="min-w-0">
          <span className="block text-[13px] font-bold">Arzonroq sotish</span>
          <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>Chegirma sotuv tarixiga yoziladi</span>
        </span>
        <input
          type="checkbox"
          checked={discountOn}
          onChange={(e) => { setDiscountOn(e.target.checked); if (!e.target.checked) { setPrice(String(listPrice)); setReason(""); setErrs({}); } }}
          className="h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
      </label>

      {discountOn && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          <Field label="Sotuv narxi — dona (so'm)" span>
            <input
              className="inp"
              inputMode="numeric"
              value={price}
              onChange={(e) => { setPrice(e.target.value.replace(/\D/g, "")); setErrs((x) => { const n = { ...x }; delete n.sale_price; return n; }); }}
              placeholder={String(listPrice)}
              autoFocus
            />
            {errs.sale_price && <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.sale_price}</span>}
          </Field>
          <Field label={needsReason ? "Chegirma sababi (majburiy)" : "Chegirma sababi"} span>
            <input
              className="inp"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setErrs((x) => { const n = { ...x }; delete n.discount_reason; return n; }); }}
              placeholder="Masalan: Doimiy mijoz"
            />
            {errs.discount_reason && <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.discount_reason}</span>}
          </Field>
        </div>
      )}

      {/* MIJOZ — ixtiyoriy (walk-in yoki mavjud) */}
      <div className="mt-4">
        <CustomerPicker value={cust} onChange={setCust} />
      </div>

      {/* SOTUV SANASI — ixtiyoriy; default hozir */}
      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border px-3.5 py-3" style={{ borderColor: dateOn ? "var(--primary)" : "var(--border)", background: dateOn ? "var(--primary-soft)" : undefined }}>
        <span className="flex min-w-0 items-center gap-2">
          <CalendarClock size={16} strokeWidth={2} style={{ color: dateOn ? "var(--primary)" : "var(--muted)" }} />
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">Boshqa sotuv sanasi</span>
            <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>Belgilanmasa — hozirgi vaqt</span>
          </span>
        </span>
        <input type="checkbox" checked={dateOn} onChange={(e) => { setDateOn(e.target.checked); if (!e.target.checked) setSoldAt(""); }} className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
      </label>
      {dateOn && (
        <div className="mt-2.5">
          <DatePicker value={soldAt} onChange={setSoldAt} withTime placeholder="Sotuv sanasi va vaqti" ariaLabel="Sotuv sanasi" />
        </div>
      )}

      {/* HISOB — jonli */}
      <div className="mt-4 rounded-[16px] border px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-baseline justify-between gap-2 text-[13px]">
          <span style={{ color: "var(--text-2)" }}>Asl narx</span>
          <span className={clsx("tabular-nums font-semibold", calc.unitDiscount > 0 && "line-through opacity-70")}>{fmt(listPrice * qty)}</span>
        </div>
        {calc.unitDiscount > 0 && (
          <div className="mt-1 flex items-baseline justify-between gap-2 text-[13px]">
            <span style={{ color: "var(--text-2)" }}>Chegirma ({calc.percent}%)</span>
            <span className="tabular-nums font-semibold" style={{ color: "var(--danger-ink)" }}>−{fmt(calc.totalDiscount)}</span>
          </div>
        )}
        <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
          <span className="text-[13px] font-semibold">Mijoz to&apos;laydi</span>
          <span className="text-[17px] font-bold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(calc.totalSum)}</span>
        </div>
      </div>

      {errs.detail && (
        <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          {errs.detail}
        </p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={submit} disabled={busy} className={clsx("btn-primary disabled:opacity-60", busy && "btn-loading")}>
          {qty} ta sotish
        </button>
      </ModalFooter>
    </Modal>
  );
}

function SettleCell({ label, value, hue }: { label: string; value: string; hue?: string }) {
  return (
    <div className="rounded-[11px] px-1.5 py-1.5" style={{ background: "var(--surface-solid, var(--surface))" }}>
      <div className="text-[9.5px] font-semibold uppercase leading-tight tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-0.5 text-[12.5px] font-extrabold tabular-nums" style={{ color: hue ?? "var(--text)" }}>{value}</div>
    </div>
  );
}
