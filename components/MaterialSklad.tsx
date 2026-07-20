"use client";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import SearchInput from "./SearchInput";
import ClearFilters from "./ClearFilters";
import FilterSelect from "./FilterSelect";
import EmptyState from "./EmptyState";
import FlowerLoader from "./FlowerLoader";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmt, fmtTime } from "@/lib/format";
import { Icon } from "./icons";
import type { MaterialMovement, Packaging, PackagingType } from "@/lib/types";

/**
 * Material sklad — o'ram/savat/quti/aksessuarlar (backend: /api/materials/*,
 * ichkarida Packaging modeli). Kirim-chiqim movement orqali yuritiladi.
 */

const TYPE_LABEL: Record<string, string> = { wrap: "O'ram", basket: "Savat", box: "Quti", accessory: "Aksessuar" };
const TYPE_OPTS = [
  { value: "", label: "Barcha turlar" },
  ...(["wrap", "basket", "box", "accessory"] as const).map((t) => ({ value: t, label: TYPE_LABEL[t] })),
];

function MaterialModal({ material, onClose, onSaved }: { material: Packaging | null; onClose: () => void; onSaved: (m: Packaging) => void }) {
  const { user, showToast } = useStore();
  const branches = user?.profile.branches ?? [];
  const [f, setF] = useState({
    name_uz: material?.name_uz ?? "",
    name_ru: material?.name_ru ?? "",
    packaging_type: (material?.packaging_type ?? "wrap") as PackagingType,
    size: material?.size ?? "",
    cost_price: material ? String(Math.round(+material.cost_price)) : "",
    sale_price: material ? String(Math.round(+material.sale_price)) : "",
    quantity: material ? String(material.quantity) : "",
    branch: material?.branch ?? branches[0]?.id ?? 0,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!f.name_uz.trim()) return showToast("Nomini kiriting");
    setBusy(true);
    try {
      const payload = {
        name_uz: f.name_uz.trim(),
        name_ru: f.name_ru.trim() || f.name_uz.trim(),
        packaging_type: f.packaging_type,
        size: f.size.trim(),
        cost_price: f.cost_price ? String(+f.cost_price) : "0",
        sale_price: f.sale_price ? String(+f.sale_price) : "0",
        ...(material ? {} : { quantity: +f.quantity || 0 }),
        branch: f.branch,
        is_active: true,
      };
      const saved = material ? await api.updateMaterial(material.id, payload) : await api.createMaterial(payload);
      showToast(material ? "✓ Material yangilandi" : "✓ Material qo'shildi");
      onSaved(saved);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={480}>
      <ModalHeader icon={<Icon name="sklad" size={20} />} title={material ? "Materialni tahrirlash" : "Yangi material"} sub="O'ram, savat, quti yoki aksessuar" onClose={onClose} />
      <Section>Asosiy</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nomi (uz)" span>
          <input className="inp" value={f.name_uz} onChange={(e) => setF({ ...f, name_uz: e.target.value })} placeholder="Kraft o'ram" autoFocus={!material} />
        </Field>
        <Field label="Turi">
          <Select
            value={f.packaging_type}
            onChange={(v) => setF({ ...f, packaging_type: v as PackagingType })}
            options={(["wrap", "basket", "box", "accessory"] as const).map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
          />
        </Field>
        <Field label="O'lcham">
          <input className="inp" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} placeholder="M" />
        </Field>
        <Field label="Tannarx (so'm)">
          <input className="inp" type="number" value={f.cost_price} onChange={(e) => setF({ ...f, cost_price: e.target.value })} placeholder="8000" />
        </Field>
        <Field label="Sotuv narxi (so'm)">
          <input className="inp" type="number" value={f.sale_price} onChange={(e) => setF({ ...f, sale_price: e.target.value })} placeholder="20000" />
        </Field>
        {!material && (
          <Field label="Boshlang'ich soni">
            <input className="inp" type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} placeholder="50" />
          </Field>
        )}
        <Field label="Filial">
          <Select value={f.branch} onChange={(v) => setF({ ...f, branch: +v })} options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.code }))} />
        </Field>
      </div>
      <ModalFooter>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : material ? "Saqlash" : "Qo'shish"}</button>
        <button onClick={onClose} className="rounded-[14px] border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-5 py-3 text-sm font-bold">Bekor</button>
      </ModalFooter>
    </Modal>
  );
}

