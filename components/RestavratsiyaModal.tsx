"use client";
import { AlertTriangle, ChevronDown, Plus, Recycle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalHeader, ModalFooter, Section, Field } from "./Modal";
import Select, { type SelectOption } from "./Select";
import { fmt } from "@/lib/format";
import { ARRANGEMENT_LABEL } from "./badges";
import {
  catalogRemaining, itemStemsPerUnit, reworkTotals, buildReworkPayload, perUnitLabel,
  outputTotalStems, emptyOutput,
  type ReworkSourceDraft, type ReworkStockDraft, type ReworkOutputDraft,
} from "@/lib/rework";
import type { CatalogItem, FloristProfile, Packaging, StockBatch } from "@/lib/types";

const ARR_OPTS: SelectOption[] = ["bouquet", "basket", "box"].map((v) => ({ value: v, label: ARRANGEMENT_LABEL[v] ?? v }));

const batchName = (b: StockBatch | undefined, id: number): string =>
  b ? [b.variant_detail?.flower_detail?.name_uz, b.variant_detail?.name_uz].filter(Boolean).join(" ") || b.batch_number : `Partiya #${id}`;

/**
 * RESTAVRATSIYA — tayyor katalogni buzib, undan yangi mahsulot(lar) yasash.
 * Spec: FRONTEND_CATALOG_REWORK_API.md · POST /api/catalog-reworks/
 *
 * ⚠️ QAYTMAS AMAL — OpenAPI'da `{id}/` FAQAT GET. Bekor qilish, tahrirlash yoki
 * o'chirish yo'li YO'Q: saqlangach buzilgan katalog qaytmaydi, sklad kamayadi,
 * yangi kataloglar tug'iladi. Shu bois tugma matni ogohlantiradi.
 *
 * ⚠️ Butun hisob `lib/rework.ts` da (Vitest bilan qulflangan) — bu fayl faqat UI.
 */
