"use client";
import { Pencil, Plus } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import ImageInput from "@/components/ImageInput";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "@/components/Modal";
import Select from "@/components/Select";
import { Icon } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import type { Flower, FlowerVariant } from "@/lib/types";

/**
 * Gullar va navlar boshqaruvi — sklad va katalogning asosi bo'lgan
 * ma'lumotnoma: gul turlari (Flower) va ularning navlari (FlowerVariant),
 * to'liq CRUD bilan. Ruxsat: inventory.
 */

const MONTHS = ["", "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const monthOptions = [{ value: "0", label: "—" }, ...MONTHS.slice(1).map((m, i) => ({ value: String(i + 1), label: m }))];

function FlowerModal({ flower, onClose, onSaved }: { flower: Flower | null; onClose: () => void; onSaved: (f: Flower) => void }) {
  const showToast = useStore((s) => s.showToast);
  const [nameUz, setNameUz] = useState(flower?.name_uz ?? "");
  const [nameRu, setNameRu] = useState(flower?.name_ru ?? "");
  const [descUz, setDescUz] = useState(flower?.description_uz ?? "");
  const [seasonStart, setSeasonStart] = useState(String(flower?.season_start_month ?? 0));
  const [seasonEnd, setSeasonEnd] = useState(String(flower?.season_end_month ?? 0));
  const [image, setImage] = useState(flower?.image_url ?? "");
  const [active, setActive] = useState(flower?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async () => {
    if (!nameUz.trim() && !nameRu.trim()) return setErrors({ name_uz: "Kamida bitta til uchun nom kiriting" });
    setSaving(true);
    try {
      const payload: Partial<Flower> = {
        name_uz: nameUz.trim(),
        name_ru: nameRu.trim(),
        description_uz: descUz.trim(),
        season_start_month: +seasonStart || null,
        season_end_month: +seasonEnd || null,
        image_url: image,
        is_active: active,
      };
      const saved = flower ? await api.updateFlower(flower.id, payload) : await api.createFlower(payload);
      showToast(flower ? "✓ Gul yangilandi" : "✓ Gul qo'shildi");
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      else showToast(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={480}>
      <ModalHeader icon={<Icon name="katalog" size={20} />} title={flower ? "Gulni tahrirlash" : "Yangi gul turi"} sub="Sklad va katalog uchun ma'lumotnoma" onClose={onClose} />
      <Section>Nomi</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nomi (UZ)">
          <input className="inp" value={nameUz} onChange={(e) => { setNameUz(e.target.value); setErrors({}); }} placeholder="Piyon" autoFocus={!flower} />
        </Field>
        <Field label="Nomi (RU)">
          <input className="inp" value={nameRu} onChange={(e) => setNameRu(e.target.value)} placeholder="Пион" />
        </Field>
        <Field label="Tavsif" span>
          <textarea className="inp min-h-[56px]" value={descUz} onChange={(e) => setDescUz(e.target.value)} placeholder="Qisqacha izoh (ixtiyoriy)" />
        </Field>
      </div>
      {errors.name_uz && <p className="mt-1.5 text-[12px] font-semibold text-[color:var(--danger-ink)]" role="alert">{errors.name_uz}</p>}
      <Section>Mavsum</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Boshlanishi">
          <Select value={seasonStart} options={monthOptions} onChange={(v) => setSeasonStart(String(v))} />
        </Field>
        <Field label="Tugashi">
          <Select value={seasonEnd} options={monthOptions} onChange={(v) => setSeasonEnd(String(v))} />
        </Field>
      </div>
      <Section>Rasm</Section>
      <ImageInput value={image} onChange={setImage} />
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px]">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
        Faol
      </label>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor qilish</button>
        <button onClick={save} disabled={saving} className={clsx("btn-primary", saving && "btn-loading")}>{flower ? "Saqlash" : "Qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}

function VariantModal({ variant, flowers, onClose, onSaved }: { variant: FlowerVariant | null; flowers: Flower[]; onClose: () => void; onSaved: (v: FlowerVariant) => void }) {
  const showToast = useStore((s) => s.showToast);
  const [flowerId, setFlowerId] = useState<number>(variant?.flower ?? flowers[0]?.id ?? 0);
  const [nameUz, setNameUz] = useState(variant?.name_uz ?? "");
  const [nameRu, setNameRu] = useState(variant?.name_ru ?? "");
  const [colorUz, setColorUz] = useState(variant?.color_uz ?? "");
  const [colorRu, setColorRu] = useState(variant?.color_ru ?? "");
  const [perBunch, setPerBunch] = useState(String(variant?.default_stems_per_bunch ?? 10));
  const [minSale, setMinSale] = useState(String(variant?.minimum_sale_stems ?? 5));
  const [image, setImage] = useState(variant?.image_url ?? "");
  const [active, setActive] = useState(variant?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async () => {
    if (!nameUz.trim() && !nameRu.trim()) return setErrors({ name_uz: "Kamida bitta til uchun nom kiriting" });
    if (!flowerId) return setErrors({ flower: "Gul turini tanlang" });
    setSaving(true);
    try {
      const payload: Partial<FlowerVariant> = {
        flower: flowerId,
        name_uz: nameUz.trim(),
        name_ru: nameRu.trim(),
        color_uz: colorUz.trim(),
        color_ru: colorRu.trim(),
        default_stems_per_bunch: +perBunch || 10,
        minimum_sale_stems: +minSale || 1,
        image_url: image,
        is_active: active,
      };
      const saved = variant ? await api.updateFlowerVariant(variant.id, payload) : await api.createFlowerVariant(payload);
      showToast(variant ? "✓ Nav yangilandi" : "✓ Nav qo'shildi");
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      else showToast(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={480}>
      <ModalHeader icon={<Icon name="gullar" size={20} />} title={variant ? "Navni tahrirlash" : "Yangi nav"} sub="Rang, o'lcham va sotuv qoidalari" onClose={onClose} />
      <Section>Gul turi</Section>
      <Select value={String(flowerId)} options={flowers.map((f) => ({ value: String(f.id), label: f.name_uz || f.name_ru }))} onChange={(v) => setFlowerId(+v)} />
      <Section>Nomi va rangi</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nomi (UZ)">
          <input className="inp" value={nameUz} onChange={(e) => { setNameUz(e.target.value); setErrors({}); }} placeholder="Oq piyon 50sm" autoFocus={!variant} />
        </Field>
        <Field label="Nomi (RU)">
          <input className="inp" value={nameRu} onChange={(e) => setNameRu(e.target.value)} placeholder="Белый пион 50см" />
        </Field>
        <Field label="Rang (UZ)">
          <input className="inp" value={colorUz} onChange={(e) => setColorUz(e.target.value)} placeholder="oq" />
        </Field>
        <Field label="Rang (RU)">
          <input className="inp" value={colorRu} onChange={(e) => setColorRu(e.target.value)} placeholder="белый" />
        </Field>
      </div>
      {(errors.name_uz || errors.flower) && <p className="mt-1.5 text-[12px] font-semibold text-[color:var(--danger-ink)]" role="alert">{errors.name_uz || errors.flower}</p>}
      <Section>Sotuv qoidalari</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pochkada (dona)">
          <input className="inp" inputMode="numeric" value={perBunch} onChange={(e) => setPerBunch(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Minimal sotuv (dona)">
          <input className="inp" inputMode="numeric" value={minSale} onChange={(e) => setMinSale(e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      <Section>Rasm</Section>
      <ImageInput value={image} onChange={setImage} />
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px]">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
        Faol
      </label>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor qilish</button>
        <button onClick={save} disabled={saving} className={clsx("btn-primary", saving && "btn-loading")}>{variant ? "Saqlash" : "Qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}

export default function GullarPage() {
  const showToast = useStore((s) => s.showToast);
  const { canControl } = usePerm();
  const control = canControl("inventory");
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [variants, setVariants] = useState<FlowerVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [search, setSearch] = useState("");
  const [flowerModal, setFlowerModal] = useState<{ open: boolean; edit: Flower | null }>({ open: false, edit: null });
  const [variantModal, setVariantModal] = useState<{ open: boolean; edit: FlowerVariant | null }>({ open: false, edit: null });

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const [fs, vs] = await Promise.all([api.flowers(), api.flowerVariants()]);
      setFlowers(fs);
      setVariants(vs);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const fFlowers = q ? flowers.filter((f) => [f.name_uz, f.name_ru].some((x) => (x ?? "").toLowerCase().includes(q))) : flowers;
  const fVariants = q
    ? variants.filter((v) => [v.name_uz, v.name_ru, v.color_uz, v.flower_detail?.name_uz].some((x) => (x ?? "").toLowerCase().includes(q)))
    : variants;

  if (loading) return <FlowerLoader />;

  if (loadErr)
    return (
      <div className="mt-14 flex flex-col items-center gap-3">
        <p className="text-[14px] font-semibold" style={{ color: "var(--danger-ink)" }}>{loadErr}</p>
        <button onClick={() => { setLoading(true); load(); }} className="btn-secondary !flex-none px-6">Qayta urinish</button>
      </div>
    );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-[14px]" style={{ color: "var(--muted)" }}>
          {flowers.length} tur · {variants.length} nav — sklad va katalog shu ma&apos;lumotnomaga tayanadi.
        </p>
        <div className="ml-auto flex items-center gap-2">
          <div className="glass flex items-center gap-2 !rounded-[12px] px-3 py-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            <Icon name="search" size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish…" className="w-[150px] bg-transparent py-1.5 outline-none placeholder:text-[color:var(--muted)]" style={{ color: "var(--text)" }} aria-label="Gul qidirish" />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
        {/* Gul turlari */}
        <section className="glass p-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-base font-bold">Gul turlari</h2>
            {control && (
              <button onClick={() => setFlowerModal({ open: true, edit: null })} className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-bold text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: "var(--primary)" }}>
                <Plus size={16} strokeWidth={1.75} /> Gul turi
              </button>
            )}
          </div>
          <div className="flex flex-col">
            {fFlowers.map((f, i) => (
              <div key={f.id} onClick={() => control && setFlowerModal({ open: true, edit: f })} className="row-lux group flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(i * 35, 350)}ms` }}>
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {f.image_url && <img src={f.image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold" title={f.name_uz || f.name_ru}>
                    {f.name_uz || f.name_ru}
                    {!f.is_active && <span className="ml-2 rounded-full px-2 py-px text-[11px] font-bold" style={{ background: "var(--danger-soft)", color: "var(--danger-ink)" }}>NOFAOL</span>}
                  </div>
                  <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                    {f.season_start_month ? `Mavsum: ${MONTHS[f.season_start_month]} – ${MONTHS[f.season_end_month ?? f.season_start_month]}` : "Mavsum belgilanmagan"} · {variants.filter((v) => v.flower === f.id).length} nav
                  </div>
                </div>
                {control && (
                  <button onClick={(e) => { e.stopPropagation(); setFlowerModal({ open: true, edit: f }); }} className="row-actions icon-btn" title="Tahrirlash" aria-label="Tahrirlash">
                    <Pencil size={16} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            ))}
            {fFlowers.length === 0 && <EmptyState title={q ? "Topilmadi" : "Gul turi yo'q"} sub={q ? "Boshqa so'z bilan urinib ko'ring." : "Birinchi gul turini qo'shing."} />}
          </div>
        </section>

        {/* Navlar */}
        <section className="glass p-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-base font-bold">Navlar</h2>
            {control && (
              <button onClick={() => setVariantModal({ open: true, edit: null })} disabled={flowers.length === 0} className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-bold text-white transition-transform duration-200 hover:-translate-y-px disabled:opacity-50" style={{ background: "var(--primary)" }}>
                <Plus size={16} strokeWidth={1.75} /> Nav
              </button>
            )}
          </div>
          <div className="flex flex-col">
            {fVariants.map((v, i) => (
              <div key={v.id} onClick={() => control && setVariantModal({ open: true, edit: v })} className="row-lux group flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(i * 35, 350)}ms` }}>
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.image_url && <img src={v.image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold" title={`${v.flower_detail?.name_uz ?? ""} — ${v.name_uz || v.name_ru}`}>
                    {v.flower_detail?.name_uz} — {v.name_uz || v.name_ru}
                    {!v.is_active && <span className="ml-2 rounded-full px-2 py-px text-[11px] font-bold" style={{ background: "var(--danger-soft)", color: "var(--danger-ink)" }}>NOFAOL</span>}
                  </div>
                  <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                    {v.color_uz || "rang yo'q"} · pochkada {v.default_stems_per_bunch} dona · min. {v.minimum_sale_stems} dona
                  </div>
                </div>
                {control && (
                  <button onClick={(e) => { e.stopPropagation(); setVariantModal({ open: true, edit: v }); }} className="row-actions icon-btn" title="Tahrirlash" aria-label="Tahrirlash">
                    <Pencil size={16} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            ))}
            {fVariants.length === 0 && <EmptyState title={q ? "Topilmadi" : "Nav yo'q"} sub={q ? "Boshqa so'z bilan urinib ko'ring." : "Avval gul turini, so'ng navini qo'shing."} />}
          </div>
        </section>
      </div>

      {flowerModal.open && (
        <FlowerModal
          flower={flowerModal.edit}
          onClose={() => setFlowerModal({ open: false, edit: null })}
          onSaved={(f) => {
            setFlowers((fs) => {
              const i = fs.findIndex((x) => x.id === f.id);
              return i >= 0 ? fs.map((x) => (x.id === f.id ? f : x)) : [...fs, f];
            });
            setFlowerModal({ open: false, edit: null });
          }}
        />
      )}
      {variantModal.open && (
        <VariantModal
          variant={variantModal.edit}
          flowers={flowers}
          onClose={() => setVariantModal({ open: false, edit: null })}
          onSaved={(v) => {
            setVariants((vs) => {
              const i = vs.findIndex((x) => x.id === v.id);
              return i >= 0 ? vs.map((x) => (x.id === v.id ? v : x)) : [...vs, v];
            });
            setVariantModal({ open: false, edit: null });
          }}
        />
      )}
    </>
  );
}
