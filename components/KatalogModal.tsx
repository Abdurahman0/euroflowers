"use client";
import { Info, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import ImageInput from "./ImageInput";
import { Icon } from "./icons";
import { ARRANGEMENT_LABEL } from "./badges";
import { fmt } from "@/lib/format";
import { KIND_LABEL, PACKAGING_LABEL, VOLUME_LABEL, stems as stemsFmt } from "@/lib/inventory";
import type { ArrangementType, CatalogItem, CatalogKind, CatalogVolume, FloristProfile, FloristVolumeRate, Packaging, StockBatch } from "@/lib/types";

type CompRow = { stock_batch: number; mode: "stems" | "bunches"; qty: string };
type MatRow = { packaging: number; qty: string };

const EMPTY = {
  name_uz: "", arrangement_type: "bouquet" as ArrangementType, height_cm: "",
  price: "", florist_fee: "", quantity_total: "1", instagram_story_url: "", description_uz: "", image_url: "",
};

/** KATALOG KOMPOZITSIYA QURUVCHI — Standart/Maxsus, hajm tarifi, materiallar,
    jonli narx paneli. Yaratish/tahrirlash (backend: /api/catalog/). */
export default function KatalogModal({ item = null, onClose, onSaved }: { item?: CatalogItem | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useStore();
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [materials, setMaterials] = useState<Packaging[]>([]);
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  const [rates, setRates] = useState<FloristVolumeRate[]>([]);
  const [kind, setKind] = useState<CatalogKind>(item?.catalog_kind ?? "standard");
  const [volume, setVolume] = useState<CatalogVolume | "">(item?.volume ?? "");
  const [florist, setFlorist] = useState<number>(item?.florist ?? 0);
  const [feeFromRate, setFeeFromRate] = useState(false);
  const [f, setF] = useState({
    ...EMPTY,
    ...(item ? {
      name_uz: item.name_uz ?? "", arrangement_type: item.arrangement_type, height_cm: item.height_cm ? String(item.height_cm) : "",
      price: item.price ? String(Math.round(+item.price)) : "", florist_fee: item.florist_fee ? String(Math.round(+item.florist_fee)) : "",
      quantity_total: String(item.quantity_total ?? 1), instagram_story_url: item.instagram_story_url ?? "",
      description_uz: item.description_uz ?? "", image_url: item.image_url ?? "",
    } : {}),
  });
  const [comp, setComp] = useState<CompRow[]>(
    item?.composition?.length ? item.composition.map((c) => ({ stock_batch: c.stock_batch, mode: "stems" as const, qty: String(c.quantity_stems) })) : [{ stock_batch: 0, mode: "stems", qty: "" }]
  );
  const [mats, setMats] = useState<MatRow[]>(item?.materials?.length ? item.materials.map((m) => ({ packaging: m.packaging, qty: String(m.quantity) })) : []);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); if (errs[k]) setErrs((x) => { const n = { ...x }; delete n[k]; return n; }); };
  const compLocked = !!item && ((item.quantity_sold ?? 0) > 0 || !!item.stock_deducted_at);

  useEffect(() => {
    api.stockBatches({ is_active: true }).then((bs) => {
      const used = new Set((item?.composition ?? []).map((c) => c.stock_batch));
      const usable = bs.filter((b) => b.remaining_stems > 0 || used.has(b.id));
      setBatches(usable);
      setComp((c) => c.map((r) => ({ ...r, stock_batch: r.stock_batch || usable[0]?.id || 0 })));
    }).catch(() => showToast("Sklad partiyalarini yuklab bo'lmadi"));
    api.materials({ is_active: true }).then(setMaterials).catch(() => {});
    api.florists({ is_active: true, ordering: "user" }).then(setFlorists).catch(() => {});
    api.floristVolumeRates({ is_active: true }).then(setRates).catch(() => {});
  }, [showToast, item]);

  const batchOf = (id: number) => batches.find((b) => b.id === id);
  const matOf = (id: number) => materials.find((m) => m.id === id);
  const stemsOfRow = (r: CompRow) => {
    const b = batchOf(r.stock_batch);
    const n = parseFloat(r.qty) || 0;
    return r.mode === "bunches" ? Math.round(n * (b?.stems_per_bunch || 1)) : Math.round(n);
  };

  // hajm + turi tanlansa florist_fee tarifdan olinadi (ko'rsatilmagan bo'lsa)
  useEffect(() => {
    if (!volume || (f.arrangement_type !== "bouquet" && f.arrangement_type !== "basket")) return;
    const rate = rates.find((r) => r.volume === volume && r.arrangement_type === f.arrangement_type);
    if (rate && (!f.florist_fee || feeFromRate)) {
      setF((p) => ({ ...p, florist_fee: String(Math.round(+rate.florist_fee)) }));
      setFeeFromRate(true);
    }
  }, [volume, f.arrangement_type, rates]); // eslint-disable-line react-hooks/exhaustive-deps

  // JONLI NARX (klient preview — server calculated_* bilan solishtiriladi)
  const price = useMemo(() => {
    const compPrice = comp.reduce((s, r) => { const b = batchOf(r.stock_batch); return s + (b ? Math.round(+b.sale_price_per_stem) * stemsOfRow(r) : 0); }, 0);
    const compCost = comp.reduce((s, r) => { const b = batchOf(r.stock_batch); return s + (b ? Math.round(+b.cost_per_stem) * stemsOfRow(r) : 0); }, 0);
    const matPrice = mats.reduce((s, m) => { const p = matOf(m.packaging); return s + (p ? Math.round(+p.sale_price) * (+m.qty || 0) : 0); }, 0);
    const matCost = mats.reduce((s, m) => { const p = matOf(m.packaging); return s + (p ? Math.round(+p.cost_price) * (+m.qty || 0) : 0); }, 0);
    const sale = +f.price || 0;
    const fee = +f.florist_fee || 0;
    // BACKEND kontrakti (jonli tekshiruvda tasdiqlangan): florist_fee HAM
    // calculated_component_price'ga, HAM calculated_cost_price'ga qo'shiladi;
    // discount = component − sotuv. Shu sabab fee'ni ikkalasiga ham qo'shamiz.
    const componentPrice = compPrice + matPrice + fee;
    const cost = compCost + matCost + fee;
    return { componentPrice, cost, sale, fee, discount: Math.max(0, componentPrice - sale), profit: sale - cost };
  }, [comp, mats, f.price, f.florist_fee, batches, materials]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!f.name_uz) return showToast("Nomini kiriting");
    if (!f.price) return showToast("Narxini kiriting");
    const composition = comp.filter((r) => r.stock_batch && stemsOfRow(r) > 0).map((r) => {
      const b = batchOf(r.stock_batch);
      const st = stemsOfRow(r);
      return r.mode === "bunches"
        ? { stock_batch: r.stock_batch, quantity_stems: st, quantity_bunches: (parseFloat(r.qty) || 0).toFixed(2) }
        : { stock_batch: r.stock_batch, quantity_stems: st, ...(b?.stems_per_bunch ? { quantity_bunches: (st / b.stems_per_bunch).toFixed(2) } : {}) };
    });
    const materialsPayload = mats.filter((m) => m.packaging && +m.qty > 0).map((m) => ({ packaging: m.packaging, quantity: +m.qty }));
    setBusy(true);
    setErrs({});
    const payload: Record<string, unknown> = {
      name_uz: f.name_uz,
      name_ru: f.name_uz,
      arrangement_type: f.arrangement_type,
      catalog_kind: kind,
      ...(volume ? { volume } : {}),
      ...(florist ? { florist } : {}),
      height_cm: +f.height_cm || null,
      price: String(+f.price),
      florist_fee: f.florist_fee ? String(+f.florist_fee) : undefined,
      quantity_total: Math.max(+f.quantity_total || 1, 1),
      instagram_story_url: f.instagram_story_url,
      description_uz: f.description_uz,
      image_url: f.image_url,
      ...(compLocked ? {} : { composition, materials: materialsPayload }),
    };
    // maxsus: mijoz do'konda tanladi → sotilgan sifatida yoziladi
    if (kind === "custom" && !item) payload.status = "sold";
    else if (!item) payload.status = "available";
    try {
      await (item ? api.updateCatalogItem(item.id, payload) : api.createCatalogItem(payload));
      // DIQQAT: create javobida calculated_*/discount_amount 0 keladi (kompozitsiya
      // keyin saqlanadi, GET'da to'g'ri qiymat chiqadi). Shu bois preview'ga tayanamiz
      // — preview matematikasi endi backend bilan aynan mos (fee ham qo'shilgan).
      const disc = price.discount;
      showToast(item ? "✓ Katalog yozuvi yangilandi" : `✓ Katalogga qo'shildi${disc > 0 ? ` · chegirma ${fmt(disc)}` : ""}`);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ef:stock-changed"));
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        setErrs(e.fieldErrors);
        showToast(e.message);
      } else {
        showToast(e instanceof ApiError ? e.message : "Saqlashda xatolik");
      }
      setBusy(false);
    }
  };

  const floristName = (fp: FloristProfile) => { const u = fp.user_detail; return u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username : `#${fp.id}`; };
  const matGroups = useMemo(() => {
    const g = new Map<string, Packaging[]>();
    materials.forEach((m) => { const k = m.packaging_type; (g.get(k) ?? g.set(k, []).get(k)!).push(m); });
    return g;
  }, [materials]);

  const Err = ({ k }: { k: string }) =>
    errs[k] ? <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs[k]}</p> : null;
  // ichma-ich (kompozitsiya/material) xatolari — bitta inputga bog'lab bo'lmaydi, banner sifatida
  const nestedErrs = Object.entries(errs).filter(([k]) => k.startsWith("composition") || k.startsWith("materials") || k === "non_field_errors");

  const PriceLine = ({ label, value, hue, strong }: { label: string; value: number; hue?: string; strong?: boolean }) => (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{label}</span>
      <span className={clsx("tabular-nums", strong ? "text-[15px] font-bold" : "text-[13px] font-semibold")} style={{ color: hue ?? "var(--text)" }}>{fmt(value)}</span>
    </div>
  );

  return (
    <Modal onClose={onClose} width={640}>
      <ModalHeader icon={<Icon name="katalog" />} title={item ? "Katalog yozuvini tahrirlash" : "Katalog yaratish"} sub={item ? `${item.name_uz} · #${item.id}` : "Standart yoki maxsus kompozitsiya"} onClose={onClose} />

      {/* kind toggle */}
      {!item && (
        <div className="mt-1 flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)" }}>
          {(["standard", "custom"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className="flex-1 rounded-full py-2 text-[13px] font-bold transition-colors duration-150" style={kind === k ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
        {kind === "standard" ? "Standart — florist tayyorlagan buket/savat." : "Maxsus — mijoz do'konda o'zi tanladi."}
      </p>
      {kind === "custom" && !item && (
        <div className="mt-2 flex items-center gap-1.5 rounded-[11px] bg-peach px-3 py-2 text-[12.5px] font-semibold text-peachink">
          <Info size={14} strokeWidth={2} /> Sotilgan sifatida yoziladi (status = sotildi).
        </div>
      )}

      <Section>Asosiy</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nomi (uz)" span><input className="inp" value={f.name_uz} onChange={set("name_uz")} placeholder="Masalan: Gortenziya savat" /><Err k="name_uz" /></Field>
        <Field label="Turi">
          <Select value={f.arrangement_type} onChange={(v) => setF({ ...f, arrangement_type: v as ArrangementType })} options={(["bouquet", "basket", "box"] as const).map((t) => ({ value: t, label: ARRANGEMENT_LABEL[t] }))} />
        </Field>
        <Field label="Hajm">
          <Select value={volume} onChange={(v) => setVolume(v as CatalogVolume)} placeholder="Tanlang" options={[{ value: "", label: "—" }, ...(["small", "medium", "large"] as const).map((v) => ({ value: v, label: VOLUME_LABEL[v] }))]} />
        </Field>
        <Field label="Florist">
          <Select value={florist} onChange={(v) => setFlorist(+v)} placeholder="Tanlang" options={[{ value: 0, label: "—" }, ...florists.map((fp) => ({ value: fp.id, label: floristName(fp) }))]} />
        </Field>
        <Field label="Soni"><input className="inp" type="number" min={1} value={f.quantity_total} onChange={set("quantity_total")} placeholder="Masalan: 1" /></Field>
      </div>

      {nestedErrs.length > 0 && (
        <div className="mt-3 rounded-[11px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          {nestedErrs.map(([k, v]) => (
            <div key={k}>{k.startsWith("composition") ? "Gullar: " : k.startsWith("materials") ? "Materiallar: " : ""}{v}</div>
          ))}
        </div>
      )}

      {/* KOMPOZITSIYA */}
      <Section>Gullar (skladdan)</Section>
      {compLocked ? (
        <div className="rounded-[13px] bg-mint px-3.5 py-2.5 text-[12.5px] font-semibold text-mintink">✓ Sotuv boshlangan — tarkib o&apos;zgartirilmaydi.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {comp.map((r, i) => {
            const b = batchOf(r.stock_batch);
            const st = stemsOfRow(r);
            const over = b ? st > b.remaining_stems : false;
            const under = b ? st > 0 && st < b.minimum_sale_stems : false;
            const sub = b ? Math.round(+b.sale_price_per_stem) * st : 0;
            return (
              <div key={i} className="rounded-[13px] border p-2.5" style={{ borderColor: over || under ? "color-mix(in srgb, #b3873a 45%, var(--border))" : "var(--border)" }}>
                <div className="grid grid-cols-[1fr_auto_92px_32px] items-center gap-2">
                  <Select value={r.stock_batch} onChange={(v) => setComp(comp.map((x, j) => (j === i ? { ...x, stock_batch: +v } : x)))} options={batches.map((bb) => ({ value: bb.id, label: `${bb.variant_detail?.flower_detail?.name_uz} ${bb.variant_detail?.name_uz}`, sub: `${bb.remaining_stems} dona · ${fmt(bb.sale_price_per_stem)}/dona` }))} />
                  <button type="button" onClick={() => setComp(comp.map((x, j) => (j === i ? { ...x, mode: x.mode === "stems" ? "bunches" : "stems" } : x)))} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-2)" }} title="Dona/Bog'lam">
                    {r.mode === "stems" ? "Dona" : "Bog'lam"}
                  </button>
                  <input className="inp !py-1.5" type="number" value={r.qty} onChange={(e) => setComp(comp.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder={r.mode === "stems" ? "25" : "1"} />
                  <button type="button" onClick={() => setComp(comp.length > 1 ? comp.filter((_, j) => j !== i) : comp)} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11.5px]">
                  <span style={{ color: over ? "#b3873a" : under ? "#b3873a" : "var(--muted)" }}>
                    {r.mode === "bunches" && b ? `${r.qty || 0} × ${b.stems_per_bunch} = ${st} dona · ` : ""}
                    {over ? `Qoldiqdan ko'p (${b?.remaining_stems})` : under ? `Min. ${b?.minimum_sale_stems} dona` : b ? `${stemsFmt(b.remaining_stems)} bor` : ""}
                  </span>
                  {sub > 0 && <span className="font-semibold" style={{ color: "var(--acc)" }}>{fmt(sub)}</span>}
                </div>
              </div>
            );
          })}
          <button type="button" onClick={() => setComp([...comp, { stock_batch: batches[0]?.id ?? 0, mode: "stems", qty: "" }])} className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3.5 py-1.5 text-[12px] font-bold">
            <Plus size={15} strokeWidth={1.75} /> Yana gul
          </button>
        </div>
      )}

      {/* MATERIALLAR */}
      {!compLocked && materials.length > 0 && (
        <>
          <Section>Materiallar</Section>
          <div className="flex flex-col gap-2.5">
            {mats.map((m, i) => {
              const p = matOf(m.packaging);
              const sub = p ? Math.round(+p.sale_price) * (+m.qty || 0) : 0;
              return (
                <div key={i} className="grid grid-cols-[1fr_92px_32px] items-center gap-2">
                  <Select value={m.packaging} onChange={(v) => setMats(mats.map((x, j) => (j === i ? { ...x, packaging: +v } : x)))} options={Array.from(matGroups.entries()).flatMap(([g, list]) => list.map((pk) => ({ value: pk.id, label: pk.name_uz, sub: `${PACKAGING_LABEL[g as keyof typeof PACKAGING_LABEL] ?? g} · ${fmt(pk.sale_price)}` })))} />
                  <input className="inp !py-1.5" type="number" value={m.qty} onChange={(e) => setMats(mats.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder="1" />
                  <button type="button" onClick={() => setMats(mats.filter((_, j) => j !== i))} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
                  {sub > 0 && <span className="col-span-3 -mt-1 text-right text-[11.5px] font-semibold" style={{ color: "var(--acc)" }}>{fmt(sub)}</span>}
                </div>
              );
            })}
            <button type="button" onClick={() => setMats([...mats, { packaging: materials[0]?.id ?? 0, qty: "1" }])} className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3.5 py-1.5 text-[12px] font-bold">
              <Plus size={15} strokeWidth={1.75} /> Material qo&apos;shish
            </button>
          </div>
        </>
      )}

      <Section>Narx va tavsif</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Sotuv narxi (so'm)"><input className="inp" type="number" value={f.price} onChange={set("price")} placeholder="Masalan: 850000" /><Err k="price" /></Field>
        <Field label="Florist haqi (so'm)">
          <input className="inp" type="number" value={f.florist_fee} onChange={(e) => { setFeeFromRate(false); setF({ ...f, florist_fee: e.target.value }); }} placeholder="Masalan: 50000" />
          {feeFromRate && <span className="mt-0.5 block text-[11px] font-semibold" style={{ color: "var(--primary)" }}>Tarifdan olindi</span>}
          <Err k="florist_fee" />
        </Field>
        <Field label="Story havolasi" span><input className="inp" value={f.instagram_story_url} onChange={set("instagram_story_url")} placeholder="Masalan: https://instagram.com/stories/…" /></Field>
        <Field label="Rasm" span><ImageInput value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></Field>
      </div>

      {/* JONLI NARX PANELI (sticky) */}
      <div className="sticky bottom-0 z-10 -mx-6 mt-4 border-t px-6 pb-1 pt-3" style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-1">
          <PriceLine label="Komponentlar narxi" value={price.componentPrice} />
          <PriceLine label="Tannarx" value={price.cost} />
          <PriceLine label="Sotuv narxi" value={price.sale} strong />
          {price.discount > 0 && <PriceLine label="Chegirma" value={price.discount} hue="var(--danger-ink)" />}
          {price.fee > 0 && <PriceLine label="Florist haqi" value={price.fee} />}
          <PriceLine label="Taxminiy foyda" value={price.profit} hue={price.profit >= 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)"} strong />
        </div>
        <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>Aniq qiymatni saqlagandan so&apos;ng backend hisoblaydi.</p>
        <div className="mt-3 flex justify-end gap-2.5 pb-2 max-sm:[&>*]:flex-1">
          <button onClick={onClose} className="btn-ghost">Bekor</button>
          <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : item ? "Saqlash" : kind === "custom" ? "Sotildi deb yozish" : "Katalogga qo'shish"}</button>
        </div>
      </div>
    </Modal>
  );
}
