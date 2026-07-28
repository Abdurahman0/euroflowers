"use client";
import { useMemo, useState } from "react";
import { Banknote, CreditCard, Minus, Plus, Tag } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import { fmt } from "@/lib/format";
import type { CatalogItem, PaymentType } from "@/lib/types";

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
 */
export default function KatalogSellModal({
  item,
  onClose,
  onSold,
}: {
  item: CatalogItem;
  onClose: () => void;
  onSold: (updated: CatalogItem) => void;
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
    try {
      const updated = await api.sellCatalogItem(item.id, {
        quantity: qty,
        payment_type: payment,
        ...(discountOn ? { sale_price: salePrice.toFixed(2), discount_reason: reason.trim() || undefined } : {}),
      });
      showToast(
        calc.totalDiscount > 0
          ? `✓ ${qty} ta sotildi · chegirma ${fmt(calc.totalDiscount)}`
          : `✓ «${item.name_uz || item.name_ru}»: ${qty} ta sotildi`
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
