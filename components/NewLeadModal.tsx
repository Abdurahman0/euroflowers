"use client";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import { Icon } from "./icons";
import type { Customer, FlowerVariant, Lead, StockBatch } from "@/lib/types";

/**
 * Operator leadni qo'lda qo'shadi — telefon qo'ng'irog'i yoki do'kondagi
 * so'rov uchun. Mijoz mavjudlaridan tanlanadi (yo'q bo'lsa avval
 * «Mijoz qo'shish» orqali yaratiladi).
 */
export default function NewLeadModal({
  customers,
  onClose,
  onSaved,
}: {
  customers: Customer[];
  onClose: () => void;
  onSaved: (l: Lead) => void;
}) {
  const { user, showToast } = useStore();
  const branches = user?.profile.branches ?? [];
  const [f, setF] = useState({
    customer: customers[0]?.id ?? 0,
    branch: branches[0]?.id ?? 0,
    request_uz: "",
    arrangement_type: "",
    estimated_price: "",
    desired_date: "",
  });
  const [busy, setBusy] = useState(false);
  // qaysi gul sotib olinayotgani — tanlov ro'yxati (so'rov matniga yoziladi)
  const [variants, setVariants] = useState<FlowerVariant[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [items, setItems] = useState<{ v: FlowerVariant; qty: number }[]>([]);
  const [pickVariant, setPickVariant] = useState<number>(0);
  const [pickQty, setPickQty] = useState("10");

  useEffect(() => {
    api.flowerVariants({ is_active: true }).then(setVariants).catch(() => {});
    api.stockBatches({ is_active: true }).then(setBatches).catch(() => {});
  }, []);

  const vLabel = (v: FlowerVariant) => `${v.flower_detail?.name_uz ?? ""} — ${v.name_uz || v.name_ru}`.trim();

  // skladdagi eng so'nggi partiya narxi bo'yicha taxminiy summa
  const stemPrice = (variantId: number): number | null => {
    const b = batches.find((x) => x.variant_detail?.id === variantId || x.variant === variantId);
    return b ? Math.round(+b.sale_price_per_stem) || null : null;
  };
  const flowersTotal = useMemo(
    () => items.reduce((sum, it) => {
      const p = stemPrice(it.v.id);
      return p == null || sum == null ? null : sum + p * it.qty;
    }, 0 as number | null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, batches]
  );

  const addItem = () => {
    const v = variants.find((x) => x.id === pickVariant);
    const qty = +pickQty || 0;
    if (!v || qty <= 0) return showToast("Gul navini va sonini tanlang");
    setItems((xs) => {
      const i = xs.findIndex((x) => x.v.id === v.id);
      return i >= 0 ? xs.map((x, j) => (j === i ? { ...x, qty: x.qty + qty } : x)) : [...xs, { v, qty }];
    });
    setPickQty("10");
  };

  const save = async () => {
    if (!f.customer) return showToast("Mijozni tanlang");
    if (!f.request_uz.trim() && items.length === 0) return showToast("So'rov matnini kiriting yoki gul tanlang");
    setBusy(true);
    try {
      const flowersLine = items.length
        ? "\n🌸 Gullar: " + items.map((it) => `${vLabel(it.v)} × ${it.qty}`).join("; ")
        : "";
      const l = await api.createLead({
        customer: f.customer,
        branch: f.branch,
        request_uz: (f.request_uz.trim() + flowersLine).trim(),
        arrangement_type: (f.arrangement_type || "") as Lead["arrangement_type"],
        estimated_price: f.estimated_price ? String(+f.estimated_price) : null,
        desired_date: f.desired_date || null,
        source: "manual",
        status: "new",
      });
      showToast("✓ Lead qo'shildi");
      onSaved(l);
    } catch (e) {
      showToast(e instanceof ApiError ? `Saqlab bo'lmadi: ${JSON.stringify(e.body)}` : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader icon={<Icon name="crm" />} title="Yangi lead" sub="Qo'lda kiritish — qo'ng'iroq yoki do'kondagi so'rov" onClose={onClose} />
      <Section>Lead ma&apos;lumotlari</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mijoz" span>
          <Select
            value={f.customer}
            onChange={(v) => setF({ ...f, customer: +v })}
            placeholder={customers.length ? "Mijozni tanlang" : "Avval mijoz qo'shing"}
            options={customers.map((c) => ({
              value: c.id,
              label: c.name || `@${c.instagram_username}` || c.phone || c.masked_phone || `#${c.id}`,
              sub: c.phone || c.masked_phone || undefined,
            }))}
          />
        </Field>
        <Field label="So'rov" span>
          <textarea
            className="inp min-h-[80px] resize-y"
            value={f.request_uz}
            onChange={(e) => setF({ ...f, request_uz: e.target.value })}
            placeholder="Masalan: 25 dona qizil atirgul, yubiley uchun"
            autoFocus
          />
        </Field>
        <Field label="Gullar (qaysi gul sotib olinmoqda)" span>
          <span className="flex flex-col gap-2">
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <Select
                  value={pickVariant}
                  onChange={(v) => setPickVariant(+v)}
                  placeholder={variants.length ? "Gul navini tanlang" : "Navlar yuklanmoqda…"}
                  options={variants.map((v) => ({
                    value: v.id,
                    label: vLabel(v),
                    sub: stemPrice(v.id) != null ? `${stemPrice(v.id)!.toLocaleString("ru")} so'm/dona` : undefined,
                  }))}
                />
              </span>
              <input
                className="inp !w-[64px] shrink-0 text-right"
                inputMode="numeric"
                value={pickQty}
                onChange={(e) => setPickQty(e.target.value.replace(/\D/g, ""))}
                aria-label="Soni (dona)"
              />
              <button type="button" onClick={addItem} className="icon-btn shrink-0 border" style={{ borderColor: "var(--border)" }} title="Gul qo'shish" aria-label="Gul qo'shish">
                <Plus size={16} strokeWidth={1.75} />
              </button>
            </span>
            {items.length > 0 && (
              <span className="flex flex-wrap gap-1.5">
                {items.map((it) => (
                  <span key={it.v.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold normal-case tracking-normal" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text)" }}>
                    🌸 {vLabel(it.v)} × {it.qty}
                    <button type="button" onClick={() => setItems((xs) => xs.filter((x) => x.v.id !== it.v.id))} aria-label={`${vLabel(it.v)} olib tashlash`} className="opacity-60 transition-opacity hover:opacity-100">
                      <X size={12} strokeWidth={2} />
                    </button>
                  </span>
                ))}
              </span>
            )}
            {items.length > 0 && flowersTotal != null && (
              <button
                type="button"
                onClick={() => setF({ ...f, estimated_price: String(flowersTotal) })}
                className="self-start text-[12px] font-semibold underline-offset-2 hover:underline normal-case tracking-normal"
                style={{ color: "var(--primary)" }}
              >
                Sklad narxi bo&apos;yicha: {flowersTotal.toLocaleString("ru")} so&apos;m — narxga qo&apos;llash
              </button>
            )}
          </span>
        </Field>
        <Field label="Turi">
          <Select
            value={f.arrangement_type}
            onChange={(v) => setF({ ...f, arrangement_type: String(v) })}
            placeholder="Tanlang"
            options={[
              { value: "bouquet", label: "Buket" },
              { value: "basket", label: "Savat" },
              { value: "stems", label: "Donalab" },
              { value: "catalog", label: "Katalog" },
            ]}
          />
        </Field>
        <Field label="Taxminiy narx (so'm)">
          <input className="inp" type="number" value={f.estimated_price} onChange={(e) => setF({ ...f, estimated_price: e.target.value })} placeholder="750000" />
        </Field>
        <Field label="Kerakli sana">
          <input className="inp" type="date" value={f.desired_date} onChange={(e) => setF({ ...f, desired_date: e.target.value })} />
        </Field>
        <Field label="Filial">
          <Select
            value={f.branch}
            onChange={(v) => setF({ ...f, branch: +v })}
            options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.code }))}
          />
        </Field>
      </div>
      <ModalFooter>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Leadni qo'shish"}</button>
        <button onClick={onClose} className="rounded-[14px] border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-5 py-3 text-sm font-bold">Bekor</button>
      </ModalFooter>
    </Modal>
  );
}
