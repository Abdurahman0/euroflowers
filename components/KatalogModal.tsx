"use client";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import ImageInput from "./ImageInput";
import { Icon } from "./icons";
import { ARRANGEMENT_LABEL } from "./badges";
import type { ArrangementType, StockBatch } from "@/lib/types";

type CompRow = { stock_batch: number; quantity_stems: string };

const EMPTY = {
  name_uz: "", name_ru: "", arrangement_type: "bouquet" as ArrangementType, height_cm: "",
  price: "", florist_fee: "", quantity_total: "1", instagram_story_url: "", description_uz: "", image_url: "",
};

export default function KatalogModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useStore();
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [f, setF] = useState({ ...EMPTY });
  const [comp, setComp] = useState<CompRow[]>([{ stock_batch: 0, quantity_stems: "" }]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api.stockBatches({ is_active: true })
      .then((bs) => {
        const withStock = bs.filter((b) => b.remaining_stems > 0);
        setBatches(withStock);
        setComp((c) => c.map((r) => ({ ...r, stock_batch: r.stock_batch || withStock[0]?.id || 0 })));
      })
      .catch(() => showToast("Sklad partiyalarini yuklab bo'lmadi"));
  }, [showToast]);

  const save = async () => {
    if (!f.name_uz) return showToast("Nomini kiriting");
    if (!f.price) return showToast("Narxini kiriting");
    const composition = comp
      .filter((r) => r.stock_batch && +r.quantity_stems > 0)
      .map((r) => ({ stock_batch: r.stock_batch, quantity_stems: +r.quantity_stems }));
    setBusy(true);
    try {
      await api.createCatalogItem({
        name_uz: f.name_uz,
        name_ru: f.name_ru || f.name_uz,
        arrangement_type: f.arrangement_type,
        height_cm: +f.height_cm || null,
        price: String(+f.price),
        florist_fee: f.florist_fee ? String(+f.florist_fee) : undefined,
        quantity_total: Math.max(+f.quantity_total || 1, 1),
        status: "available",
        instagram_story_url: f.instagram_story_url,
        description_uz: f.description_uz,
        image_url: f.image_url,
        composition,
      });
      showToast(`✓ Katalogga qo'shildi: ${f.name_uz}`);
      onSaved();
      onClose();
    } catch (e) {
      showToast(e instanceof ApiError ? `Saqlab bo'lmadi: ${JSON.stringify(e.body)}` : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={560}>
      <ModalHeader icon={<Icon name="katalog" />} title="Katalogga qo'shish" sub="Tayyor gul — story havolasi bilan" onClose={onClose} />
      <Section>Asosiy</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nomi (uz)"><input className="inp" value={f.name_uz} onChange={set("name_uz")} placeholder="Yozgi nafosat" /></Field>
        <Field label="Nomi (ru)"><input className="inp" value={f.name_ru} onChange={set("name_ru")} placeholder="bo'sh — uz nomi olinadi" /></Field>
        <Field label="Turi" span>
          <Select
            value={f.arrangement_type}
            onChange={(v) => setF({ ...f, arrangement_type: v as ArrangementType })}
            options={(["bouquet", "basket", "box"] as const).map((t) => ({ value: t, label: ARRANGEMENT_LABEL[t] }))}
          />
        </Field>
      </div>

      <Section>Tarkib (skladdan)</Section>
      <div className="flex flex-col gap-2.5">
        {comp.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_36px] items-end gap-2.5">
            <Field label={i === 0 ? "Partiya" : ""}>
              <Select
                value={r.stock_batch}
                onChange={(v) => setComp(comp.map((x, j) => (j === i ? { ...x, stock_batch: +v } : x)))}
                options={batches.map((b) => ({
                  value: b.id,
                  label: `${b.variant_detail?.flower_detail?.name_uz} ${b.variant_detail?.name_uz} (${b.variant_detail?.color_uz}, ${b.height_cm} sm)`,
                  sub: `${b.remaining_stems} dona bor · №${b.batch_number}`,
                }))}
              />
            </Field>
            <Field label={i === 0 ? "Dona" : ""}>
              <input className="inp" type="number" value={r.quantity_stems} onChange={(e) => setComp(comp.map((x, j) => (j === i ? { ...x, quantity_stems: e.target.value } : x)))} placeholder="25" />
            </Field>
            <button type="button" onClick={() => setComp(comp.length > 1 ? comp.filter((_, j) => j !== i) : comp)} className="icon-btn icon-btn-danger mb-[1px] !h-[38px] !w-9 rounded-xl border border-[color:var(--border)]" title="Olib tashlash"><X size={16} strokeWidth={1.75} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setComp([...comp, { stock_batch: batches[0]?.id ?? 0, quantity_stems: "" }])} className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3.5 py-1.5 text-[12px] font-bold hover:bg-[color:var(--hover)]">
          <Plus size={16} strokeWidth={1.75} /> Yana gul qo&apos;shish
        </button>
      </div>

      <Section>O&apos;lchov va narx</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Bo'yi (sm)"><input className="inp" type="number" value={f.height_cm} onChange={set("height_cm")} placeholder="60" /></Field>
        <Field label="Narxi (so'm)"><input className="inp" type="number" value={f.price} onChange={set("price")} placeholder="675000" /></Field>
        <Field label="Florist haqi (so'm)"><input className="inp" type="number" value={f.florist_fee} onChange={set("florist_fee")} placeholder="50000" /></Field>
        <Field label="Soni (nechta tayyorlanadi)">
          <input className="inp" type="number" min={1} value={f.quantity_total} onChange={set("quantity_total")} placeholder="1" />
        </Field>
      </div>
      <p className="mt-1.5 text-[12px]" style={{ color: "var(--muted)" }}>
        Sklad tekshiruvi: soni × tarkibdagi dona &le; partiya qoldig&apos;i bo&apos;lishi kerak, aks holda saqlanmaydi.
      </p>

      <Section>Instagram va tavsif</Section>
      <div className="grid gap-3">
        <Field label="Story havolasi"><input className="inp" value={f.instagram_story_url} onChange={set("instagram_story_url")} placeholder="https://instagram.com/stories/euroflowers.uz/…" /></Field>
        <Field label="Izoh (uz)"><input className="inp" value={f.description_uz} onChange={set("description_uz")} placeholder="Krem qog'ozda, atlas lenta" /></Field>
        <Field label="Rasm"><ImageInput value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></Field>
      </div>

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Katalogga qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}
