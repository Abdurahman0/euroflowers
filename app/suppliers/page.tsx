"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Phone, Plus, Trash2, Truck } from "lucide-react";
import { api } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt } from "@/lib/format";
import { stems } from "@/lib/inventory";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import ClearFilters from "@/components/ClearFilters";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { SupplierForm, SupplierDetail } from "@/components/SupplierModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { Supplier } from "@/lib/types";

/** Yetkazib beruvchilar — partiyalar shu manbaga bog'lanadi (backend: /api/suppliers/). */
const ACTIVE_OPTS = [
  { value: "", label: "Barchasi" },
  { value: "1", label: "Faol" },
  { value: "0", label: "Nofaol" },
];

export default function SuppliersPage() {
  const router = useRouter();
  const { showToast } = useStore();
  const { canControl } = usePerm();
  const control = canControl("inventory");
  const [rows, setRows] = useState<Supplier[] | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [form, setForm] = useState<{ open: boolean; edit: Supplier | null }>({ open: false, edit: null });
  const [detail, setDetail] = useState<Supplier | null>(null);
  const [confirmDel, setConfirmDel] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    api.suppliers({ ordering: "name", search: q || undefined, is_active: active === "" ? undefined : active === "1" })
      .then(setRows)
      .catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  }, [showToast, q, active]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  // ⚠️ CHUQUR HAVOLA — `?supplier=<id>` bo'lsa tafsilot QAYTA OCHILADI. Bu bo'lmasa
  // `?date_from=/?date_to=` URL'da qolib, yangilagandan keyin hech qayerga qo'llanmasdi
  // (oraliq «saqlangandek» ko'rinib, aslida yo'qolardi).
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !rows || typeof window === "undefined") return;
    const id = Number(new URLSearchParams(window.location.search).get("supplier"));
    if (!id) return;
    opened.current = true;
    const hit = rows.find((r) => r.id === id);
    if (hit) setDetail(hit);
    else api.supplier(id).then(setDetail).catch(() => showToast("Yetkazib beruvchi topilmadi"));
  }, [rows, showToast]);

  const doDelete = async () => {
    if (!confirmDel) return;
    const victim = confirmDel;
    // KLIENT GUARD: to'lovi bor postavshikni o'chirishga yo'l qo'ymaymiz. Backend bunday
    // holatda XATO BERMAYDI — jimgina soft-deaktivatsiya qiladi (204, is_active=false) —
    // shu bois owner tasodifan yo'qotmasligi uchun oldindan to'xtatamiz (jonli tekshirilgan).
    if (+(victim.paid_total ?? 0) > 0 || !!victim.last_payment_at) {
      setConfirmDel(null);
      showToast("Bu yetkazib beruvchida to'lovlar bor — avval to'lovlarni o'chiring (Hisob-kitob → Yetkazib beruvchilar)");
      return;
    }
    setDeleting(true);
    try {
      await api.deleteSupplier(victim.id);
      setConfirmDel(null);
      showToast("✓ Yetkazib beruvchi o'chirildi");
      load(); // haqiqiy holatni aks ettirish uchun qayta yuklaymiz
    } catch (e) {
      setConfirmDel(null);
      showToast(e instanceof Error ? e.message : "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  };

  const onSaved = (s: Supplier) => {
    setForm({ open: false, edit: null });
    setRows((rs) => {
      const list = rs ?? [];
      const i = list.findIndex((x) => x.id === s.id);
      return i >= 0 ? list.map((x) => (x.id === s.id ? s : x)) : [s, ...list];
    });
    setDetail((d) => (d?.id === s.id ? s : d));
  };

  if (rows === null) return <FlowerLoader />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Yetkazib beruvchilar ({rows.length}) — partiyalar shu manbaga bog&apos;lanadi
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Yetkazib beruvchi qidirish" />
          <FilterSelect value={active} options={ACTIVE_OPTS} onChange={setActive} label="Holat" />
          <ClearFilters show={!!(search || active)} onClear={() => { setSearch(""); setActive(""); }} />
          {control && (
            <button onClick={() => setForm({ open: true, edit: null })} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[13.5px]">
              <Plus size={17} strokeWidth={1.75} /> Yangi
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Yetkazib beruvchi yo'q" sub="Birinchi manbani qo'shing — partiya yaratishda tanlanadi." />
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
          {rows.map((s) => (
            <article
              key={s.id}
              onClick={() => setDetail(s)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setDetail(s)}
              className="glass card-hover group flex cursor-pointer flex-col gap-3 !rounded-[18px] p-4"
              style={{ opacity: s.is_active ? 1 : 0.55 }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                  <Truck size={20} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold" title={s.name}>{s.name}</div>
                  <div className="flex items-center gap-1 truncate text-[12.5px]" style={{ color: "var(--muted)" }}>
                    <Phone size={12} strokeWidth={2} /> {s.phone || "—"}
                  </div>
                </div>
                {control && (
                  <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setForm({ open: true, edit: s }); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setForm({ open: true, edit: s }); } }} className="icon-btn !h-7 !w-7" title="Tahrirlash" aria-label={`${s.name} — tahrirlash`}>
                      <Pencil size={13.5} strokeWidth={1.75} />
                    </span>
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setConfirmDel(s); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setConfirmDel(s); } }} className="icon-btn icon-btn-danger !h-7 !w-7" title="O'chirish" aria-label={`${s.name} — o'chirish`}>
                      <Trash2 size={13.5} strokeWidth={1.75} />
                    </span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] font-semibold text-tintink">{s.batches_count} partiya</span>
                <span className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] font-semibold text-tintink">{stems(s.total_received_stems)}</span>
                {/* ⚠️ QARZ USTUNI OLIB TASHLANDI — backend `outstanding`ni butunlay chiqarmaydi
                    (har xarid to'liq to'lanadi). O'rniga neytral «Umumiy sotib olingan». */}
                {+(s.purchase_total ?? 0) > 0 && (
                  <span className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] font-semibold text-tintink" title="Umumiy sotib olingan (tekin gul kirmaydi)">Sotib olingan {fmt(s.purchase_total)}</span>
                )}
                {!s.is_active && <span className="rounded-full bg-rose px-2.5 py-0.5 text-[12px] font-bold text-roseink">Nofaol</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      {form.open && <SupplierForm supplier={form.edit} onClose={() => setForm({ open: false, edit: null })} onSaved={onSaved} />}
      {detail && (
        <SupplierDetail
          supplier={detail}
          onClose={() => {
            setDetail(null);
            if (typeof window !== "undefined") {
              const u = new URL(window.location.href);
              for (const k of ["supplier", "date_from", "date_to"]) u.searchParams.delete(k);
              window.history.replaceState(null, "", u);
            }
          }}
          onEdit={control ? () => { setForm({ open: true, edit: detail }); setDetail(null); } : undefined}
          onOpenBatch={(bch) => { setDetail(null); router.push(`/sklad?tab=partiyalar&batch=${bch.id}`); }}
        />
      )}
      {confirmDel && (
        <ConfirmDialog
          title="Yetkazib beruvchini o'chirish"
          body={`«${confirmDel.name}» o'chirilsinmi? Bu amalni bekor qilib bo'lmaydi.`}
          confirmLabel="O'chirish"
          danger
          busy={deleting}
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </>
  );
}
