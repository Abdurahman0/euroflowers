"use client";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Image as ImageIcon, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { usePagedList } from "@/lib/usePagedList";
import Pagination from "@/components/Pagination";
import RefreshButton from "@/components/RefreshButton";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import ConfirmDialog from "@/components/ConfirmDialog";
import AiCatalogModal from "@/components/AiCatalogModal";
import { fmt } from "@/lib/format";
import type { AICatalogItem } from "@/lib/types";

/**
 * AI KATALOG — /api/ai-catalog/ (spec §4–§7, backend 20.08.2026).
 *
 * ⚠️ CRM KATALOGI («Kunlik katalog») BILAN ARALASHTIRILMAYDI — spec §8:
 *      /api/catalog/    → ichki sotuv, sklad, florist, sotildi/arxiv hisoblari
 *      /api/ai-catalog/ → AI mijozga ko'rsatadigan ALOHIDA vitrina
 *    Shu bois bu ALOHIDA sahifa va yon menyuda alohida yozuv.
 *
 * ⚠️ Bu yerdagi son/narx SKLADGA TA'SIR QILMAYDI: yozuv sotilganda hech nima
 *    yechilmaydi. Operator buni bilishi uchun sarlavhada ochiq yozilgan.
 */

const TYPE_OPTS = [
  { value: "", label: "Barcha turlar" },
  { value: "bouquet", label: "Buket" },
  { value: "basket", label: "Savat" },
  { value: "box", label: "Quti" },
  { value: "other", label: "Boshqa" },
];
const ACTIVE_OPTS = [
  { value: "", label: "Faol va nofaol" },
  { value: "true", label: "Faqat faol" },
  { value: "false", label: "Faqat nofaol" },
];
const typeLabel = (v?: string) => TYPE_OPTS.find((x) => x.value === v)?.label ?? v ?? "—";
const VOL_LABEL: Record<string, string> = { small: "Kichik", medium: "O'rta", large: "Katta" };
const volLabel = (v?: string) => (v ? VOL_LABEL[v] ?? v : "");
const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);

