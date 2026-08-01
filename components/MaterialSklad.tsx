"use client";
import { ArrowDown, ArrowUp, Box, Newspaper, Pencil, Plus, ShoppingBasket, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import SearchInput from "./SearchInput";
import ClearFilters from "./ClearFilters";
import EmptyState from "./EmptyState";
import FlowerLoader from "./FlowerLoader";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import { api, ApiError } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { useRouter } from "next/navigation";
import { fmt, fmtDate, fmtTime, movementLeadId } from "@/lib/format";
import { PACKAGING_LABEL, MATERIAL_DELIVERY } from "@/lib/inventory";
import { Icon } from "./icons";
import type { MaterialMovement, Packaging, PackagingType } from "@/lib/types";

/**
 * Material sklad — Buket qog'ozi / Savat / Quti / Aksessuarlar bo'yicha bo'limlangan
 * (backend: /api/materials/*, ichkarida Packaging modeli, packaging_type enum:
 * wrap|basket|box|other). Kirim-chiqim movement orqali yuritiladi.
 */

// backend enumi: wrap|basket|box|other (accessory YO'Q — eski qiymat other'ga tushiriladi)
const GROUP_ORDER: PackagingType[] = ["wrap", "basket", "box", "other"];
const GROUP_ICON: Record<string, LucideIcon> = { wrap: Newspaper, basket: ShoppingBasket, box: Box, other: Sparkles };
const TYPE_LABEL = PACKAGING_LABEL;
/** har qanday qiymatni backend enumiga tushiradi (eski "accessory" → "other") */
const normType = (t: string): PackagingType => (GROUP_ORDER.includes(t as PackagingType) ? (t as PackagingType) : "other");

export function MaterialModal({ material, onClose, onSaved }: { material: Packaging | null; onClose: () => void; onSaved: (m: Packaging) => void }) {
  const { showToast } = useStore();
  const [f, setF] = useState({
    name_uz: material?.name_uz ?? "",
    name_ru: material?.name_ru ?? "",
    packaging_type: normType(material?.packaging_type ?? "wrap"),
    size: material?.size ?? "",
    cost_price: material ? String(Math.round(+(material.cost_price ?? 0))) : "",
    sale_price: material ? String(Math.round(+(material.sale_price ?? 0))) : "",
    quantity: material ? String(material.quantity) : "",
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
          <input className="inp" value={f.name_uz} onChange={(e) => setF({ ...f, name_uz: e.target.value })} placeholder="Masalan: Kraft o'ram" autoFocus={!material} />
        </Field>
        <Field label="Turi">
          <Select
            value={f.packaging_type}
            onChange={(v) => setF({ ...f, packaging_type: v as PackagingType })}
            options={GROUP_ORDER.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
          />
        </Field>
        <Field label="O'lcham">
          <input className="inp" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} placeholder="Masalan: M" />
        </Field>
        <Field label="Tannarx (so'm)">
          <input className="inp" type="number" value={f.cost_price} onChange={(e) => setF({ ...f, cost_price: e.target.value })} placeholder="Masalan: 8000" />
        </Field>
        <Field label="Sotuv narxi (so'm)">
          <input className="inp" type="number" value={f.sale_price} onChange={(e) => setF({ ...f, sale_price: e.target.value })} placeholder="Masalan: 20000" />
        </Field>
        {!material && (
          <Field label="Boshlang'ich soni">
            <input className="inp" type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} placeholder="Masalan: 50" />
          </Field>
        )}
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : material ? "Saqlash" : "Qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}

/** ⚠️ CHIQIM (out) modali — KIRIM endi «Material yuki → Material kiritish» (receive) orqali
    (delivery + postavshik bilan). Stock qo'shishning IKKINCHI yo'li bo'lmasligi uchun bu yerda
    faqat chiqim/tuzatish qoladi (§0c). */
function MoveModal({ material, onClose, onDone }: { material: Packaging; onClose: () => void; onDone: () => void }) {
  const showToast = useStore((s) => s.showToast);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = +qty || 0;
    if (n <= 0) return showToast("Sonini kiriting");
    if (n > material.quantity) return showToast(`Qoldiq yetarli emas: ${material.quantity} dona bor`);
    setBusy(true);
    try {
      await api.materialMovement(material.id, { movement_type: "out", quantity: n, reason: reason.trim() });
      showToast(`✓ Chiqim: ${material.name_uz} × ${n}`);
      onDone();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={420}>
      <ModalHeader icon={<Icon name="sklad" size={20} />} title={material.name_uz} sub={`Qoldiq: ${material.quantity} dona — chiqim kiriting`} onClose={onClose} />
      <p className="mb-3 rounded-[11px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
        Kirim endi «Material yuklari → Material kiritish» orqali (postavshik va tannarx bilan).
      </p>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Chiqim soni (dona)">
          <input className="inp" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="Masalan: 10" autoFocus />
        </Field>
        <Field label="Sabab">
          <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: buyurtmaga ishlatildi" />
        </Field>
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Chiqim"}</button>
      </ModalFooter>
    </Modal>
  );
}

/** Material batafsil — oxirgi postavshik bloki + kirim tarixi (delivery + unit_cost, eng yangi birinchi). */
function MaterialDetailModal({ material, onClose }: { material: Packaging; onClose: () => void }) {
  const [moves, setMoves] = useState<MaterialMovement[] | null>(null);
  useEffect(() => { api.materialMovements({ packaging: material.id, ordering: "-created_at", page_size: 50 }).then(setMoves).catch(() => setMoves([])); }, [material.id]);
  const ld = material.last_delivery;
  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader icon={<Icon name="sklad" size={20} />} title={material.name_uz || material.name_ru} sub={`${TYPE_LABEL[normType(material.packaging_type)]}${material.size ? ` · ${material.size}` : ""} · qoldiq ${material.quantity} dona`} onClose={onClose} />

      <Section>Oxirgi postavshik</Section>
      {ld ? (
        <div className="rounded-[13px] border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="text-[13px] font-bold">{ld.supplier ?? "postavshiksiz"}</div>
          <div className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
            Material yuki {ld.number} · {fmtDate(ld.received_at)}{ld.quantity != null ? ` · ${ld.quantity} dona` : ""}{ld.unit_cost != null && +ld.unit_cost > 0 ? ` · ${fmt(ld.unit_cost)}/dona` : ""}
          </div>
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>Hali kirim bo&apos;lmagan — postavshik ma&apos;lumoti yo&apos;q.</p>
      )}

      <Section>Kirim tarixi</Section>
      {moves === null ? <p className="text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p> : moves.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>Harakatlar hali yo&apos;q.</p>
      ) : (
        <div className="flex flex-col">
          {moves.map((mv) => {
            const isIn = mv.movement_type === "in";
            return (
              <div key={mv.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--line2)" }}>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{isIn ? "KIRIM" : "CHIQIM"} · {mv.quantity} dona{mv.reason ? <span className="font-normal" style={{ color: "var(--text-2)" }}> — {mv.reason}</span> : null}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{fmtTime(mv.created_at)}</div>
                </div>
                <div className="text-right text-[12px]">
                  {/* ⚠️ ESKI yozuvlarda delivery/unit_cost null — bo'sh joy yoki "null" ko'rsatmaymiz */}
                  {mv.unit_cost != null && +mv.unit_cost > 0 && <span className="font-semibold tabular-nums" style={{ color: "var(--text-2)" }}>{fmt(mv.unit_cost)}/dona</span>}
                  {mv.delivery != null && <span className="ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>yuk #{mv.delivery}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/** Material harakatlari jurnali — Sklad sahifasining «Jurnal» bo'limida ko'rsatiladi. */
export function MaterialMovesJournal() {
  const router = useRouter();
  const [moves, setMoves] = useState<MaterialMovement[]>([]);
  const load = useCallback(() => {
    api.materialMovements({ ordering: "-created_at" }).then(setMoves).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  return (
    <section className="glass mt-5 !rounded-[20px] p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-base font-bold">Material harakatlari</h2>
        <span className="text-xs" style={{ color: "var(--mut)" }}>so&apos;nggi kirim-chiqimlar</span>
      </div>
      {moves.map((mv, i) => {
        const isIn = mv.movement_type === "in";
        const md = mv.packaging_detail ?? mv.material_detail;
        const leadId = movementLeadId(mv);
        const who = mv.performed_by_detail
          ? [mv.performed_by_detail.first_name, mv.performed_by_detail.last_name].filter(Boolean).join(" ") || mv.performed_by_detail.username
          : "Tizim";
        return (
          <div
            key={mv.id}
            onClick={leadId ? () => router.push(`/buyurtmalar?order=${leadId}`) : undefined}
            role={leadId ? "link" : undefined}
            tabIndex={leadId ? 0 : undefined}
            onKeyDown={leadId ? (e) => e.key === "Enter" && router.push(`/buyurtmalar?order=${leadId}`) : undefined}
            title={leadId ? `Buyurtma #${leadId} kartasini ochish` : undefined}
            className={`row-lux flex items-center gap-3.5 border-t py-3 ${leadId ? "cursor-pointer" : ""}`}
            style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(i * 40, 480)}ms` }}
          >
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
            {leadId != null && (
              <span className="shrink-0 whitespace-nowrap text-[11.5px] font-bold" style={{ color: "var(--primary)" }}>Buyurtma #{leadId} ↗</span>
            )}
            <span className={`min-w-[52px] rounded-full border px-2.5 py-0.5 text-center text-[11px] font-bold ${isIn ? "bg-mint text-mintink" : "bg-peach text-peachink"}`} style={{ borderColor: "var(--line2)" }}>
              {isIn ? "KIRIM" : "CHIQIM"}
            </span>
          </div>
        );
      })}
      {moves.length === 0 && <EmptyState title="Harakatlar hali yo'q" sub="Kirim yoki chiqim kiritilganda shu yerda ko'rinadi." />}
    </section>
  );
}

/** Bitta material kartasi — qoldiq, narx, oxirgi postavshik, chiqim. Karta bosilsa batafsil. */
function MaterialCard({ m, control, onEdit, onMove, onDetail }: { m: Packaging; control: boolean; onEdit: () => void; onMove: () => void; onDetail: () => void }) {
  const low = m.quantity > 0 && m.quantity <= 10;
  const ld = m.last_delivery;
  return (
    <article className="glass card-hover relative flex cursor-pointer flex-col gap-2 !rounded-[18px] p-4" role="button" tabIndex={0} onClick={onDetail} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDetail(); } }} title="Batafsil va tarix">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold" title={m.name_uz || m.name_ru}>{m.name_uz || m.name_ru}</div>
          <div className="text-xs" style={{ color: "var(--mut)" }}>
            {TYPE_LABEL[normType(m.packaging_type)]}{m.size ? ` · ${m.size}` : ""}
          </div>
        </div>
        {control && (
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="icon-btn shrink-0" title="Tahrirlash" aria-label="Tahrirlash">
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
      {/* ⚠️ OXIRGI POSTAVSHIK — last_delivery.supplier; null bo'lsa TOZA tire (bo'sh/crash emas) */}
      <div className="truncate text-[11.5px]" style={{ color: "var(--mut)" }} title={ld ? `${MATERIAL_DELIVERY.lastSupplier}: ${ld.supplier ?? "—"} · ${ld.number} · ${fmtDate(ld.received_at)}` : undefined}>
        {MATERIAL_DELIVERY.lastSupplier}: {ld ? (
          <><b style={{ color: "var(--text-2)" }}>{ld.supplier ?? "—"}</b> <span style={{ color: "var(--mut)" }}>· {ld.number} · {fmtDate(ld.received_at)}</span></>
        ) : "—"}
      </div>
      {control && (
        <button onClick={(e) => { e.stopPropagation(); onMove(); }} className="rounded-xl border-[1.5px] py-2 text-[13px] font-bold hover:bg-tint" style={{ borderColor: "var(--line)" }}>
          Chiqim
        </button>
      )}
    </article>
  );
}

export default function MaterialSklad() {
  const showToast = useStore((s) => s.showToast);
  const { canControl } = usePerm();
  const control = canControl("inventory");
  const [materials, setMaterials] = useState<Packaging[] | null>(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<"" | PackagingType>("");
  const [formM, setFormM] = useState<{ open: boolean; edit: Packaging | null }>({ open: false, edit: null });
  const [moveM, setMoveM] = useState<Packaging | null>(null);
  const [detailM, setDetailM] = useState<Packaging | null>(null); // batafsil + kirim tarixi

  const load = useCallback(async () => {
    try {
      // barchasini olamiz — guruhlash va sanoqlar klient tomonda (chip filtri bilan)
      setMaterials(await api.materials({ is_active: true }));
    } catch (e) {
      setMaterials([]);
      showToast(e instanceof Error ? e.message : "Materiallarni yuklashda xatolik");
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  const patch = (upd: Packaging) => setMaterials((ms) => (ms ?? []).map((x) => (x.id === upd.id ? { ...x, ...upd } : x)));

  // qidiruv + guruhlash (chip filtri saqlangan holda sanoqlar to'liq bo'lishi uchun avval qidiruv)
  const q = search.trim().toLowerCase();
  const searched = useMemo(
    () => (q ? (materials ?? []).filter((m) => [m.name_uz, m.name_ru, m.size].some((x) => (x ?? "").toLowerCase().includes(q))) : (materials ?? [])),
    [materials, q]
  );
  const byGroup = useMemo(() => {
    const g = new Map<PackagingType, Packaging[]>();
    GROUP_ORDER.forEach((k) => g.set(k, []));
    searched.forEach((m) => g.get(normType(m.packaging_type))!.push(m));
    return g;
  }, [searched]);

  if (materials == null) return <FlowerLoader />;

  const totalQty = materials.reduce((a, m) => a + m.quantity, 0);
  const visibleGroups = GROUP_ORDER.filter((k) => (group ? k === group : (byGroup.get(k)!.length > 0)));
  const nothing = searched.length === 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Material sklad: <b>{materials.length}</b> pozitsiya · jami {totalQty.toLocaleString("ru")} dona
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Material qidirish" />
          <ClearFilters show={!!(search || group)} onClear={() => { setSearch(""); setGroup(""); }} />
          {control && (
            <button onClick={() => setFormM({ open: true, edit: null })} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[14px]">
              <Plus size={18} strokeWidth={1.75} /> Material qo&apos;shish
            </button>
          )}
        </div>
      </div>

      {/* guruh chip qatori — har birida sanoq */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        <button
          onClick={() => setGroup("")}
          aria-pressed={group === ""}
          className={clsx("rounded-full border-[1.5px] px-4 py-1.5 text-[12.5px] font-bold transition-colors", group === "" ? "text-white" : "bg-sfc")}
          style={group === "" ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}
        >
          Barchasi <span className="opacity-70">{searched.length}</span>
        </button>
        {GROUP_ORDER.map((k) => {
          const GIcon = GROUP_ICON[k];
          const n = byGroup.get(k)!.length;
          const on = group === k;
          return (
            <button
              key={k}
              onClick={() => setGroup(on ? "" : k)}
              aria-pressed={on}
              className={clsx("flex items-center gap-1.5 rounded-full border-[1.5px] px-4 py-1.5 text-[12.5px] font-bold transition-colors", on ? "text-white" : "bg-sfc")}
              style={on ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}
            >
              <GIcon size={14} strokeWidth={2} /> {TYPE_LABEL[k]} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {nothing ? (
        <EmptyState
          title={search ? "Qidiruvga mos material topilmadi" : "Material sklad bo'sh"}
          sub={search ? "Boshqa so'z bilan urinib ko'ring." : "«Material qo'shish» orqali birinchi pozitsiyani kiriting."}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {visibleGroups.map((k) => {
            const items = byGroup.get(k)!;
            if (!items.length) return null;
            const GIcon = GROUP_ICON[k];
            const groupQty = items.reduce((a, m) => a + m.quantity, 0);
            return (
              <section key={k}>
                {/* sarlavha note-chip yuzasida — Rasm/Video fonida ham o'qiladi (kontrast kafolati) */}
                <div className="note-chip !mb-2.5 inline-flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-[8px]" style={{ background: "var(--primary-soft, var(--hover))", color: "var(--primary)" }}>
                    <GIcon size={15} strokeWidth={2} />
                  </span>
                  <h3 className="text-[14px] font-bold">{TYPE_LABEL[k]}</h3>
                  <span className="text-[12px]" style={{ color: "var(--mut)" }}>{items.length} pozitsiya · {groupQty.toLocaleString("ru")} dona</span>
                </div>
                <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(235px,1fr))" }}>
                  {items.map((m) => (
                    <MaterialCard key={m.id} m={m} control={control} onEdit={() => setFormM({ open: true, edit: m })} onMove={() => setMoveM(m)} onDetail={() => setDetailM(m)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {formM.open && (
        <MaterialModal
          material={formM.edit}
          onClose={() => setFormM({ open: false, edit: null })}
          onSaved={(m) => {
            setFormM({ open: false, edit: null });
            if (formM.edit) patch(m);
            else load();
            notifyReportDataChanged(); // material tannarxi/qoldig'i → hisobot
          }}
        />
      )}
      {moveM && (
        <MoveModal
          material={moveM}
          onClose={() => setMoveM(null)}
          onDone={() => { setMoveM(null); notifyReportDataChanged(); load(); }}
        />
      )}
      {detailM && <MaterialDetailModal material={detailM} onClose={() => setDetailM(null)} />}
    </>
  );
}
