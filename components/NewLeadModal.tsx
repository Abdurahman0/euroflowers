"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import DatePicker from "./DatePicker";
import { StockUsagePicker, MaterialUsagePicker, type PackRow, type StockRow } from "./UsagePicker";
import { Icon } from "./icons";
import type { Customer, Lead, Packaging, StockBatch } from "@/lib/types";

/**
 * Operator leadni qo'lda qo'shadi — telefon qo'ng'irog'i yoki do'kondagi so'rov.
 * Yangi mijoz uchun oldindan customer yaratish SHART EMAS: ism + telefon yuboriladi,
 * backend telefonni normalize qilib mavjud mijozga bog'laydi yoki yangisini yaratadi.
 * Gul (sklad partiyasi) va material sarfi shu yerda kiritiladi — lead «Sotildi»
 * bo'lganda backend sklad qoldig'ini AVTOMATIK kamaytiradi.
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
  const [mode, setMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");
  const [f, setF] = useState({
    customer: customers[0]?.id ?? 0,
    customer_name: "",
    customer_phone: "",
    branch: branches[0]?.id ?? 0,
    request_uz: "",
    arrangement_type: "",
    estimated_price: "",
    florist_fee: "",
    desired_date: "",
  });
  const [busy, setBusy] = useState(false);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [materials, setMaterials] = useState<Packaging[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [packRows, setPackRows] = useState<PackRow[]>([]);
  const [priceTouched, setPriceTouched] = useState(false);

  useEffect(() => {
    api.stockBatches({ is_active: true }).then((bs) => setBatches(bs.filter((b) => b.remaining_stems > 0))).catch(() => {});
    api.materials({ is_active: true }).then(setMaterials).catch(() => {});
    // florist xizmat haqi — biznes sozlamalaridagi standart qiymat bilan boshlanadi
    api.settings().then((s) => {
      setF((prev) => (prev.florist_fee ? prev : { ...prev, florist_fee: String(Math.round(+s.default_florist_fee) || "") }));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sklad narxlari bo'yicha taxminiy summa: gullar + materiallar + florist haqi
  const usageTotal = useMemo(() => {
    const flowersSum = stockRows.reduce((s, r) => {
      const b = batches.find((x) => x.id === r.stock_batch);
      return s + (b ? Math.round(+b.sale_price_per_stem) * r.quantity_stems : 0);
    }, 0);
    const packSum = packRows.reduce((s, r) => {
      const m = materials.find((x) => x.id === r.packaging);
      return s + (m ? Math.round(+m.sale_price) * r.quantity : 0);
    }, 0);
    return flowersSum + packSum;
  }, [stockRows, packRows, batches, materials]);
  const suggested = usageTotal + (+f.florist_fee || 0);

  // sarf tanlanganda taxminiy narx AVTOMATIK to'ladi (qo'lda kiritilgunga qadar)
  useEffect(() => {
    if (priceTouched) return;
    if ((stockRows.length || packRows.length) && suggested > 0) {
      setF((prev) => ({ ...prev, estimated_price: String(suggested) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested, stockRows.length, packRows.length, priceTouched]);

  const save = async () => {
    if (mode === "existing" && !f.customer) return showToast("Mijozni tanlang");
    if (mode === "new" && !f.customer_phone.trim()) return showToast("Yangi mijoz telefonini kiriting");
    if (!f.request_uz.trim() && stockRows.length === 0) return showToast("So'rov matnini kiriting yoki gul tanlang");
    setBusy(true);
    try {
      const l = await api.createLead({
        ...(mode === "existing"
          ? { customer: f.customer }
          : { customer_name: f.customer_name.trim(), customer_phone: f.customer_phone.trim() }),
        branch: f.branch,
        request_uz: f.request_uz.trim(),
        arrangement_type: (f.arrangement_type || "") as Lead["arrangement_type"],
        estimated_price: f.estimated_price ? String(+f.estimated_price) : null,
        florist_fee: f.florist_fee ? String(+f.florist_fee) : null,
        desired_date: f.desired_date || null,
        source: "manual",
        status: "new",
        stock_usage_input: stockRows.map((r) => {
          const b = batches.find((x) => x.id === r.stock_batch);
          const perBunch = b?.stems_per_bunch || 0;
          return {
            stock_batch: r.stock_batch,
            quantity_stems: r.quantity_stems,
            ...(perBunch > 0 ? { quantity_bunches: (r.quantity_stems / perBunch).toFixed(2) } : {}),
          };
        }),
        packaging_usage_input: packRows,
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
      <Section>Mijoz</Section>
      <div className="mb-3 flex gap-1.5">
        {(["existing", "new"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={clsx("rounded-full border-[1.5px] px-4 py-1.5 text-[12.5px] font-bold transition-colors", mode === m && "text-white")}
            style={mode === m ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--border)", color: "var(--muted)" }}
          >
            {m === "existing" ? "Mavjud mijoz" : "Yangi mijoz"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {mode === "existing" ? (
          <Field label="Mijoz" span>
            <Select
              value={f.customer}
              onChange={(v) => setF({ ...f, customer: +v })}
              placeholder={customers.length ? "Mijozni tanlang" : "Mijoz yo'q — «Yangi mijoz»ni tanlang"}
              options={customers.map((c) => ({
                value: c.id,
                label: c.name || `@${c.instagram_username}` || c.phone || c.masked_phone || `#${c.id}`,
                sub: c.phone || c.masked_phone || undefined,
              }))}
            />
          </Field>
        ) : (
          <>
            <Field label="Mijoz ismi">
              <input className="inp" value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} placeholder="Ali Valiyev" autoFocus />
            </Field>
            <Field label="Telefon">
              <input className="inp" inputMode="tel" value={f.customer_phone} onChange={(e) => setF({ ...f, customer_phone: e.target.value })} placeholder="90 123 45 67" />
            </Field>
          </>
        )}
        <Field label="So'rov" span>
          <textarea
            className="inp min-h-[80px] resize-y"
            value={f.request_uz}
            onChange={(e) => setF({ ...f, request_uz: e.target.value })}
            placeholder="Masalan: 3 pochka Freedom atirguldan savat"
            autoFocus={mode === "existing"}
          />
        </Field>
      </div>

      <Section>Sklad sarfi (sotilganda avtomatik kamayadi)</Section>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Gullar (sklad partiyasidan)" span>
          <StockUsagePicker batches={batches} rows={stockRows} onChange={setStockRows} />
        </Field>
        <Field label="Material / savat" span>
          <MaterialUsagePicker materials={materials} rows={packRows} onChange={setPackRows} />
        </Field>
      </div>

      <Section>Narx va yetkazish</Section>
      <div className="grid grid-cols-2 gap-3">
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
        <Field label="Florist haqi (so'm)">
          <input
            className="inp"
            type="number"
            value={f.florist_fee}
            onChange={(e) => setF({ ...f, florist_fee: e.target.value })}
            placeholder="50000"
          />
        </Field>
        <Field label="Taxminiy narx (so'm)">
          <input
            className="inp"
            type="number"
            value={f.estimated_price}
            onChange={(e) => { setPriceTouched(true); setF({ ...f, estimated_price: e.target.value }); }}
            placeholder="750000"
          />
        </Field>
        <Field label="Kerakli sana">
          <DatePicker value={f.desired_date} onChange={(v) => setF({ ...f, desired_date: v })} disablePast placeholder="Yetkazish sanasi" ariaLabel="Kerakli sana" />
        </Field>
        <Field label="Filial" span>
          <Select
            value={f.branch}
            onChange={(v) => setF({ ...f, branch: +v })}
            options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.code }))}
          />
        </Field>
      </div>
      {(stockRows.length > 0 || packRows.length > 0) && suggested > 0 && (
        <button
          type="button"
          onClick={() => { setPriceTouched(false); setF((prev) => ({ ...prev, estimated_price: String(suggested) })); }}
          className="mt-2 self-start text-[12px] font-semibold underline-offset-2 hover:underline"
          style={{ color: "var(--primary)" }}
        >
          Sklad narxi bo&apos;yicha: {suggested.toLocaleString("ru")} so&apos;m
          {+f.florist_fee ? ` (florist haqi bilan)` : ""} — qayta qo&apos;llash
        </button>
      )}
      <ModalFooter>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Leadni qo'shish"}</button>
        <button onClick={onClose} className="rounded-[14px] border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-5 py-3 text-sm font-bold">Bekor</button>
      </ModalFooter>
    </Modal>
  );
}