export default function AiCatalogPage() {
  const { showToast } = useStore();
  const { canControl } = usePerm();
  // ⚠️ Tahrirlash huquqi ham `ai_catalog` (yon menyu va marshrut qo'riqchisi bilan bir xil).
  const control = canControl("ai_catalog");

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [activeF, setActiveF] = useState("");
  /** `undefined` — oyna yopiq; `null` — yangi yozuv; obyekt — tahrir */
  const [edit, setEdit] = useState<AICatalogItem | null | undefined>(undefined);
  const [del, setDel] = useState<AICatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ⚠️ SERVER SAHIFALASH — uy uslubi: bitta sahifa = bitta so'rov.
  const paged = usePagedList<AICatalogItem>({
    fetcher: (query, signal) => api.aiCatalogPage(query, signal),
    filters: {
      ordering: "-created_at",
      search: q || undefined,
      arrangement_type: type || undefined,
      is_active: activeF || undefined,
    },
    defaultPageSize: 50,
  });
  const rows = paged.rows;
  const { refresh, loadedAt } = useAutoRefresh(paged.refresh);
  useEffect(() => { if (paged.error) showToast(paged.error); }, [paged.error, showToast]);

  // ⚠️ TOTALS — SERVERDAN (spec §6), joriy filtr bo'yicha. Klientda qayta sanalmaydi.
  const totals = paged.totals as Record<string, unknown> | undefined;
  const byType = (totals?.by_arrangement_type ?? {}) as Record<string, number>;
  const typeLine = useMemo(
    () => Object.entries(byType).filter(([, v]) => n(v) > 0).map(([k, v]) => `${typeLabel(k)} ${v}`).join(" · "),
    [byType],
  );

  const remove = async () => {
    if (!del || deleting) return;
    setDeleting(true);
    try {
      await api.deleteAICatalogItem(del.id);
      showToast("✓ O'chirildi");
      setDel(null);
      paged.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  };

  if (!paged.ready && paged.loading) return <FlowerLoader />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight">
            <Sparkles size={21} strokeWidth={2} style={{ color: "var(--primary)" }} /> AI katalog
          </div>
          {/* ⚠️ Chalkashmasin: bu vitrina, sklad emas */}
          <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
            AI mijozga ko&apos;rsatadigan vitrina · <b>skladga ta&apos;sir qilmaydi</b> va «Kunlik katalog» bilan aralashmaydi
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <RefreshButton onRefresh={refresh} loadedAt={loadedAt} busy={paged.loading} />
          <SearchInput value={search} onChange={setSearch} ariaLabel="AI katalog qidirish" placeholder="Nomi yoki izohi…" />
          <FilterSelect value={type} onChange={setType} label="Turi" options={TYPE_OPTS} />
          <FilterSelect value={activeF} onChange={setActiveF} label="Holat" options={ACTIVE_OPTS} />
          {control && (
            <button onClick={() => setEdit(null)} className="btn-primary !h-10 !px-4">
              <Plus size={17} strokeWidth={2} /> Qo&apos;shish
            </button>
          )}
        </div>
      </div>

      {/* ⚠️ SPEC §6 — server totals: yozuv soni, dona, qiymat, faol/nofaol, turlar */}
      <div className="mb-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        {[
          { label: "Yozuvlar", v: String(n(totals?.items) || paged.info.count), sub: typeLine || "tur bo'yicha yo'q" },
          { label: "Jami dona", v: String(n(totals?.quantity_total)), sub: "vitrinadagi soni" },
          { label: "Vitrina qiymati", v: fmt(n(totals?.value_total)), sub: "narx × soni" },
          { label: "Faol", v: String(n(totals?.active)), sub: `nofaol ${n(totals?.inactive)}`, hue: "var(--success-ink, #3d8a5f)" },
        ].map((c) => (
          <div key={c.label} className="glass !rounded-[16px] p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--muted)" }}>{c.label}</div>
            <div className="mt-1 text-[20px] font-extrabold tabular-nums" style={{ color: c.hue ?? "var(--text)" }}>{c.v}</div>
            <div className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--mut)" }} title={c.sub}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-[18px] border px-4 py-2.5" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--surface-solid) 72%, transparent)" }}>
        <Pagination info={paged.info} onPage={paged.setPage} alwaysShow label="yozuv" busy={paged.loading} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={q || type || activeF ? "Mos yozuv yo'q" : "AI katalog bo'sh"}
          sub={q || type || activeF ? "Filtrlarni o'zgartirib ko'ring." : "Mijozlarga AI ko'rsatishi uchun birinchi mahsulotni qo'shing."}
        />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
          {rows.map((x) => (
            <article key={x.id} className="glass card-hover group flex flex-col overflow-hidden !rounded-[20px]" style={{ opacity: x.is_active === false ? 0.55 : 1 }}>
              <div className="relative h-[180px] bg-bg2">
                {x.image_url
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={x.image_url} alt={x.name} className="h-full w-full object-cover" />
                  : <div className="flex h-full items-center justify-center"><ImageIcon size={30} strokeWidth={1.5} style={{ color: "var(--muted)" }} /></div>}
                <span className="absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                  style={{ borderColor: "var(--border-strong)", background: "var(--surface-solid)", color: "var(--text-2)" }}>
                  {typeLabel(x.arrangement_type)}
                </span>
                {x.is_active === false && (
                  <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: "var(--acc)" }}>
                    NOFAOL
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 text-[15px] font-bold tracking-tight">{x.name}</h3>
                  <span className="shrink-0 text-[14px] font-extrabold" style={{ color: "var(--acc)" }}>{fmt(x.price)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11.5px] font-bold">
                  <span className="rounded-full bg-tint px-2.5 py-0.5">{n(x.quantity)} ta</span>
                  {x.volume && <span className="rounded-full bg-tint px-2.5 py-0.5">{volLabel(x.volume)}</span>}
                </div>
                {x.note && <p className="line-clamp-3 text-[12.5px] leading-relaxed" style={{ color: "var(--mut)" }}>{x.note}</p>}
                <div className="mt-auto flex items-center gap-2 pt-2">
                  {x.instagram_link && (
                    <a href={x.instagram_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] font-bold underline-offset-2 hover:underline"
                      style={{ color: "var(--primary)" }} title={x.instagram_link}>
                      <ExternalLink size={12} strokeWidth={2.2} /> Instagram
                    </a>
                  )}
                  {control && (
                    <span className="ml-auto flex items-center gap-1">
                      <button onClick={() => setEdit(x)} className="icon-btn !h-7 !w-7" title="Tahrirlash" aria-label={`${x.name} — tahrirlash`}>
                        <Pencil size={13.5} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => setDel(x)} className="icon-btn icon-btn-danger !h-7 !w-7" title="O'chirish" aria-label={`${x.name} — o'chirish`}>
                        <Trash2 size={13.5} strokeWidth={1.75} />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {edit !== undefined && (
        <AiCatalogModal item={edit} onClose={() => setEdit(undefined)} onSaved={() => { setEdit(undefined); paged.refresh(); }} />
      )}

      {del && (
        <ConfirmDialog
          title="AI katalogdan o'chirish"
          body={`«${del.name}» vitrinadan butunlay o'chirilsinmi?`}
          note="Sklad va sotuv hisoblariga ta'sir qilmaydi — bu faqat AI ko'rsatadigan yozuv."
          confirmLabel="O'chirish"
          danger
          busy={deleting}
          onConfirm={remove}
          onCancel={() => setDel(null)}
        />
      )}
    </>
  );
}
