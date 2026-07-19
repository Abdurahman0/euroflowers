"use client";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import ImageInput from "./ImageInput";
import { Icon } from "./icons";
import type { FlowerVariant } from "@/lib/types";

const EMPTY = {
  variant: 0, branch: 0, batch_number: "", height_cm: "", stems_per_bunch: "",
  bunches: "", cost_per_stem: "", sale_price_per_stem: "", sale_price_per_bunch: "",
  minimum_sale_stems: "", image_url: "",
};

export default function KirimModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user, showToast } = useStore();
  const branches = user?.profile.branches ?? [];
  const [variants, setVariants] = useState<FlowerVariant[]>([]);
  const [flowerId, setFlowerId] = useState(0); // gul turi
  const [f, setF] = useState({ ...EMPTY, branch: branches[0]?.id ?? 0 });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api.flowerVariants({ is_active: true })
      .then((vs) => {
        setVariants(vs);
        const first = vs[0];
        if (first) {
          setFlowerId((p) => p || first.flower);
          setF((p) => ({ ...p, variant: p.variant || first.id }));
        }
      })
      .catch(() => showToast("Gul navlarini yuklab bo'lmadi"));
  }, [showToast]);

  // gul turlari — variantlardan noyob flower ro'yxati
  const flowers = useMemo(() => {
    const map = new Map<number, string>();
    variants.forEach((v) => {
      if (v.flower_detail) map.set(v.flower, v.flower_detail.name_uz || v.flower_detail.name_ru);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [variants]);

  // tanlangan turga tegishli navlar
  const filteredVariants = useMemo(
    () => variants.filter((v) => v.flower === flowerId),
    [variants, flowerId]
  );

  // tur almashsa — nav shu turning birinchisiga o'tadi
  const pickFlower = (id: number) => {
    setFlowerId(id);
    const first = variants.find((v) => v.flower === id);
    setF((p) => ({ ...p, variant: first?.id ?? 0 }));
  };

  const variant = useMemo(() => variants.find((v) => v.id === f.variant), [variants, f.variant]);
  const stemsPerBunch = +f.stems_per_bunch || variant?.default_stems_per_bunch || 20;
  const receivedStems = (+f.bunches || 0) * stemsPerBunch;

  const save = async () => {
    if (!f.variant || !f.bunches) return showToast("Gul navi va pochka sonini kiriting");
    if (!f.branch) return showToast("Filial tanlang");
    setBusy(true);
    try {
      const today = new Date();
      const num = f.batch_number || `EF-${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${f.variant}`;
      await api.createStockBatch({
        variant: f.variant,
        branch: f.branch,
        batch_number: num,
        height_cm: +f.height_cm || 50,
        stems_per_bunch: stemsPerBunch,
        received_stems: receivedStems,
        remaining_stems: receivedStems,
        cost_per_stem: String(+f.cost_per_stem || 0),
        sale_price_per_stem: String(+f.sale_price_per_stem || 0),
        sale_price_per_bunch: String(+f.sale_price_per_bunch || (+f.sale_price_per_stem || 0) * stemsPerBunch),
        minimum_sale_stems: +f.minimum_sale_stems || variant?.minimum_sale_stems || 1,
        image_url: f.image_url || variant?.image_url || "",
      });
      showToast(`✓ Kirim saqlandi: ${variant?.flower_detail?.name_uz ?? ""} ${variant?.name_uz ?? ""}`);
      onSaved();
      onClose();
    } catch (e) {
      showToast(e instanceof ApiError ? `Saqlab bo'lmadi: ${JSON.stringify(e.body)}` : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={560}>
      <ModalHeader icon={<Icon name="sklad" />} title="Gul keldi qilish" sub="Sklad kirimi — yangi partiya" onClose={onClose} />
      <Section>Asosiy ma&apos;lumot</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Gul turi">
          <Select
            value={flowerId}
            onChange={(v) => pickFlower(+v)}
            placeholder="Turini tanlang"
            options={flowers.map((fl) => ({ value: fl.id, label: fl.name }))}
          />
        </Field>
        <Field label="Gul navi">
          <Select
            value={f.variant}
            onChange={(v) => setF({ ...f, variant: +v })}
            placeholder={flowerId ? "Navini tanlang" : "Avval turini tanlang"}
            options={filteredVariants.map((v) => ({
              value: v.id,
              label: `${v.name_uz} (${v.color_uz})`,
              sub: `pochkada ${v.default_stems_per_bunch} dona · min. ${v.minimum_sale_stems}`,
            }))}
          />
        </Field>
        <Field label="Filial">
          <Select
            value={f.branch}
            onChange={(v) => setF({ ...f, branch: +v })}
            options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.code }))}
          />
        </Field>
        <Field label="Partiya raqami"><input className="inp" value={f.batch_number} onChange={set("batch_number")} placeholder="bo'sh — avto" /></Field>
      </div>
      <Section>Miqdor va narx</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Bo'yi (sm)"><input className="inp" type="number" value={f.height_cm} onChange={set("height_cm")} placeholder="60" /></Field>
        <Field label="Pochka soni"><input className="inp" type="number" value={f.bunches} onChange={set("bunches")} placeholder="8" /></Field>
        <Field label="Pochkada dona"><input className="inp" type="number" value={f.stems_per_bunch} onChange={set("stems_per_bunch")} placeholder={String(variant?.default_stems_per_bunch ?? 20)} /></Field>
        <Field label="Minimal sotuv (dona)"><input className="inp" type="number" value={f.minimum_sale_stems} onChange={set("minimum_sale_stems")} placeholder={String(variant?.minimum_sale_stems ?? 1)} /></Field>
        <Field label="Tannarx / dona (so'm)"><input className="inp" type="number" value={f.cost_per_stem} onChange={set("cost_per_stem")} placeholder="21000" /></Field>
        <Field label="Sotuv narxi / dona (so'm)"><input className="inp" type="number" value={f.sale_price_per_stem} onChange={set("sale_price_per_stem")} placeholder="35000" /></Field>
        <Field label="Pochka sotuv narxi (so'm)" span><input className="inp" type="number" value={f.sale_price_per_bunch} onChange={set("sale_price_per_bunch")} placeholder="avto: dona × pochka" /></Field>
      </div>
      {receivedStems > 0 && (
        <p className="mt-2.5 text-[13px] text-[color:var(--text-2)]">Jami kirim: <b className="text-[color:var(--text)]">{receivedStems} dona</b></p>
      )}
      <Section>Gul rasmi</Section>
      <ImageInput value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} />
      <ModalFooter>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Kirimni saqlash"}</button>
        <button onClick={onClose} className="rounded-[14px] border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-5 py-3 text-sm font-bold hover:bg-[color:var(--hover)]">Bekor</button>
      </ModalFooter>
    </Modal>
  );
}
