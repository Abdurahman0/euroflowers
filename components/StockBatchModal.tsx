"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import DatePicker from "./DatePicker";
import ImageInput from "./ImageInput";
import DualQtyInput, { type QtyMode } from "./DualQtyInput";
import { SupplierForm } from "./SupplierModal";
import { Icon } from "./icons";
import { fmt } from "@/lib/format";
import type { FlowerVariant, StockBatch, Supplier } from "@/lib/types";

/** GUL PARTIYASI yaratish — Dona/Bog'lam toggle, supplier, margin hint (backend: /api/stock-batches/). */
export default function StockBatchModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useStore();
  const [variants, setVariants] = useState<FlowerVariant[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [flowerId, setFlowerId] = useState(0);
  const [f, setF] = useState({
    variant: 0, supplier: 0, batch_number: "", received_at: "", stems_per_bunch: "", height_cm: "",
    cost_per_stem: "", sale_price_per_stem: "", sale_price_per_bunch: "", minimum_sale_stems: "", image_url: "",
  });
  const [qtyMode, setQtyMode] = useState<QtyMode>("bunches");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [newSupplier, setNewSupplier] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); if (errs[k]) setErrs((x) => { const n = { ...x }; delete n[k]; return n; }); };

  useEffect(() => {
    api.flowerVariants({ is_active: true }).then((vs) => {
      setVariants(vs);
      const first = vs[0];
      if (first) { setFlowerId((p) => p || first.flower); setF((p) => ({ ...p, variant: p.variant || first.id })); }
    }).catch(() => showToast("Gul navlarini yuklab bo'lmadi"));
    api.suppliers({ is_active: true }).then(setSuppliers).catch(() => {});
  }, [showToast]);

  const flowers = useMemo(() => {
    const m = new Map<number, string>();
    variants.forEach((v) => v.flower_detail && m.set(v.flower, v.flower_detail.name_uz || v.flower_detail.name_ru));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [variants]);
  const filteredVariants = useMemo(() => variants.filter((v) => v.flower === flowerId), [variants, flowerId]);
  const variant = useMemo(() => variants.find((v) => v.id === f.variant), [variants, f.variant]);
  const spb = +f.stems_per_bunch || variant?.default_stems_per_bunch || 20;
  const receivedStems = qtyMode === "bunches" ? Math.round((+qty || 0) * spb) : Math.round(+qty || 0);

  // margin hint: sotuv − tannarx (dona)
  const margin = (+f.sale_price_per_stem || 0) - (+f.cost_per_stem || 0);
  const marginPct = +f.cost_per_stem ? Math.round((margin / +f.cost_per_stem) * 100) : 0;

  const pickFlower = (id: number) => {
    setFlowerId(id);
    const first = variants.find((v) => v.flower === id);
    setF((p) => ({ ...p, variant: first?.id ?? 0 }));
  };

  const save = async () => {
    if (!f.variant) return showToast("Gul navini tanlang");
    if (!qty || receivedStems <= 0) return showToast("Miqdorni kiriting");
    if (!(+f.height_cm > 0)) { setErrs({ height_cm: "Bo'yini kiriting (majburiy)" }); return showToast("Gul bo'yini kiriting"); }
    setBusy(true);
    setErrs({});
    try {
      const today = new Date();
      const num = f.batch_number || `EF-${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${f.variant}`;
      // received_stems kontraktda MAJBURIY — har doim yuboriladi; bog'lam rejimida
      // received_bunches ham qo'shiladi (backend ko'rsatishi uchun), ikkalasi mos.
      const qtyField = qtyMode === "bunches"
        ? { received_stems: receivedStems, received_bunches: (+qty).toFixed(2) }
        : { received_stems: receivedStems };
      await api.createStockBatch({
        variant: f.variant,
        ...(f.supplier ? { supplier: f.supplier } : {}),
        batch_number: num,
        height_cm: +f.height_cm, // kontraktda MAJBURIY
        // received_at — sxema DateField (sana), sana-vaqt emas
        ...(f.received_at ? { received_at: f.received_at.slice(0, 10) } : {}),
        stems_per_bunch: spb,
        ...qtyField,
        remaining_stems: receivedStems,
        cost_per_stem: String(+f.cost_per_stem || 0),
        sale_price_per_stem: String(+f.sale_price_per_stem || 0),
        sale_price_per_bunch: String(+f.sale_price_per_bunch || (+f.sale_price_per_stem || 0) * spb),
        minimum_sale_stems: +f.minimum_sale_stems || variant?.minimum_sale_stems || 1,
        image_url: f.image_url || variant?.image_url || "",
      } as Partial<StockBatch>);
      showToast(`✓ Partiya qo'shildi: ${variant?.flower_detail?.name_uz ?? ""} ${variant?.name_uz ?? ""}`);
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

  const Err = ({ k }: { k: string }) =>
    errs[k] ? <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs[k]}</p> : null;

  return (
    <>
      <Modal onClose={onClose} width={560}>
        <ModalHeader icon={<Icon name="sklad" size={20} />} title="Yangi partiya" sub="Sklad kirimi — yetkazib beruvchi bilan" onClose={onClose} />

        <Section>Gul va manba</Section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Gul turi">
            <Select value={flowerId} onChange={(v) => pickFlower(+v)} placeholder="Turini tanlang" options={flowers.map((fl) => ({ value: fl.id, label: fl.name }))} />
          </Field>
          <Field label="Gul navi">
            <Select value={f.variant} onChange={(v) => { setF({ ...f, variant: +v }); setErrs((x) => { const n = { ...x }; delete n.variant; return n; }); }} placeholder={flowerId ? "Navini tanlang" : "Avval turini tanlang"} options={filteredVariants.map((v) => ({ value: v.id, label: `${v.name_uz} (${v.color_uz})`, sub: `pochkada ${v.default_stems_per_bunch}` }))} />
            <Err k="variant" />
          </Field>
          <Field label="Yetkazib beruvchi" span>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Select value={f.supplier} onChange={(v) => setF({ ...f, supplier: +v })} placeholder="Tanlang (ixtiyoriy)" options={[{ value: 0, label: "—" }, ...suppliers.map((s) => ({ value: s.id, label: s.name, sub: `${s.batches_count} partiya` }))]} />
              </div>
              <button type="button" onClick={() => setNewSupplier(true)} className="icon-btn border shrink-0" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }} title="Yangi yetkazib beruvchi" aria-label="Yangi yetkazib beruvchi">
                <Plus size={16} strokeWidth={2} />
              </button>
            </div>
          </Field>
          <Field label="Partiya raqami"><input className="inp" value={f.batch_number} onChange={set("batch_number")} placeholder="Masalan: EF-260726-1 (bo'sh — avto)" /><Err k="batch_number" /></Field>
          <Field label="Kelgan sana">
            <DatePicker value={f.received_at} onChange={(v) => setF({ ...f, received_at: v })} placeholder="Bugun" ariaLabel="Kelgan sana" />
          </Field>
        </div>

        <Section>Miqdor</Section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Gul bo'yi (sm)"><input className="inp" type="number" value={f.height_cm} onChange={set("height_cm")} placeholder="Masalan: 60" /><Err k="height_cm" /></Field>
          <Field label="Pochkada dona"><input className="inp" type="number" value={f.stems_per_bunch} onChange={set("stems_per_bunch")} placeholder={`Masalan: ${variant?.default_stems_per_bunch ?? 20}`} /></Field>
          <div>
            <DualQtyInput mode={qtyMode} value={qty} stemsPerBunch={spb} onMode={setQtyMode} onValue={(v) => { setQty(v); setErrs((x) => { const n = { ...x }; delete n.received_stems; delete n.received_bunches; return n; }); }} label="Kelgan miqdor" />
            <Err k="received_stems" />
            <Err k="received_bunches" />
          </div>
        </div>
        {receivedStems > 0 && <p className="mt-2 text-[13px]" style={{ color: "var(--text-2)" }}>Jami kirim: <b>{receivedStems} dona</b></p>}

        <Section>Narx</Section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tannarx / dona (so'm)"><input className="inp" type="number" value={f.cost_per_stem} onChange={set("cost_per_stem")} placeholder="Masalan: 21000" /><Err k="cost_per_stem" /></Field>
          <Field label="Sotuv / dona (so'm)"><input className="inp" type="number" value={f.sale_price_per_stem} onChange={set("sale_price_per_stem")} placeholder="Masalan: 35000" /><Err k="sale_price_per_stem" /></Field>
          <Field label="Pochka sotuv narxi (so'm)"><input className="inp" type="number" value={f.sale_price_per_bunch} onChange={set("sale_price_per_bunch")} placeholder="Masalan: 350000 (avto)" /></Field>
          <Field label="Minimal sotuv (dona)"><input className="inp" type="number" value={f.minimum_sale_stems} onChange={set("minimum_sale_stems")} placeholder={`Masalan: ${variant?.minimum_sale_stems ?? 5}`} /></Field>
        </div>
        {margin !== 0 && +f.cost_per_stem > 0 && (
          <p className="mt-2 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: margin > 0 ? "var(--success-soft, rgba(61,138,95,.14))" : "var(--danger-soft, rgba(160,74,74,.12))", color: margin > 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)" }}>
            Foyda: {margin > 0 ? "+" : ""}{fmt(margin)}/dona ({marginPct}%)
          </p>
        )}

        <Section>Rasm</Section>
        <ImageInput value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} />

        <ModalFooter>
          <button onClick={onClose} className="btn-ghost">Bekor</button>
          <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Partiya qo'shish"}</button>
        </ModalFooter>
      </Modal>

      {newSupplier && (
        <SupplierForm supplier={null} onClose={() => setNewSupplier(false)} onSaved={(s) => { setSuppliers((ss) => [s, ...ss]); setF((p) => ({ ...p, supplier: s.id })); setNewSupplier(false); }} />
      )}
    </>
  );
}