function MoveModal({ material, onClose, onDone }: { material: Packaging; onClose: () => void; onDone: () => void }) {
  const showToast = useStore((s) => s.showToast);
  const [type, setType] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = +qty || 0;
    if (n <= 0) return showToast("Sonini kiriting");
    if (type === "out" && n > material.quantity) return showToast(`Qoldiq yetarli emas: ${material.quantity} dona bor`);
    setBusy(true);
    try {
      // javob sxemasi kontraktda ko'rsatilmagan — ro'yxatni qayta yuklash ishonchli
      await api.materialMovement(material.id, { movement_type: type, quantity: n, reason: reason.trim() });
      showToast(`✓ ${type === "in" ? "Kirim" : "Chiqim"}: ${material.name_uz} × ${n}`);
      onDone();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={420}>
      <ModalHeader icon={<Icon name="sklad" size={20} />} title={material.name_uz} sub={`Qoldiq: ${material.quantity} dona — kirim yoki chiqim kiriting`} onClose={onClose} />
      <Section>Harakat</Section>
      <div className="mb-3 flex gap-1.5">
        {(["in", "out"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            aria-pressed={type === t}
            className={clsx("flex-1 rounded-xl border-[1.5px] py-2 text-[13px] font-bold transition-colors", type === t && "text-white")}
            style={type === t ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--border)", color: "var(--muted)" }}
          >
            {t === "in" ? "Kirim (+)" : "Chiqim (−)"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Soni (dona)">
          <input className="inp" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="10" autoFocus />
        </Field>
        <Field label="Sabab">
          <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "in" ? "Yangi partiya keldi" : "Buyurtmaga ishlatildi"} />
        </Field>
      </div>
      <ModalFooter>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
        <button onClick={onClose} className="rounded-[14px] border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-5 py-3 text-sm font-bold">Bekor</button>
      </ModalFooter>
    </Modal>
  );
}

export default function MaterialSklad() {
  const showToast = useStore((s) => s.showToast);
  const { canControl } = usePerm();
  const control = canControl("inventory");
  const [materials, setMaterials] = useState<Packaging[] | null>(null);
  const [moves, setMoves] = useState<MaterialMovement[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [formM, setFormM] = useState<{ open: boolean; edit: Packaging | null }>({ open: false, edit: null });
  const [moveM, setMoveM] = useState<Packaging | null>(null);

  const load = useCallback(async () => {
    try {
      const [ms, mv] = await Promise.all([
        api.materials({ is_active: true, packaging_type: type || undefined }),
        api.materialMovements({ ordering: "-created_at" }).catch(() => [] as MaterialMovement[]),
      ]);
      setMaterials(ms);
      setMoves(mv);
    } catch (e) {
      setMaterials([]);
      showToast(e instanceof Error ? e.message : "Materiallarni yuklashda xatolik");
    }
  }, [showToast, type]);

  useEffect(() => { load(); }, [load]);

  if (materials == null) return <FlowerLoader />;

  const q = search.trim().toLowerCase();
  const list = q ? materials.filter((m) => [m.name_uz, m.name_ru, m.size].some((x) => (x ?? "").toLowerCase().includes(q))) : materials;
  const totalQty = materials.reduce((a, m) => a + m.quantity, 0);
  const patch = (upd: Packaging) => setMaterials((ms) => (ms ?? []).map((x) => (x.id === upd.id ? { ...x, ...upd } : x)));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Material sklad: <b>{materials.length}</b> pozitsiya · jami {totalQty.toLocaleString("ru")} dona
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Material qidirish" />
          <FilterSelect value={type} onChange={setType} label="Turi" options={TYPE_OPTS} />
          <ClearFilters show={!!(search || type)} onClear={() => { setSearch(""); setType(""); }} />
          {control && (
            <button onClick={() => setFormM({ open: true, edit: null })} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[14px]">
              <Plus size={18} strokeWidth={1.75} /> Material qo&apos;shish
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(235px,1fr))" }}>
        {list.map((m) => {
          const low = m.quantity > 0 && m.quantity <= 10;
          return (
            <article key={m.id} className="glass card-hover relative flex flex-col gap-2 !rounded-[18px] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold" title={m.name_uz || m.name_ru}>{m.name_uz || m.name_ru}</div>
                  <div className="text-xs" style={{ color: "var(--mut)" }}>
                    {TYPE_LABEL[m.packaging_type] ?? m.packaging_type}{m.size ? ` · ${m.size}` : ""}
                  </div>
                </div>
                {control && (
                  <button onClick={() => setFormM({ open: true, edit: m })} className="icon-btn shrink-0" title="Tahrirlash" aria-label="Tahrirlash">
                    <Pencil size={15} strokeWidth={1.75} />
                  </button>
                )}
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[12px]" style={{ color: "var(--mut)" }}>Qoldiq</div>
                  <div className="text-sm font-bold">
                    {m.quantity} dona
                    {m.quantity === 0 && <span className="ml-1.5 rounded-full bg-rose px-2 py-0.5 text-[10.5px] font-bold text-roseink">TUGADI</span>}
                    {low && <span className="ml-1.5 rounded-full bg-peach px-2 py-0.5 text-[10.5px] font-bold text-peachink">KAM</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px]" style={{ color: "var(--mut)" }}>Narxi</div>
                  <div className="text-sm font-bold" style={{ color: "var(--acc)" }}>{fmt(m.sale_price)}</div>
                </div>
              </div>
              {control && (
                <button onClick={() => setMoveM(m)} className="rounded-xl border-[1.5px] py-2 text-[13px] font-bold hover:bg-tint" style={{ borderColor: "var(--line)" }}>
                  Kirim / chiqim
                </button>
              )}
            </article>
          );
        })}
        {list.length === 0 && (
          <div className="col-span-full">
            <EmptyState title={q || type ? "Filtrga mos material topilmadi" : "Material sklad bo'sh"} sub={q || type ? "Boshqa so'z yoki tur bilan urinib ko'ring." : "«Material qo'shish» orqali birinchi pozitsiyani kiriting."} />
          </div>
        )}
      </div>

      {/* material harakatlari jurnali */}
      <section className="glass mt-5 !rounded-[20px] p-5">
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="text-base font-bold">Material harakatlari</h2>
          <span className="text-xs" style={{ color: "var(--mut)" }}>so&apos;nggi kirim-chiqimlar</span>
        </div>
        {moves.map((mv, i) => {
          const isIn = mv.movement_type === "in";
          const md = mv.packaging_detail ?? mv.material_detail;
          const who = mv.performed_by_detail
            ? [mv.performed_by_detail.first_name, mv.performed_by_detail.last_name].filter(Boolean).join(" ") || mv.performed_by_detail.username
            : "Tizim";
          return (
            <div key={mv.id} className="row-lux flex items-center gap-3.5 border-t py-3" style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(i * 40, 480)}ms` }}>
              <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full ${isIn ? "bg-mint text-mintink" : "bg-peach text-peachink"}`}>
                {isIn ? <ArrowDown size={16} strokeWidth={2} /> : <ArrowUp size={16} strokeWidth={2} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">
                  {md?.name_uz || md?.name_ru || `Material #${mv.packaging ?? "—"}`} — {mv.quantity} dona
                  {mv.reason ? ` · ${mv.reason}` : ""}
                </div>
                <div className="mt-0.5 truncate text-xs" style={{ color: "var(--mut)" }}>{who} · {fmtTime(mv.created_at)}</div>
              </div>
              <span className={`min-w-[52px] rounded-full border px-2.5 py-0.5 text-center text-[11px] font-bold ${isIn ? "bg-mint text-mintink" : "bg-peach text-peachink"}`} style={{ borderColor: "var(--line2)" }}>
                {isIn ? "KIRIM" : "CHIQIM"}
              </span>
            </div>
          );
        })}
        {moves.length === 0 && <EmptyState title="Harakatlar hali yo'q" sub="Kirim yoki chiqim kiritilganda shu yerda ko'rinadi." />}
      </section>

      {formM.open && (
        <MaterialModal
          material={formM.edit}
          onClose={() => setFormM({ open: false, edit: null })}
          onSaved={(m) => {
            setFormM({ open: false, edit: null });
            if (formM.edit) patch(m);
            else load();
          }}
        />
      )}
      {moveM && (
        <MoveModal
          material={moveM}
          onClose={() => setMoveM(null)}
          onDone={() => { setMoveM(null); load(); }}
        />
      )}
    </>
  );
}
