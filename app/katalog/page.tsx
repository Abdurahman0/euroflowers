"use client";
import { Info, Pencil, Plus, Recycle, Send, Sparkles, Trash2, User, X } from "lucide-react";
import { batchTitleNoHeight } from "@/lib/stockLabel";
import clsx from "clsx";
import { createPortal } from "react-dom";
import EmptyState from "@/components/EmptyState";
import RefreshButton from "@/components/RefreshButton";
import FlowerLoader from "@/components/FlowerLoader";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt, fmtTime, initials } from "@/lib/format";
import { catalogWaiting, compareCatalogNewestFirst } from "@/lib/inventory";
import { catalogRemaining } from "@/lib/rework";
import { catalogHasCostData } from "@/lib/branch";
import { CATALOG_STATUS_LABEL, ARRANGEMENT_LABEL } from "@/components/badges";
import KatalogModal from "@/components/KatalogModal";
import KatalogViewModal from "@/components/KatalogViewModal";
import KatalogSellModal from "@/components/KatalogSellModal";
import CatalogTransferDrawer from "@/components/CatalogTransferDrawer";
import CatalogRestoreDrawer from "@/components/CatalogRestoreDrawer";
import { usePerm } from "@/lib/store";
import { isBranchUser } from "@/lib/branch";
import CatalogSalesTab from "@/components/CatalogSalesTab";
import RestavratsiyaTab from "@/components/RestavratsiyaTab";
import RestavratsiyaModal from "@/components/RestavratsiyaModal";
import Pagination from "@/components/Pagination";
import BouquetVolumeSummary from "@/components/BouquetVolumeSummary";
import { usePagedList } from "@/lib/usePagedList";
import type { BouquetVolumeSummary as BouquetVolumeRow, CatalogItem, FloristProfile, Reservation } from "@/lib/types";
import { deductionState } from "@/lib/catalogStock";
import { floristLabel, type FloristLike } from "@/lib/floristLabel";

/** ⚠️ Florist ismi — `lib/floristLabel` dan. Katalog javobidagi `florist_detail`
    YUPQA shaklda keladi (`{id, name}`, `user_detail` YO'Q), shuning uchun faqat
    `user_detail` ni o'qiydigan eski helper ekranga «#4» chiqarardi. */
const floristName = (fp?: FloristLike, readyName?: string | null): string => floristLabel(fp, readyName);

const compositionText = (k: CatalogItem) =>
  (k.composition ?? [])
    .map((c) => `${batchTitleNoHeight(c.batch_detail, "")} ${c.quantity_stems} dona`.trim())
    .join(" · ") || "Tarkibni batafsil ko'rish mumkin";

/** KUTAYAPTI: florist katalogi, gul tanlangan lekin soni 0 (chiqim yopilmagan). ⚠️ §0c: material
    va florist haqi ALLAQACHON tannarxda — faqat GUL tannarxi hali qo'shilmagan. «Gul taqsimlanmagan» chip. */
// ⚠️ «kutayapti» = florist katalogi, gul tanlangan lekin soni hali 0 (chiqim yopilmagan).
// Yagona manba: catalogWaiting (eski bo'sh-kompozitsiyali itemlarni ham qamraydi).
const isUndistributed = (k: CatalogItem) => catalogWaiting(k);

// ⚠️ BROWSING FILTRI (server hisobotlariga TA'SIR QILMAYDI — sotilgan itemlar tarixiy fakt).
// StatusBcdEnum = draft/available/reserved/sold/archived. «Sotilgan» = status sold YOKI soni to'lgan
// (quantity_sold >= quantity_total) — soni AVTORITATIV, status «available» qolib ketgan bo'lsa ham.
type StatusView = "sotuvda" | "sold" | "archived" | "all";
const STATUS_VIEWS: { value: StatusView; label: string }[] = [
  { value: "sotuvda", label: "Sotuvda" },
  { value: "sold", label: "Sotilgan" },
  { value: "archived", label: "Arxiv" },
  { value: "all", label: "Barchasi" },
];

const ARR_OPTS = [
  { value: "", label: "Barcha turlar" },
  { value: "bouquet", label: "Buket" },
  { value: "basket", label: "Savat" },
  { value: "box", label: "Quti" },
];

