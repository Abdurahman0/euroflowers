"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import DatePicker from "./DatePicker";
import { StockUsagePicker, MaterialUsagePicker, CatalogUsagePicker, type CatalogRow, type PackRow, type StockRow } from "./UsagePicker";
import { Icon } from "./icons";
import type { CatalogItem, Customer, Lead, Packaging, StockBatch } from "@/lib/types";

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
  const { showToast } = useStore();
  const [mode, setMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");
  const [f, setF] = useState({
    customer: customers[0]?.id ?? 0,
    customer_name: "",
    customer_phone: "",
    request_uz: "",
    arrangement_type: "",
    estimated_price: "",
    florist_fee: "",
    delivery_at: "", // lokal "YYYY-MM-DDTHH:mm"
    recall_at: "",
  });
  // standart: eslatma avtomatik (yetkazishdan 1 soat oldin — backend qiladi)
  const [customRecall, setCustomRecall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [materials, setMaterials] = useState<Packaging[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [packRows, setPackRows] = useState<PackRow[]>([]);
  const [catRows, setCatRows] = useState<CatalogRow[]>([]);
  const [priceTouched, setPriceTouched] = useState(false);
  // Turi = «Katalog» — gul skladdan emas, tayyor katalog pozitsiyasidan tanlanadi
  const isCatalog = f.arrangement_type === "catalog";

  useEffect(() => {
    api.stockBatches({ is_active: true }).then((bs) => setBatches(bs.filter((b) => b.remaining_stems > 0))).catch(() => {});
    api.materials({ is_active: true }).then(setMaterials).catch(() => {});
    api.catalog({ status: "available" }).then(setCatalogItems).catch(() => {});
    // florist xizmat haqi — biznes sozlamalaridagi standart qiymat bilan boshlanadi
    api.settings().then((s) => {
      setF((prev) => (prev.florist_fee ? prev : { ...prev, florist_fee: String(Math.round(+s.default_florist_fee) || "") }));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // taxminiy summa: katalog rejimida — tayyor gul narxi (florist haqi ichida);
  // aks holda gullar + materiallar + florist haqi
  const usageTotal = useMemo(() => {
    if (isCatalog) {
      return catRows.reduce((s, r) => s + Math.round(+r.item.price) * r.qty, 0);
    }
    const flowersSum = stockRows.reduce((s, r) => {
      const b = batches.find((x) => x.id === r.stock_batch);
      return s + (b ? Math.round(+b.sale_price_per_stem) * r.quantity_stems : 0);
    }, 0);
    const packSum = packRows.reduce((s, r) => {
      const m = materials.find((x) => x.id === r.packaging);
      return s + (m ? Math.round(+m.sale_price) * r.quantity : 0);
    }, 0);
    return flowersSum + packSum;
  }, [isCatalog, catRows, stockRows, packRows, batches, materials]);
  const suggested = usageTotal + (isCatalog ? 0 : +f.florist_fee || 0);
  const hasUsage = isCatalog ? catRows.length > 0 : stockRows.length > 0 || packRows.length > 0;

  // sarf tanlanganda taxminiy narx AVTOMATIK to'ladi (qo'lda kiritilgunga qadar)
  useEffect(() => {
    if (priceTouched) return;
    if (hasUsage && suggested > 0) {
      setF((prev) => ({ ...prev, estimated_price: String(suggested) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested, hasUsage, priceTouched]);

  const save = async () => {
    if (mode === "existing" && !f.customer) return showToast("Mijozni tanlang");
    if (mode === "new" && !f.customer_phone.trim()) return showToast("Yangi mijoz telefonini kiriting");
    if (!f.request_uz.trim() && !hasUsage) return showToast("So'rov matnini kiriting yoki gul tanlang");
    setBusy(true);
    try {
      // katalog rejimi: tanlangan tayyor gullar tarkibi partiya bo'yicha
      // birlashtirilib sarf sifatida yuboriladi (won'da sklad shulardan kamayadi)
      let stockInput;
      if (isCatalog) {
        const byBatch = new Map<number, number>();
        for (const r of catRows) {
          for (const c of r.item.composition) {
            byBatch.set(c.stock_batch, (byBatch.get(c.stock_batch) ?? 0) + c.quantity_stems * r.qty);
          }
        }
        stockInput = Array.from(byBatch, ([stock_batch, quantity_stems]) => {
          const b = batches.find((x) => x.id === stock_batch);
          const perBunch = b?.stems_per_bunch || 0;
          return {
            stock_batch,
            quantity_stems,
            ...(perBunch > 0 ? { quantity_bunches: (quantity_stems / perBunch).toFixed(2) } : {}),
          };
        });
      } else {
        stockInput = stockRows.map((r) => {
          const b = batches.find((x) => x.id === r.stock_batch);
          const perBunch = b?.stems_per_bunch || 0;
          return {
            stock_batch: r.stock_batch,
            quantity_stems: r.quantity_stems,
            ...(perBunch > 0 ? { quantity_bunches: (r.quantity_stems / perBunch).toFixed(2) } : {}),
          };
        });
      }
      const catalogLine = isCatalog && catRows.length
        ? "\nKatalogdan: " + catRows.map((r) => `${r.item.name_uz || r.item.name_ru} × ${r.qty}`).join("; ")
        : "";
      const l = await api.createLead({
        ...(mode === "existing"
          ? { customer: f.customer }
          : { customer_name: f.customer_name.trim(), customer_phone: f.customer_phone.trim() }),
        request_uz: (f.request_uz.trim() + catalogLine).trim(),
        arrangement_type: (f.arrangement_type || "") as Lead["arrangement_type"],
        estimated_price: f.estimated_price ? String(+f.estimated_price) : null,
        // katalog narxi florist haqini o'z ichiga oladi — alohida yuborilmaydi
        florist_fee: !isCatalog && f.florist_fee ? String(+f.florist_fee) : null,
        // yetkazish vaqti; recall yuborilmasa backend avto −1 soat qiladi
        delivery_at: f.delivery_at ? new Date(f.delivery_at).toISOString() : null,
        recall_at: customRecall && f.recall_at ? new Date(f.recall_at).toISOString() : null,
        source: "manual",
        status: "new",
        stock_usage_input: stockInput,
        packaging_usage_input: isCatalog ? [] : packRows,
      });
      showToast("✓ Buyurtma qo'shildi");
      onSaved(l);
    } catch (e) {
      showToast(e instanceof ApiError ? `Saqlab bo'lmadi: ${JSON.stringify(e.body)}` : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader icon={<Icon name="crm" />} title="Yangi buyurtma" sub="Qo'lda kiritish — qo'ng'iroq yoki do'kondagi so'rov" onClose={onClose} />
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
        <Field label="Turi" span>
          <Select
            value={f.arrangement_type}
            onChange={(v) => setF({ ...f, arrangement_type: String(v) })}
            placeholder="Tanlang"
            options={[
              { value: "bouquet", label: "Buket" },
              { value: "basket", label: "Savat" },
              { value: "stems", label: "Donalab" },
              { value: "catalog", label: "Katalog (tayyor gul)" },
            ]}
          />
        </Field>
      </div>

      <Section>Sklad sarfi (sotilganda avtomatik kamayadi)</Section>
      <div className="grid grid-cols-1 gap-3">
        {isCatalog ? (
          <Field label="Katalogdagi tayyor gullar" span>
            <span className="flex flex-col gap-1.5">
              <CatalogUsagePicker items={catalogItems} rows={catRows} onChange={setCatRows} />
              <span className="text-[11.5px] normal-case tracking-normal" style={{ color: "var(--muted)" }}>
                Tayyor gul tanlanadi — tarkibidagi partiyalar sotilganda skladdan avtomatik yechiladi.
              </span>
            </span>
          </Field>
        ) : (
          <>
            <Field label="Gullar (sklad partiyasidan)" span>
              <StockUsagePicker batches={batches} rows={stockRows} onChange={setStockRows} />
            </Field>
            <Field label="Material / savat" span>
              <MaterialUsagePicker materials={materials} rows={packRows} onChange={setPackRows} />
            </Field>
          </>
        )}
      </div>

      <Section>Narx va yetkazish</Section>
      <div className="grid grid-cols-2 gap-3">
        {!isCatalog && (
          <Field label="Florist haqi (so'm)">
            <input
              className="inp"
              type="number"
              value={f.florist_fee}
              onChange={(e) => setF({ ...f, florist_fee: e.target.value })}
              placeholder="50000"
            />
          </Field>
        )}
        <Field label="Taxminiy narx (so'm)">
          <input
            className="inp"
            type="number"
            value={f.estimated_price}
            onChange={(e) => { setPriceTouched(true); setF({ ...f, estimated_price: e.target.value }); }}
            placeholder="750000"
          />
        </Field>
        <Field label="Yetkazish vaqti" span={isCatalog}>
          <DatePicker value={f.delivery_at} onChange={(v) => setF({ ...f, delivery_at: v })} disablePast withTime placeholder="Sana va vaqt" ariaLabel="Yetkazish vaqti" />
        </Field>
        {f.delivery_at && (
          <div className="col-span-full -mt-1 flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] normal-case tracking-normal" style={{ color: "var(--text-2)" }}>
              <input type="checkbox" checked={customRecall} onChange={(e) => setCustomRecall(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              Qo&apos;ng&apos;iroq eslatmasini o&apos;zim belgilayman
              <span style={{ color: "var(--muted)" }}>(aks holda avtomatik: yetkazishdan 1 soat oldin)</span>
            </label>
            {customRecall && (
              <DatePicker value={f.recall_at} onChange={(v) => setF({ ...f, recall_at: v })} disablePast withTime placeholder="Eslatma sanasi va vaqti" ariaLabel="Eslatma vaqti" />
            )}
          </div>
        )}
      </div>
      {hasUsage && suggested > 0 && (
        <button
          type="button"
          onClick={() => { setPriceTouched(false); setF((prev) => ({ ...prev, estimated_price: String(suggested) })); }}
          className="mt-2 self-start text-[12px] font-semibold underline-offset-2 hover:underline"
          style={{ color: "var(--primary)" }}
        >
          {isCatalog ? "Katalog narxi bo'yicha" : "Sklad narxi bo'yicha"}: {suggested.toLocaleString("ru")} so&apos;m
          {!isCatalog && +f.florist_fee ? ` (florist haqi bilan)` : ""} — qayta qo&apos;llash
        </button>
      )}
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Buyurtmani qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}