export default function RestavratsiyaModal({
  source = null, onClose, onSaved,
}: { source?: CatalogItem | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useStore();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  const [materials, setMaterials] = useState<Packaging[]>([]);

  const [sources, setSources] = useState<ReworkSourceDraft[]>(
    source ? [{ catalog_item: source.id, quantity: 1 }] : []
  );
  const [stock, setStock] = useState<ReworkStockDraft[]>([]);
  const [outputs, setOutputs] = useState<ReworkOutputDraft[]>([emptyOutput()]);
  const [florist, setFlorist] = useState(0);
  // ⚠️ QO'LDA — hajm tarifi bu yerda ISHLATILMAYDI (spec 4-qoida). Hech qanday
  // prefill yo'q: aks holda operator ko'rmagan raqam oylikka tushib ketardi.
  const [floristAmount, setFloristAmount] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<number | null>(0);   // ochiq chiqim kartasi
  const [extra, setExtra] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ lines: string[]; fields?: Record<string, string> } | null>(null);

  useEffect(() => {
    // buzish uchun QOLDIG'I bor kataloglar (server sahifalaydi — katta limit bilan olamiz)
    api.catalog({ page_size: 500 }).then((r) => {
      const list = r.filter((i) => catalogRemaining(i) > 0 || i.id === source?.id);
      setItems(source && !list.some((i) => i.id === source.id) ? [source, ...list] : list);
    }).catch(() => showToast("Katalogni yuklab bo'lmadi"));
    api.stockBatches({ is_active: true }).then(setBatches).catch(() => {});
    api.florists().then(setFlorists).catch(() => {});
    api.materials({ is_active: true }).then(setMaterials).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const batchOf = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches]);
  const batchLabel = (id: number) => batchName(batchOf.get(id), id);
  const batchCost = (id: number) => Math.round(+(batchOf.get(id)?.cost_per_stem ?? 0)) || 0;

  const t = useMemo(() => reworkTotals({ sources, stock, outputs, florist, floristAmount, byId, batchLabel, batchCost }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sources, stock, outputs, florist, floristAmount, byId, batchOf]);

  /* ── tanlagich variantlari ── */
  const sourceOpts: SelectOption[] = items
    .filter((i) => !sources.some((s) => s.catalog_item === i.id))
    .map((i) => ({ value: i.id, label: i.name_uz ?? `#${i.id}`, sub: `${itemStemsPerUnit(i)} dona/dona`, hint: `${catalogRemaining(i)} dona` }));
  // ⚠️ Qoldig'i tugagan partiya KO'RSATILMAYDI — server baribir 400 qaytaradi.
  const stockOpts: SelectOption[] = batches.filter((b) => b.remaining_stems > 0)
    .map((b) => ({ value: b.id, label: batchName(b, b.id), sub: b.batch_number, hint: `${b.remaining_stems} dona` }));
  // Tarkib uchun: mavjud gullar (buzilgan katalog partiyalari + skladdan olinganlar) OLDINDA.
  const compOpts: SelectOption[] = useMemo(() => {
    const have = new Set(t.batches.filter((b) => b.available > 0).map((b) => b.stock_batch));
    const rank = (id: number) => (have.has(id) ? 0 : 1);
    const all = new Map<number, SelectOption>();
    for (const b of t.batches) if (b.available > 0) all.set(b.stock_batch, { value: b.stock_batch, label: b.label, sub: "Kirimda bor", hint: `${b.available} dona` });
    for (const b of batches) if (!all.has(b.id) && b.remaining_stems > 0) all.set(b.id, { value: b.id, label: batchName(b, b.id), sub: b.batch_number, hint: `${b.remaining_stems} dona` });
    return Array.from(all.values()).sort((a, b) => rank(+a.value) - rank(+b.value));
  }, [t.batches, batches]);
  const floristOpts: SelectOption[] = florists.map((fl) => {
    const u = fl.user_detail;
    return { value: fl.id, label: [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.username || `#${fl.id}` };
  });
  const matOpts: SelectOption[] = materials.map((m) => ({ value: m.id, label: m.name_uz ?? `#${m.id}` }));

  /* ── chiqim kartasini o'zgartirish ── */
  const setOut = (i: number, patch: Partial<ReworkOutputDraft>) =>
    setOutputs((o) => o.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    if (!t.ok || busy) return;
    setBusy(true); setErr(null);
    try {
      await api.createCatalogRework(buildReworkPayload({ florist, floristAmount, note, sources, stock, outputs }));
      showToast("Restavratsiya saqlandi");
      onSaved();
    } catch (e) {
      // ⚠️ Spec'dagi 400 lar {"detail": "..."} — AYNAN ko'rsatiladi (tarjima qilinmaydi).
      // DRF maydon xatolari esa alohida ro'yxat bo'lib chiqadi.
      const ae = e as ApiError;
      setErr({ lines: String(ae?.message ?? "Saqlab bo'lmadi").split("\n"), fields: ae?.fieldErrors });
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={620}>
      <ModalHeader
        icon={<Recycle size={20} strokeWidth={1.75} />}
        title="Restavratsiya"
        sub="Tayyor mahsulotni buzib, yangisini yasash"
        onClose={onClose}
      />

      {/* 1. BUZILADIGAN MAHSULOT */}
      <Section>Buziladigan mahsulot</Section>
      <div className="flex flex-col gap-2">
        {sources.map((s, i) => {
          const it = byId.get(s.catalog_item);
          const left = catalogRemaining(it);
          const per = itemStemsPerUnit(it);
          const over = s.quantity > left;
          return (
            <div key={i} className="rounded-[13px] border p-2.5" style={{ borderColor: over ? "var(--danger-ink)" : "var(--border)" }}>
              <div className="grid grid-cols-[1fr_84px_32px] items-center gap-2">
                <Select searchable value={s.catalog_item} placeholder="Katalogdan tanlash"
                  options={[...(it ? [{ value: it.id, label: it.name_uz ?? `#${it.id}`, hint: `${left} dona` }] : []), ...sourceOpts]}
                  onChange={(v) => setSources(sources.map((x, j) => (j === i ? { ...x, catalog_item: +v, quantity: 1 } : x)))} />
                <input className="inp !py-1.5" type="number" min={1} max={left || 1} value={s.quantity}
                  onChange={(e) => setSources(sources.map((x, j) => (j === i ? { ...x, quantity: Math.max(+e.target.value || 1, 1) } : x)))} />
                <button type="button" onClick={() => setSources(sources.filter((_, j) => j !== i))} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11.5px]">
                <span style={{ color: over ? "var(--danger-ink)" : "var(--muted)" }}>
                  {over ? `${it?.name_uz} katalogida atigi ${left} dona qolgan` : it ? `${per} dona/dona → ${per * s.quantity} dona · qoldiq ${left}` : ""}
                </span>
                {it && <span className="font-semibold" style={{ color: "var(--acc)" }}>{fmt((+(it.profit?.unit_cost ?? it.calculated_cost_price ?? 0)) * s.quantity)}</span>}
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => setSources([...sources, { catalog_item: 0, quantity: 1 }])}
          className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3.5 py-1.5 text-[12px] font-bold">
          <Plus size={15} strokeWidth={1.75} className="mr-1 inline" />Katalogdan tanlash
        </button>
        <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
          Buzilgan mahsulotning guli <b>skladdan qayta yechilmaydi</b> — u katalog yasalganda yechilgan, endi to&apos;g&apos;ridan-to&apos;g&apos;ri yangi mahsulotga o&apos;tadi.
        </p>
      </div>

      {/* 2. SKLADDAN QO'SHIMCHA GUL */}
      <Section>Skladdan qo&apos;shimcha gul</Section>
      <div className="flex flex-col gap-2">
        {stock.map((r, i) => {
          const b = batchOf.get(r.stock_batch);
          const qty = Math.round(+r.quantity_stems || 0);
          const over = !!b && qty > b.remaining_stems;
          return (
            <div key={i} className="rounded-[13px] border p-2.5" style={{ borderColor: over ? "var(--danger-ink)" : "var(--border)" }}>
              <div className="grid grid-cols-[1fr_92px_32px] items-center gap-2">
                <Select searchable value={r.stock_batch} placeholder="Partiyadan tanlash"
                  options={[...(b ? [{ value: b.id, label: batchName(b, b.id), hint: `${b.remaining_stems} dona` }] : []), ...stockOpts.filter((o) => o.value !== r.stock_batch)]}
                  onChange={(v) => setStock(stock.map((x, j) => (j === i ? { ...x, stock_batch: +v } : x)))} />
                <input className="inp !py-1.5" type="number" min={1} value={r.quantity_stems} placeholder="40"
                  onChange={(e) => setStock(stock.map((x, j) => (j === i ? { ...x, quantity_stems: e.target.value } : x)))} />
                <button type="button" onClick={() => setStock(stock.filter((_, j) => j !== i))} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11.5px]">
                <span style={{ color: over ? "var(--danger-ink)" : "var(--muted)" }}>
                  {over ? `${b?.batch_number} partiyasida atigi ${b?.remaining_stems} dona qolgan` : b ? `${b.remaining_stems} dona bor · sklad ${qty} dona kamayadi` : ""}
                </span>
                {qty > 0 && <span className="font-semibold" style={{ color: "var(--acc)" }}>{fmt(batchCost(r.stock_batch) * qty)}</span>}
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => setStock([...stock, { stock_batch: 0, quantity_stems: "" }])}
          className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3.5 py-1.5 text-[12px] font-bold">
          <Plus size={15} strokeWidth={1.75} className="mr-1 inline" />Partiyadan tanlash
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[13px] border px-3.5 py-2.5 text-[12.5px] font-bold"
        style={{ borderColor: "var(--line2)", background: "var(--surface-2)" }}>
        <span>Jami kirim: <b style={{ color: "var(--acc)" }}>{t.inputStems} dona</b> · {fmt(t.inputCost)}</span>
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
          Buzilgan {t.sourceStems} + skladdan {t.stockStems}
        </span>
      </div>

      {/* 3. YANGI MAHSULOTLAR */}
      <Section>Yangi mahsulotlar</Section>
      <div className="flex flex-col gap-2.5">
        {outputs.map((o, i) => {
          const per = o.composition.reduce((a, c) => a + Math.max(Math.round(+c.quantity_stems || 0), 0), 0);
          const qty = Math.max(Math.round(+o.quantity || 0), 0);
          const isOpen = open === i;
          return (
            <div key={i} className="rounded-[14px] border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ChevronDown size={16} strokeWidth={2} className="shrink-0 transition-transform" style={{ transform: isOpen ? undefined : "rotate(-90deg)", color: "var(--text-2)" }} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{o.name_uz || `Mahsulot ${i + 1}`}</span>
                  <span className="shrink-0 text-[11.5px] font-semibold tabular-nums" style={{ color: "var(--muted)" }}>
                    {qty} dona · {perUnitLabel(per, qty).replace(" → jami", " =").replace(" dona", "")}
                  </span>
                </button>
                {outputs.length > 1 && (
                  <button type="button" onClick={() => { setOutputs(outputs.filter((_, j) => j !== i)); setOpen(null); }} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
                )}
              </div>

              {isOpen && (
                <div className="grid grid-cols-2 gap-3 border-t px-3 pb-3.5 pt-3" style={{ borderColor: "var(--border)" }}>
                  <Field label="Nomi" span>
                    <input className="inp" value={o.name_uz} onChange={(e) => setOut(i, { name_uz: e.target.value })} placeholder="Masalan: O'rtancha buket" />
                  </Field>
                  <Field label="Turi"><Select value={o.arrangement_type} options={ARR_OPTS} onChange={(v) => setOut(i, { arrangement_type: String(v) })} /></Field>
                  <Field label="Soni"><input className="inp" type="number" min={1} value={o.quantity} onChange={(e) => setOut(i, { quantity: e.target.value })} /></Field>
                  <Field label="Bir donaning narxi (so'm)" span>
                    <input className="inp" type="number" value={o.price} onChange={(e) => setOut(i, { price: e.target.value })} placeholder="Masalan: 450000" />
                  </Field>

                  <div className="col-span-full">
                    <div className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>Tarkibi — <b>bir dona uchun</b></div>
                    <div className="flex flex-col gap-2">
                      {o.composition.map((c, ci) => (
                        <div key={ci}>
                          <div className="grid grid-cols-[1fr_84px_32px] items-center gap-2">
                            <Select searchable value={c.stock_batch} placeholder="Gulni tanlang" options={compOpts}
                              onChange={(v) => setOut(i, { composition: o.composition.map((x, j) => (j === ci ? { ...x, stock_batch: +v } : x)) })} />
                            <input className="inp !py-1.5" type="number" min={1} value={c.quantity_stems} placeholder="25"
                              onChange={(e) => setOut(i, { composition: o.composition.map((x, j) => (j === ci ? { ...x, quantity_stems: e.target.value } : x)) })} />
                            <button type="button" onClick={() => setOut(i, { composition: o.composition.filter((_, j) => j !== ci) })} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
                          </div>
                          {/* ⚠️ PER-DONA tuzog'i — jami AYNAN shu yerda ko'rsatiladi */}
                          {+c.quantity_stems > 0 && (
                            <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                              {perUnitLabel(Math.round(+c.quantity_stems || 0), qty)}
                            </div>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setOut(i, { composition: [...o.composition, { stock_batch: 0, quantity_stems: "" }] })}
                        className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3 py-1 text-[11.5px] font-bold">
                        <Plus size={14} strokeWidth={1.75} className="mr-1 inline" />Gul qo&apos;shish
                      </button>
                    </div>
                  </div>

                  {/* QO'SHIMCHA — yig'iq; tegilmagan maydon payload'ga TUSHMAYDI */}
                  <div className="col-span-full">
                    <button type="button" onClick={() => setExtra((x) => ({ ...x, [i]: !x[i] }))}
                      className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>
                      <ChevronDown size={14} strokeWidth={2} style={{ transform: extra[i] ? undefined : "rotate(-90deg)" }} />Qo&apos;shimcha
                    </button>
                    {extra[i] && (
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <Field label="Hajm"><input className="inp" value={o.volume} onChange={(e) => setOut(i, { volume: e.target.value })} placeholder="Ixtiyoriy" /></Field>
                        <Field label="Balandlik (sm)"><input className="inp" type="number" value={o.height_cm} onChange={(e) => setOut(i, { height_cm: e.target.value })} /></Field>
                        <Field label="Diametr (sm)"><input className="inp" type="number" value={o.diameter_cm} onChange={(e) => setOut(i, { diameter_cm: e.target.value })} /></Field>
                        <Field label="Holati">
                          <Select value={o.status} options={[{ value: "available", label: "Sotuvda" }, { value: "draft", label: "Qoralama" }]} onChange={(v) => setOut(i, { status: String(v) })} />
                        </Field>
                        <Field label="Tavsif" span><textarea className="inp min-h-[56px] resize-y" value={o.description_uz} onChange={(e) => setOut(i, { description_uz: e.target.value })} rows={2} /></Field>
                        <Field label="Ichki izoh" span><input className="inp" value={o.note} onChange={(e) => setOut(i, { note: e.target.value })} /></Field>
                        <div className="col-span-full">
                          <div className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>Qadoq — bir dona uchun</div>
                          <div className="flex flex-col gap-2">
                            {o.materials.map((m, mi) => (
                              <div key={mi} className="grid grid-cols-[1fr_84px_32px] items-center gap-2">
                                <Select searchable value={m.packaging} placeholder="Materialni tanlang" options={matOpts}
                                  onChange={(v) => setOut(i, { materials: o.materials.map((x, j) => (j === mi ? { ...x, packaging: +v } : x)) })} />
                                <input className="inp !py-1.5" type="number" min={1} value={m.quantity} placeholder="1"
                                  onChange={(e) => setOut(i, { materials: o.materials.map((x, j) => (j === mi ? { ...x, quantity: e.target.value } : x)) })} />
                                <button type="button" onClick={() => setOut(i, { materials: o.materials.filter((_, j) => j !== mi) })} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
                              </div>
                            ))}
                            <button type="button" onClick={() => setOut(i, { materials: [...o.materials, { packaging: 0, quantity: "1" }] })}
                              className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3 py-1 text-[11.5px] font-bold">
                              <Plus size={14} strokeWidth={1.75} className="mr-1 inline" />Qadoq qo&apos;shish
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-span-full text-[12px] font-bold" style={{ color: "var(--text-2)" }}>
                    Bu mahsulot: <b style={{ color: "var(--acc)" }}>{outputTotalStems(o)} dona</b> gul
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button type="button" onClick={() => { setOutputs([...outputs, emptyOutput()]); setOpen(outputs.length); }}
          className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3.5 py-1.5 text-[12px] font-bold">
          <Plus size={15} strokeWidth={1.75} className="mr-1 inline" />Mahsulot qo&apos;shish
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[13px] border px-3.5 py-2.5 text-[12.5px] font-bold"
        style={{ borderColor: "var(--line2)", background: "var(--surface-2)" }}>
        <span>Jami chiqim: <b style={{ color: "var(--acc)" }}>{t.outputStems} dona</b></span>
        <span style={{ color: t.wasteStems < 0 ? "var(--danger-ink)" : t.wasteStems > 0 ? "var(--warning-ink)" : "var(--success-ink)" }}>
          Yo&apos;qotish: {t.wasteStems} dona
        </span>
      </div>

      {/* PARTIYA BO'YICHA TEKSHIRUV — qaysi gul yetmayotgani SAQLASHDAN OLDIN ko'rinadi */}
      {t.batches.some((b) => b.needed > 0) && (
        /* ⚠️ `shrink-0` SHART: drawer tanasi `flex flex-col` va `overflow-hidden` bo'lgan
           bolaning avtomatik minimal o'lchami 0 ga tushadi — jadval 2px chiziqqa siqilib,
           partiya yetishmovchiligi KO'RINMAY qolardi (jonli skrinshotda tutildi). */
        <div className="mt-2 shrink-0 overflow-hidden rounded-[13px] border" style={{ borderColor: t.shortBatches.length ? "var(--danger-ink)" : "var(--border)" }}>
          <div className="px-3 py-2 text-[11.5px] font-bold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
            Partiya bo&apos;yicha: mavjud / kerak
          </div>
          {t.batches.filter((b) => b.needed > 0 || b.available > 0).map((b) => (
            <div key={b.stock_batch} className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-[12px]" style={{ borderColor: "var(--border)" }}>
              <span className="min-w-0 truncate">{b.label}</span>
              <span className="shrink-0 tabular-nums font-semibold" style={{ color: b.short > 0 ? "var(--danger-ink)" : "var(--text-2)" }}>
                {b.available} / {b.needed}{b.short > 0 ? ` · ${b.short} dona yetmaydi` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 4. FLORIST */}
      <Section>Florist</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kim ishladi"><Select searchable value={florist} options={floristOpts} placeholder="Floristni tanlang" onChange={(v) => setFlorist(+v)} /></Field>
        <Field label="Haqi (so'm)"><input className="inp" type="number" min={0} value={floristAmount} onChange={(e) => setFloristAmount(e.target.value)} placeholder="Masalan: 150000" /></Field>
        <p className="col-span-full text-[11.5px]" style={{ color: "var(--muted)" }}>
          Haq <b>qo&apos;lda</b> kiritiladi — hajm tarifi qo&apos;llanmaydi, ish hajmi har xil.
          Haq yozilmasa (0) <b>oylik yozuvi yaratilmaydi</b>.
        </p>
        <Field label="Izoh" span>
          <textarea className="inp min-h-[56px] resize-y" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} placeholder="Ixtiyoriy — nima uchun buzildi" />
        </Field>
      </div>

      {/* SERVER XATOSI — spec jadvalidagi `detail` AYNAN ko'rsatiladi */}
      {err && (
        <div className="mt-3 rounded-[14px] border p-3.5" style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 40%, var(--border))", background: "var(--danger-soft, rgba(160,74,74,.10))" }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: "var(--danger-ink)" }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold" style={{ color: "var(--danger-ink)" }}>Saqlab bo&apos;lmadi</div>
              <div className="mt-1 flex flex-col gap-0.5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
                {err.lines.map((ln, i) => <div key={i}>{ln}</div>)}
                {err.fields && Object.entries(err.fields).map(([k, v]) => <div key={k}><b style={{ color: "var(--text)" }}>{k}:</b> {v}</div>)}
              </div>
            </div>
            <button type="button" onClick={() => setErr(null)} className="icon-btn !h-7 !w-7 shrink-0" aria-label="Yopish"><X size={14} strokeWidth={2} /></button>
          </div>
        </div>
      )}

      {/* ⚠️ BLOKLASH SABABI — tugma jimgina o'chmaydi, nega o'chganini aytadi */}
      {!t.ok && (
        <p className="mt-3 rounded-[12px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          {t.reason}
        </p>
      )}
      {t.ok && (
        <p className="mt-3 rounded-[12px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
          Bu amal <b>qaytmaydi</b> — buzilgan mahsulot tiklanmaydi, sklad {t.stockStems} dona kamayadi, {outputs.length} ta yangi mahsulot yaratiladi.
        </p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy || !t.ok} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
      </ModalFooter>
    </Modal>
  );
}