export default function KatalogPage() {
  const { showToast, loadNotifs } = useStore();
  const { canControl } = usePerm();
  const control = canControl("catalog");
  // filial foydalanuvchisi: katalog YARATOLMAYDI (+Katalog yashiriladi) va yuborolmaydi;
  // asosiy filial admini (mainUser) — filialga yuborishi mumkin.
  const branchUser = isBranchUser(useStore((s) => s.user?.profile.branch));
  const mainUser = !branchUser;
  const [transferItem, setTransferItem] = useState<CatalogItem | null>(null);
  const [restoreItem, setRestoreItem] = useState<CatalogItem | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  // ko'rish / tahrirlash / o'chirish
  const [undistribOnly, setUndistribOnly] = useState(false); // «Gul taqsimlanmagan» klient filtri
  const [viewItem, setViewItem] = useState<CatalogItem | null>(null);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [confirmDel, setConfirmDel] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  // server filtrlari
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [arrType, setArrType] = useState("");
  // HOLAT KO'RINISHI — KLIENT filtri (Sotuvda default). Sotilgan/arxiv/soni-to'lgan sukut YASHIRINADI.
  // URL ?status= da saqlanadi (ulashiladi + refresh'dan omon qoladi). Server hammasini qaytaradi.
  const [statusView, setStatusView] = useState<StatusView>(() => {
    if (typeof window === "undefined") return "sotuvda";
    const s = new URLSearchParams(window.location.search).get("status");
    return s === "sold" || s === "archived" || s === "all" || s === "sotuvda" ? s : "sotuvda";
  });
  // ⚠️ ?tab= konvensiyasi — «Katalog» SUKUT, «Sotuvlar» va «Restavratsiya» qo'shimcha
  const [tab, setTab] = useState<"katalog" | "sotuvlar" | "restavratsiya">("katalog");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "sotuvlar" || t === "restavratsiya") setTab(t);
  }, []);
  // RESTAVRATSIYA formasi — `source` bo'lsa o'sha katalog manba sifatida oldindan qo'yiladi
  const [reworkOpen, setReworkOpen] = useState<{ source: CatalogItem | null } | null>(null);
  // florist va katalog turi — SERVER filtrlari (?florist= va ?catalog_kind= mavjud)
  const [floristFilter, setFloristFilter] = useState("");
  const [decorationFilter, setDecorationFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  // MIJOZ filtri — URL ?customer=<id> orqali (mijoz sahifasidan / chipdan); tozalanadigan banner
  const [customerFilter, setCustomerFilter] = useState<{ id: number; label: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ⚠️ BITTA SAHIFA = BITTA SO'ROV. Keyingi sahifa faqat foydalanuvchi bosganda olinadi.
  const catalogFilters = useMemo(() => ({
    ordering: "-created_at",
    status_group: statusView === "sotuvda" ? "available" : statusView,
    search: q || undefined,
    arrangement_type: arrType || undefined,
    florist: floristFilter || undefined,
    decoration_florist: decorationFilter || undefined,
    catalog_kind: kindFilter || undefined,
    customer: customerFilter?.id || undefined,
  }), [statusView, q, arrType, floristFilter, decorationFilter, kindFilter, customerFilter]);
  const paged = usePagedList<CatalogItem>({
    fetcher: (query, signal) => api.catalogPage(query, signal),
    filters: catalogFilters,
    defaultPageSize: 50,
  });
  const loading = paged.loading;
  const load = paged.refresh;
  useEffect(() => { setItems(paged.rows); }, [paged.rows]);
  useEffect(() => {
    if (paged.error) showToast(paged.error);
  }, [paged.error, showToast]);
  // ⚠️ avtomatik taymer YO'Q — «Yangilash» tugmasi orqali (RefreshButton)
  const { refresh, loadedAt } = useAutoRefresh(load);

  // florist ro'yxati — filtr uchun (bir marta)
  useEffect(() => { api.florists({ is_active: true, ordering: "user", page_size: "all" }).then(setFlorists).catch(() => {}); }, []);

  // URL ?status= o'qish (ulashilgan link / refresh o'sha ko'rinishga tushadi) — mount'da bir marta
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = new URLSearchParams(window.location.search).get("status");
    if (s === "sold" || s === "archived" || s === "all" || s === "sotuvda") setStatusView(s);
  }, []);
  const changeStatusView = (v: StatusView) => {
    setStatusView(v);
    setUndistribOnly(false); // holat almashganda «taqsimlanmagan» filtrini tozalaymiz (chalkashmasin)
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if (v === "sotuvda") u.searchParams.delete("status"); else u.searchParams.set("status", v);
      window.history.replaceState(null, "", u);
    }
  };

  // URL ?customer=<id> — mijoz nomini olib banner ko'rsatamiz (server filtri qo'llanadi)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cid = Number(new URLSearchParams(window.location.search).get("customer"));
    if (!cid) return;
    api.customer(cid)
      .then((c) => setCustomerFilter({ id: cid, label: `${c.name || "Mijoz"}${c.masked_phone ? ` · ${c.masked_phone}` : ""}` }))
      .catch(() => setCustomerFilter({ id: cid, label: `#${cid}` }));
  }, []);

  // HOLAT bo'yicha sonlar (chip yorliqlari) + tanlangan ko'rinish bo'yicha filtrlangan ro'yxat
  const statusTotals = (paged.totals?.status_counts ?? paged.totals?.by_status) as Record<string, unknown> | undefined;
  const statusCounts = useMemo(() => {
    const all = Number(statusTotals?.all ?? paged.totals?.items ?? paged.info.count);
    return {
      sotuvda: Number(statusTotals?.available ?? paged.totals?.available_count ?? 0),
      sold: Number(statusTotals?.sold ?? paged.totals?.sold_count ?? 0),
      archived: Number(statusTotals?.archived ?? paged.totals?.archived_count ?? 0),
      all,
    };
  }, [statusTotals, paged.totals, paged.info.count]);
  // Status filtering is done by the API. Filtering the current page again on
  // the client would make server page totals and page numbers look wrong.
  const statusFiltered = items;
  const undistribCount = statusFiltered.filter(isUndistributed).length;
  // ⚠️ OXIRGI QO'SHILGAN BIRINCHI (chapdan). Server `?ordering=-created_at` ni qabul
  // qiladi, lekin bir XIL created_at da tartib BEQAROR — orqaga sanalgan kataloglar
  // hammasi 12:00 ga tushgani uchun har so'rovda joyini almashtirardi. Barqaror
  // taqqoslagich (vaqt ↓ → id ↓) buni tuzatadi.
  const shownItems = (undistribOnly ? statusFiltered.filter(isUndistributed) : statusFiltered)
    .slice()
    .sort(compareCatalogNewestFirst);

  // ?item=<id> — bildirishnomadan («Sizga yangi katalog ishi biriktirildi»)
  // to'g'ridan-to'g'ri katalog kartasini ochamiz (ro'yxatda bo'lmasa ham).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = Number(new URLSearchParams(window.location.search).get("item"));
    if (!id) return;
    api.catalogItem(id)
      .then((it) => { if (it && typeof it.id === "number") setViewItem(it); else showToast("Katalog yozuvi topilmadi"); })
      .catch(() => showToast("Katalog yozuvi topilmadi"));
  }, [showToast]);

  const patchItem = (upd: CatalogItem) => {
    setItems((xs) => xs.map((x) => (x.id === upd.id ? upd : x)));
    setViewItem((v) => (v?.id === upd.id ? upd : v));
  };

  // «Sotish» — modal orqali: soni + ixtiyoriy chegirma narxi va sababi
  const [sellItem, setSellItem] = useState<CatalogItem | null>(null);
  // §2 Bron bilan sotish — Bronlar sahifasidan «Katalogdan sotish» (?reservation=&item=) orqali
  const [presetResv, setPresetResv] = useState<Reservation | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const rid = Number(sp.get("reservation"));
    if (!rid) return;
    api.reservation(rid).then((r) => {
      setPresetResv(r);
      const iid = Number(sp.get("item")) || (typeof r.catalog_item === "number" ? r.catalog_item : 0);
      if (iid) api.catalogItem(iid).then(setSellItem).catch(() => {});
    }).catch(() => {});
    // URL'ni tozalaymiz — refresh qayta ochmasin
    const u = new URL(window.location.href);
    u.searchParams.delete("reservation"); u.searchParams.delete("item");
    window.history.replaceState(null, "", u);
  }, []);

  /** quantity bermasak backend sotilgan-u hali yechilmagan HAMMA sonni yechadi */
  const deduct = async (k: CatalogItem) => {
    setBusyId(k.id);
    try {
      patchItem(await api.deductCatalogStock(k.id));
      showToast(`✓ Sklad kamaytirildi: ${k.name_uz}`);
      notifyReportDataChanged(); // sklad kamaydi → hisobot raqamlari
      loadNotifs();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Kamaytirib bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  // katalog yozuvini butunlay o'chirish (DELETE /api/catalog/{id}/)
  const doDelete = async () => {
    if (!confirmDel) return;
    const victim = confirmDel;
    setDeleting(true);
    try {
      await api.deleteCatalogItem(victim.id);
      setItems((xs) => xs.filter((x) => x.id !== victim.id));
      setViewItem((v) => (v?.id === victim.id ? null : v));
      setEditItem((v) => (v?.id === victim.id ? null : v));
      setConfirmDel(null);
      showToast("✓ Katalog yozuvi o'chirildi");
      notifyReportDataChanged(); // katalog o'chdi (gullar floristga/skladga qaytdi) → hisobot
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  };

  if (!paged.ready && loading) return <FlowerLoader />;

  const tabBar = (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {([["katalog", "Katalog"], ["sotuvlar", "Sotuvlar"], ["restavratsiya", "Restavratsiya"]] as const).map(([k, lab]) => (
        <button key={k} type="button" aria-pressed={tab === k}
          onClick={() => {
            setTab(k);
            if (typeof window !== "undefined") {
              const u = new URL(window.location.href);
              if (k === "katalog") u.searchParams.delete("tab"); else u.searchParams.set("tab", k);
              // boshqa tabning filtrlari yangi tabda MA'NOSIZ — qoldirilsa jimgina qo'llanardi
              for (const x of ["florist", "ordering", "page"]) u.searchParams.delete(x);
              window.history.replaceState(null, "", u);
            }
          }}
          className={clsx("rounded-full border-[1.5px] px-5 py-2 text-[13px] font-bold", tab === k ? "text-white" : "bg-sfc")}
          style={tab === k ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}>
          {lab}
        </button>
      ))}
    </div>
  );

  const openItemById = (id: number) => {
    api.catalogItem(id).then((it) => { setTab("katalog"); setViewItem(it); }).catch(() => showToast("Katalog yozuvi topilmadi"));
  };

  if (tab === "sotuvlar") {
    return (
      <>
        {tabBar}
        <CatalogSalesTab branchUser={branchUser} onOpenItem={openItemById} />
      </>
    );
  }

  if (tab === "restavratsiya") {
    return (
      <>
        {tabBar}
        <RestavratsiyaTab onOpenItem={openItemById} />
        {reworkOpen && (
          <RestavratsiyaModal source={reworkOpen.source} onClose={() => setReworkOpen(null)}
            onSaved={() => { setReworkOpen(null); load(); notifyReportDataChanged(); }} />
        )}
      </>
    );
  }

  return (
    <>
      {tabBar}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* ⚠️ avtomatik yangilash o'chirilgan — eskirganini yashirmaslik uchun tugma + vaqt */}
          <RefreshButton onRefresh={refresh} loadedAt={loadedAt} busy={loading} />
          <SearchInput value={search} onChange={setSearch} ariaLabel="Katalog qidirish" placeholder="Nomi, mijoz ismi yoki telefoni…" />
          {/* HOLAT chiplari — Sotuvda (default) · Sotilgan · Arxiv · Barchasi, sonlar bilan. KLIENT filtri. */}
          <div className="flex items-center gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)" }}>
            {STATUS_VIEWS.map((sv) => (
              <button key={sv.value} type="button" onClick={() => changeStatusView(sv.value)} aria-pressed={statusView === sv.value}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors duration-150"
                style={statusView === sv.value ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>
                {sv.label} <span className="tabular-nums opacity-70">{statusCounts[sv.value]}</span>
              </button>
            ))}
          </div>
          <FilterSelect value={arrType} options={ARR_OPTS} onChange={setArrType} label="Turi" />
          <FilterSelect value={kindFilter} onChange={setKindFilter} label="Katalog turi" options={[{ value: "", label: "Barcha turlar" }, { value: "standard", label: "Standart" }, { value: "custom", label: "Maxsus" }]} />
          {florists.length > 0 && (
            <FilterSelect
              value={floristFilter}
              onChange={setFloristFilter}
              label="Florist"
              options={[{ value: "", label: "Barcha floristlar" }, ...florists.map((fp) => ({ value: String(fp.id), label: floristName(fp) }))]}
            />
          )}
          {florists.length > 0 && (
            <FilterSelect
              value={decorationFilter}
              onChange={setDecorationFilter}
              label="Oformleniya"
              options={[{ value: "", label: "Barcha bezovchilar" }, ...florists.map((fp) => ({ value: String(fp.id), label: floristName(fp) }))]}
            />
          )}
          {/* «Gul taqsimlanmagan» — chiqim yopilmagan florist kataloglari (tannarx/foyda haqiqiy emas) */}
          {undistribCount > 0 && (
            <button
              onClick={() => setUndistribOnly((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold transition-colors hover:bg-[var(--hover)]"
              style={{ borderColor: undistribOnly ? "var(--warning-ink, #8a6d1f)" : "var(--border)", color: undistribOnly ? "var(--warning-ink, #8a6d1f)" : "var(--text-2)" }}
              title="Gul hali taqsimlanmagan florist kataloglari"
            >
              <Info size={13} strokeWidth={2.2} /> Gul taqsimlanmagan ({undistribCount}){undistribOnly ? " ✕" : ""}
            </button>
          )}
        </div>
        {/* filialda katalog YARATIB BO'LMAYDI (backend 400) — tugmani ko'rsatmaymiz */}
        {mainUser && (
          <button onClick={() => setFormOpen(true)} className="btn-primary !flex-none px-4 py-2.5 text-[14px]">
            <Plus size={18} strokeWidth={1.75} /> Katalogga qo&apos;shish
          </button>
        )}
        {/* RESTAVRATSIYA — manbasiz (bo'sh forma). Ruxsat: `catalog` can_control. */}
        {control && (
          <button onClick={() => setReworkOpen({ source: null })} className="!flex-none rounded-[13px] border px-4 py-2.5 text-[14px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>
            <Recycle size={17} strokeWidth={1.75} className="mr-1.5 inline" /> Restavratsiya
          </button>
        )}
      </div>

      {/* ⚠️ BUKET HAJMI UMUMIYSI — serverning `totals.bouquet_volume_summary` idan.
          Filtrga ergashadi (status/qidiruv o'zgarsa sonlar ham o'zgaradi). */}
      <BouquetVolumeSummary rows={paged.totals?.bouquet_volume_summary as BouquetVolumeRow[] | undefined} />

      {customerFilter && (
        <div className="mb-3 flex items-center gap-2 rounded-[12px] border px-3.5 py-2 text-[13px]" style={{ borderColor: "var(--primary)", background: "var(--primary-soft)" }}>
          <User size={14} strokeWidth={2} style={{ color: "var(--primary)" }} />
          <span className="font-semibold">Mijoz bo&apos;yicha filtr:</span>
          <span className="truncate" style={{ color: "var(--text-2)" }}>{customerFilter.label}</span>
          <button type="button" onClick={() => setCustomerFilter(null)} className="ml-auto shrink-0 rounded-full p-1 hover:bg-[color:var(--hover)]" title="Filtrni olib tashlash"><X size={15} /></button>
        </div>
      )}

      <div className="mb-4 rounded-[18px] border px-4 py-2.5 shadow-[0_8px_30px_rgba(58,35,25,.04)]" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--surface-solid) 72%, transparent)" }}>
        <Pagination
          info={paged.info}
          onPage={paged.setPage}
          alwaysShow
          label="katalog"
          busy={paged.loading}
        />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(275px,1fr))" }}>
        {shownItems.map((k) => {
          // yangi kontrakt: soni bilan ishlash; eski yozuvlar uchun statusga tayanamiz
          const total = k.quantity_total ?? 1;
          // ⚠️ `pending` — `lib/catalogStock` dan. Ro'yxat javobida `quantity_stock_deducted`
          // va `stock_deducted_at` UMUMAN kelmaydi, shuning uchun bu yerda ularni to'g'ridan-
          // to'g'ri o'qish 261 ta yozuvda YOLG'ON «kamaytirilmagan» ogohlantirishi bergan edi.
          const ded = deductionState(k);
          const sold = ded.sold;
          const pending = ded.pending;
          // ⚠️ QOLDIQ — YAGONA manba: sotilgan + chiqit + RESTAVRATSIYA ayriladi.
          const left = catalogRemaining(k);
          const sellable = left > 0 && (k.status === "available" || k.status === "reserved" || k.status === "draft");
          /**
           * ⚠️ XIRALASHTIRISH — FAQAT SERVER holati bo'yicha.
           * Ilgari klient `isSold` qoidasi ishlatilardi (`quantity_sold >= quantity_total`),
           * va u `status: "available"` bo'lgan mahsulotni ham sotilgandek xiralashtirardi:
           * server «Sotuvda» guruhiga qo'ygan qator ekranda o'chgan holda ko'rinardi
           * (jonli: #443 1/1, #348 3/3, #257 4/4 — hammasi `available`).
           * Guruhlashni endi server hal qiladi (`?status_group=`), shu bois ko'rinish ham
           * uning holatiga ergashadi.
           */
          const dimmed = k.status === "sold" || k.status === "archived";
          return (
            <article key={k.id} className="glass card-hover group flex flex-col overflow-hidden !rounded-[20px]" style={dimmed ? { opacity: 0.6 } : undefined}>
              {/* ⚠️ RASM KO'RSATILMAYDI (so'rov: ro'yxat ixcham bo'lsin) — o'rniga bir qatorli
                  sarlavha chizig'i: holat + qoldiq nishoni chapda, amallar o'ngda.
                  Rasm bloki ilgari FAQAT surat emas, shu nishonlar va amallar uyi ham edi. */}
              <div
                className="flex items-center gap-2 border-b px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              >
                <span
                  className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
                  style={k.status === "available"
                    ? { borderColor: "var(--border-strong)", background: "var(--surface-solid)", color: "var(--text-2)" }
                    : { borderColor: "transparent", background: "var(--acc)", color: "#fff" }}
                >
                  {(CATALOG_STATUS_LABEL[k.status] ?? k.status).toUpperCase()}
                </span>
                {/* nechta gul qoldi — kartaning yuqorisida darhol ko'rinadi */}
                {k.quantity_total != null && left > 0 && (
                  <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={{ borderColor: "var(--border-strong)", background: "var(--surface-solid)", color: "var(--text-2)" }}>
                    {left} TA QOLDI
                  </span>
                )}
                {control && (
                  <span className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
                    {/* RESTAVRATSIYA — qoldig'i bor mahsulotni buzib yangisini yasash */}
                    {catalogRemaining(k) > 0 && (
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setReworkOpen({ source: k }); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setReworkOpen({ source: k }); } }} title="Restavratsiya — buzib yangi mahsulot yasash" aria-label={`${k.name_uz || k.name_ru} — restavratsiya`} className="icon-btn !h-7 !w-7">
                        <Recycle size={13} strokeWidth={1.9} />
                      </span>
                    )}
                    {/* Filialga yuborish — FAQAT asosiy filial admini, sotilmagan qismi bor bo'lsa */}
                    {mainUser && catalogRemaining(k) > 0 && (
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setTransferItem(k); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setTransferItem(k); } }} title="Filialga yuborish" aria-label={`${k.name_uz || k.name_ru} — filialga yuborish`} className="icon-btn !h-7 !w-7">
                        <Send size={13} strokeWidth={1.9} />
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setEditItem(k); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setEditItem(k); } }}
                      title="Tahrirlash"
                      aria-label={`${k.name_uz || k.name_ru} — tahrirlash`}
                      className="icon-btn !h-7 !w-7"
                    >
                      <Pencil size={13.5} strokeWidth={1.75} />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setConfirmDel(k); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setConfirmDel(k); } }}
                      title="O'chirish"
                      aria-label={`${k.name_uz || k.name_ru} — o'chirish`}
                      className="icon-btn icon-btn-danger !h-7 !w-7"
                    >
                      <Trash2 size={13.5} strokeWidth={1.75} />
                    </span>
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  {/* ⚠️ Rasm olib tashlangach «batafsil» ni SHU NOM ochadi (ilgari rasm bosilardi) */}
                  <h3
                    role="button"
                    tabIndex={0}
                    onClick={() => api.catalogItem(k.id).then(setViewItem).catch(() => showToast("Katalog tafsiloti topilmadi"))}
                    onKeyDown={(e) => e.key === "Enter" && api.catalogItem(k.id).then(setViewItem).catch(() => showToast("Katalog tafsiloti topilmadi"))}
                    title="Batafsil ko'rish"
                    className="cursor-pointer text-[16px] font-bold tracking-tight underline-offset-2 hover:underline"
                  >
                    {k.name_uz || k.name_ru}
                  </h3>
                  <span className="whitespace-nowrap text-[14px] font-bold" style={{ color: "var(--acc)" }}>{fmt(k.price)}</span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--mut)" }}>
                  {compositionText(k)}
                  {k.height_cm ? ` · bo'yi ${k.height_cm} sm` : ""} · {ARRANGEMENT_LABEL[k.arrangement_type] ?? k.arrangement_type}
                </p>
                {(k.description_uz || k.description_ru) && (
                  <p className="text-[13px] italic" style={{ color: "var(--mut)" }}>{k.description_uz || k.description_ru}</p>
                )}
                {/* florist chipi (kim tayyorladi) — ⚠️ FILIAL foydalanuvchisiga UMUMAN chizilmaydi
                    (florist kimligi asosiy filial ishi; catalogHasCostData bilan gate). */}
                {catalogHasCostData(k) && (k.florist_detail ? (
                  <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
                    <span className="avatar-lead flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold">{initials(floristName(k.florist_detail, k.florist_name))}</span>
                    <span className="truncate" title={floristName(k.florist_detail, k.florist_name)}>{floristName(k.florist_detail, k.florist_name)}</span>
                  </span>
                ) : (
                  <span className="text-[12px] italic" style={{ color: "var(--muted)" }}>Florist ko&apos;rsatilmagan</span>
                ))}
                {/* OFORMLENIYA floristi — ALOHIDA chip (accent + Sparkles), yasovchidan farqlansin */}
                {catalogHasCostData(k) && k.decoration_florist_detail && (
                  <span className="flex min-w-0 items-center gap-1 text-[11.5px] font-semibold" style={{ color: "var(--acc)" }} title={`Oformleniya: ${floristName(k.decoration_florist_detail, k.decoration_florist_name)}`}>
                    <Sparkles size={12} strokeWidth={2} className="shrink-0" />
                    <span className="truncate">{floristName(k.decoration_florist_detail, k.decoration_florist_name)}</span>
                  </span>
                )}
                {/* KUTAYAPTI: material+haq hisobda, faqat gul tannarxi yopilganda qo'shiladi → foyda hali to'liq emas */}
                {isUndistributed(k) && (
                  <span className="flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "color-mix(in srgb, #b3873a 16%, transparent)", color: "var(--warning-ink, #8a6d1f)" }} title="Material va florist haqi allaqachon tannarxda; faqat gul tannarxi chiqim yopilganda qo'shiladi — foyda shundan keyin to'liq bo'ladi">
                    <Info size={11} strokeWidth={2.4} /> Gul taqsimlanmagan
                  </span>
                )}
                {/* mijoz chipi (kim sotib oldi) — bosilsa shu mijoz bo'yicha filtr */}
                {k.customer_detail && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCustomerFilter({ id: k.customer_detail!.id, label: `${k.customer_detail!.name || "Mijoz"}${k.customer_detail!.masked_phone ? ` · ${k.customer_detail!.masked_phone}` : ""}` }); }}
                    className="flex min-w-0 items-center gap-1.5 self-start rounded-full border px-2 py-0.5 text-[11.5px] font-bold transition-colors hover:border-[color:var(--primary)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
                    title={`Mijoz: ${k.customer_detail.name}${k.customer_detail.masked_phone ? ` · ${k.customer_detail.masked_phone}` : ""} — bo'yicha filtrlash`}
                  >
                    <User size={11} strokeWidth={2.2} style={{ color: "var(--primary)" }} />
                    <span className="truncate">{k.customer_detail.name || "Mijoz"}</span>
                    {k.customer_detail.masked_phone && <span className="shrink-0 opacity-70">{k.customer_detail.masked_phone}</span>}
                  </button>
                )}
                {/* ichki izoh — bir qatorli preview, to'liq matn tooltip'da */}
                {k.note && (
                  <p className="truncate text-[12.5px] italic" style={{ color: "var(--mut)" }} title={k.note}>✎ {k.note}</p>
                )}
                {k.instagram_story_url && (
                  <a href={k.instagram_story_url.startsWith("http") ? k.instagram_story_url : `https://${k.instagram_story_url}`} target="_blank" className="text-[13px] font-semibold">
                    ↗ Instagram story ({fmtTime(k.created_at)})
                  </a>
                )}

                {/* soni: qoldiq / jami / sotildi (+ chiqim kutilmoqda) */}
                {k.quantity_total != null && (
                  <div className="flex flex-wrap gap-1.5 text-[11.5px] font-bold">
                    <span className="rounded-full bg-mint px-2.5 py-0.5 text-mintink">Qoldiq: {left}</span>
                    <span className="rounded-full bg-tint px-2.5 py-0.5">Jami: {total}</span>
                    <span className="rounded-full bg-tint px-2.5 py-0.5">Sotildi: {sold}</span>
                    {/* ⚠️ RESTAVRATSIYADA — buzilgan donalar sotuvda KO'RINMAYDI (spec kartochka qatori) */}
                    {(k.quantity_reworked ?? 0) > 0 && (
                      <span className="rounded-full px-2.5 py-0.5" style={{ background: "color-mix(in srgb, var(--acc) 15%, transparent)", color: "var(--acc)" }}
                        title="Restavratsiyada buzilgan — sotuvda ko'rinmaydi">Restavratsiyada: {k.quantity_reworked}</span>
                    )}
                    {(k.quantity_wasted ?? 0) > 0 && (
                      <span className="rounded-full px-2.5 py-0.5" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>Chiqit: {k.quantity_wasted}</span>
                    )}
                    {pending > 0 && <span className="rounded-full bg-peach px-2.5 py-0.5 text-peachink">Kutilmoqda: {pending}</span>}
                    {/* chegirmada sotilgan — ⚠️ FILIALGA yashiriladi (komponent narxidan hisoblanadi, tannarxni oshkor qiladi) */}
                    {catalogHasCostData(k) && +(k.discount_amount ?? 0) > 0 && (
                      <span
                        className="rounded-full px-2.5 py-0.5"
                        style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}
                        title={k.discount_reason || "Chegirma bilan sotilgan"}
                      >
                        Chegirma: {fmt(k.discount_amount)}
                      </span>
                    )}
                  </div>
                )}

                {pending > 0 && (
                  <div className="rounded-[13px] border-[1.5px] bg-tint p-3" style={{ borderColor: "var(--line)" }}>
                    <p className="mb-2 text-[13px] font-bold">⚠ {pending} ta sotuv skladdan hali kamaytirilmagan. Kamaytirilsinmi?</p>
                    <div className="flex gap-2">
                      <button onClick={() => deduct(k)} disabled={busyId === k.id} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold text-white disabled:opacity-60" style={{ background: "var(--side)" }}>
                        {busyId === k.id ? "…" : `Ha, kamaytirish (${pending} ta)`}
                      </button>
                    </div>
                  </div>
                )}

                {sold > 0 && pending === 0 && k.stock_deducted_at && (
                  <div className="rounded-[11px] bg-mint px-3 py-2 text-xs font-bold text-mintink">✓ Sklad kamaytirilgan · {fmtTime(k.stock_deducted_at)}</div>
                )}

                {/* «Sotish» — modal: soni, ixtiyoriy chegirma narxi va sababi */}
                {sellable && (
                  <button
                    onClick={() => setSellItem(k)}
                    className="mt-auto rounded-xl border-[1.5px] py-2 text-[13px] font-bold hover:bg-mint"
                    style={{ borderColor: "var(--line)" }}
                  >
                    Sotish
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {shownItems.length === 0 && <div className="col-span-full"><EmptyState title={floristFilter ? "Bu floristda katalog yo'q" : "Katalog hozircha bo'sh"} sub={floristFilter ? "Boshqa floristni tanlang." : "Birinchi tayyor guldastani qo'shing — story havolasi bilan."} /></div>}
      </div>

      {sellItem && (
        <KatalogSellModal
          item={sellItem}
          presetReservation={presetResv}
          onClose={() => setSellItem(null)}
          onSold={(upd) => { patchItem(upd); setSellItem(null); setPresetResv(null); notifyReportDataChanged(); loadNotifs(); load(); }}
        />
      )}

      {transferItem && (
        <CatalogTransferDrawer item={transferItem} onClose={() => setTransferItem(null)} onDone={() => { notifyReportDataChanged(); load(); }} />
      )}

      {formOpen && <KatalogModal onClose={() => setFormOpen(false)} onSaved={load} />}
      {editItem && (
        <KatalogModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); load(); }}
        />
      )}
      {viewItem && (
        <KatalogViewModal
          item={viewItem}
          onClose={() => setViewItem(null)}
          onEdit={control ? () => { setEditItem(viewItem); setViewItem(null); } : undefined}
          onDelete={control ? () => setConfirmDel(viewItem) : undefined}
          onTransfer={mainUser && control && catalogRemaining(viewItem) > 0 ? () => { setTransferItem(viewItem); setViewItem(null); } : undefined}
          onRestore={control ? () => { setRestoreItem(viewItem); setViewItem(null); } : undefined}
          onRework={control ? () => { setReworkOpen({ source: viewItem }); setViewItem(null); } : undefined}
        />
      )}

      {restoreItem && (
        <CatalogRestoreDrawer
          item={restoreItem}
          onClose={() => setRestoreItem(null)}
          onDone={async (upd) => {
            setRestoreItem(null);
            patchItem(upd);
            // tarkib/partiya/balans o'zgardi → to'liq itemni qayta o'qib ko'rsatamiz + hisobot keshini yangilaymiz
            try { const fresh = await api.catalogItem(upd.id); patchItem(fresh); setViewItem(fresh); } catch { setViewItem(upd); }
            notifyReportDataChanged(); loadNotifs(); load();
          }}
        />
      )}

      {reworkOpen && (
        <RestavratsiyaModal
          source={reworkOpen.source}
          onClose={() => setReworkOpen(null)}
          onSaved={() => { setReworkOpen(null); load(); notifyReportDataChanged(); }}
        />
      )}

      {/* o'chirish tasdig'i — body portali (drawer overlay'i ostida qolmasin) */}
      {confirmDel && createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-5" style={{ background: "rgba(24,17,12,.4)", backdropFilter: "blur(8px)" }} onClick={() => setConfirmDel(null)} role="dialog" aria-modal="true" data-lenis-prevent>
          <div className="glass-modal w-[min(400px,100%)] p-6 animate-[rowIn_0.22s_var(--ease)_both]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-bold">Katalogdan o&apos;chirish</h3>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              «{confirmDel.name_uz || confirmDel.name_ru}» butunlay o&apos;chirilsinmi? Bu amalni bekor qilib bo&apos;lmaydi.
            </p>
            {(confirmDel.quantity_sold ?? 0) > 0 && (
              <p className="mt-2 rounded-[11px] bg-peach px-3 py-2 text-[12.5px] font-semibold leading-snug text-peachink">
                ⚠ Bu yozuvdan {confirmDel.quantity_sold} ta sotilgan — sotuv tarixi ham yo&apos;qolishi mumkin.
              </p>
            )}
            {/* florist katalogi: chiqim YOPILGAN bo'lsa (soni bor) → florist qo'liga stem qaytadi;
                KUTAYAPTI bo'lsa (soni hali 0) → floristga HECH NARSA qaytmaydi (halol matn).
                ⚠️ kutayaptida ham composition bor (soni 0) — shuning uchun catalogWaiting bo'yicha ajratamiz. */}
            {confirmDel.florist ? (
              catalogWaiting(confirmDel) ? (
                <p className="mt-2 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold leading-snug" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                  Bu katalogda gul soni hali <b>yozilmagan</b> (chiqim yopilmagan) — floristga hech narsa qaytmaydi, faqat yozuv o&apos;chadi.
                </p>
              ) : (
                <p className="mt-2 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold leading-snug" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                  ↩ Gullar <b>skladga emas, {confirmDel.florist_detail ? floristName(confirmDel.florist_detail, confirmDel.florist_name) : "floristning"} qo&apos;liga</b> qaytadi.
                </p>
              )
            ) : null}
            <div className="mt-5 flex gap-2.5">
              <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1">Bekor qilish</button>
              <button onClick={doDelete} disabled={deleting} className={`btn-danger flex-1 ${deleting ? "btn-loading" : ""}`}>O&apos;chirish</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
