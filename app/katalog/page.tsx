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
import CatalogGroupCard from "@/components/CatalogGroupCard";
import CatalogItemCard from "@/components/CatalogItemCard";
import { splitCatalogView } from "@/lib/catalogGroups";
import { usePagedList } from "@/lib/usePagedList";
import type { CatalogItem, FloristProfile, Reservation } from "@/lib/types";
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
/** ⚠️ «custom» — HOLAT emas, KATALOG TURI: maxsus (mijoz uchun bir marta yasalgan)
    yozuvlarni holatidan qat'i nazar ko'rsatadi. Chip qatorida turishi ataylab:
    operator uchun bu ham xuddi «Sotuvda / Arxiv» kabi bitta ko'rinish. */
type StatusView = "sotuvda" | "sold" | "archived" | "all" | "custom";
const STATUS_VIEWS: { value: StatusView; label: string }[] = [
  { value: "sotuvda", label: "Sotuvda" },
  { value: "sold", label: "Sotilgan" },
  { value: "archived", label: "Arxiv" },
  { value: "all", label: "Barchasi" },
  { value: "custom", label: "Maxsus katalog" },
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
  const [customCount, setCustomCount] = useState(0);
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
    // ⚠️ «Maxsus katalog» ko'rinishi: holat bo'yicha CHEKLAMAYMIZ (sotilgani ham ko'rinsin),
    //    faqat catalog_kind=custom qo'llanadi.
    status_group: statusView === "custom" ? "all" : statusView === "sotuvda" ? "available" : statusView,
    search: q || undefined,
    arrangement_type: arrType || undefined,
    florist: floristFilter || undefined,
    decoration_florist: decorationFilter || undefined,
    catalog_kind: statusView === "custom" ? "custom" : kindFilter || undefined,
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

  // ⚠️ «Maxsus katalog» chipidagi son — bitta kichik so'rov (page_size=1), holatlardan qat'i nazar.
  //    Ro'yxat yangilanganda (yangi maxsus katalog qo'shilishi mumkin) qayta so'raladi.
  useEffect(() => {
    api.catalogPage({ catalog_kind: "custom", status_group: "all", page_size: 1 })
      .then((r) => setCustomCount(Number(r.count ?? 0)))
      .catch(() => setCustomCount(0));
  }, [loadedAt]);

  // URL ?status= o'qish (ulashilgan link / refresh o'sha ko'rinishga tushadi) — mount'da bir marta
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = new URLSearchParams(window.location.search).get("status");
    if (s === "sold" || s === "archived" || s === "all" || s === "sotuvda" || s === "custom") setStatusView(s);
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
      // ⚠️ `by_kind` FAQAT joriy filtr ichini sanaydi (sotuvdagi 21 yozuvda custom yo'q ≠ umuman yo'q),
      //    shuning uchun maxsus yozuvlar soni ALOHIDA, holatlardan qat'i nazar so'raladi.
      custom: customCount,
    };
  }, [statusTotals, paged.totals, paged.info.count, customCount]);
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
  // ⚠️ HAJM GURUHLARI — ko'rinib turgan yozuvlardan (filtr + sahifa) yig'iladi.
  // ⚠️ BUKETLAR — hajm bo'yicha 3 ta guruh kartasi; SAVAT/QUTI — alohida rasmli kartalar.
  const { groups, singles, customs } = useMemo(() => splitCatalogView(shownItems), [shownItems]);
  // ⚠️ Bir vaqtda BITTA guruh ochiladi va u butun qatorni egallaydi (akkordeon).
  const [openGroup, setOpenGroup] = useState<string | null>(null);

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

      {/* ⚠️ KATALOG «UMUMIY» KO'RINISHDA — bitta karta = bitta HAJM (Kichik/O'rta/Katta).
          Do'konda bir xil tovar bir necha marta kiritilgan («kotta», «KOTTA 100 TALI ATIR» —
          hammasi 800 000 so'm), operator uchun esa bu bitta tovar: «katta 15 ta bor».
          Pozitsiyalar YO'QOLMAYDI — karta ochilib, har biri o'z amallari bilan chiqadi.
          Guruh FAQAT hozir ko'rinib turgan (filtr + sahifa) yozuvlardan yig'iladi. */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
        {groups.map((g) => (
          <div key={g.key} style={openGroup === g.key ? { gridColumn: "1 / -1" } : undefined}>
          <CatalogGroupCard
            group={g}
            open={openGroup === (g.volume || "none")}
            onToggle={(v) => setOpenGroup(v ? g.volume || "none" : null)}
            actions={{
              onSell: setSellItem,
              onView: (k) => api.catalogItem(k.id).then(setViewItem).catch(() => showToast("Katalog tafsiloti topilmadi")),
              onEdit: setEditItem,
              onDelete: setConfirmDel,
              onRework: (k) => setReworkOpen({ source: k }),
              onTransfer: setTransferItem,
              onDeduct: deduct,
              onCustomer: (id, label) => setCustomerFilter({ id, label }),
              busyId,
              control,
              mainUser,
              costVisible: catalogHasCostData,
              undistributed: isUndistributed,
              composition: compositionText,
            }}
          />
          </div>
        ))}
        {shownItems.length === 0 && <div className="col-span-full"><EmptyState title={floristFilter ? "Bu floristda katalog yo'q" : "Katalog hozircha bo'sh"} sub={floristFilter ? "Boshqa floristni tanlang." : "Birinchi tayyor guldastani qo'shing — story havolasi bilan."} /></div>}
      </div>

      {/* ⚠️ SAVAT / QUTI — guruhlanmaydi: har biri alohida tovar, RASMI bilan chiziladi.
          Buket guruhlaridan KEYIN turadi. */}
      {singles.length > 0 && (
        <>
          <div className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[1.5px]" style={{ color: "var(--muted)" }}>
            Savatlar va qutilar <span className="font-semibold normal-case tracking-normal opacity-80">· har biri alohida</span>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(275px,1fr))" }}>
            {singles.map((k) => (
              <CatalogItemCard
                key={k.id}
                k={k}
                actions={{
                  onSell: setSellItem,
                  onView: (x) => api.catalogItem(x.id).then(setViewItem).catch(() => showToast("Katalog tafsiloti topilmadi")),
                  onEdit: setEditItem,
                  onDelete: setConfirmDel,
                  onRework: (x) => setReworkOpen({ source: x }),
                  onTransfer: setTransferItem,
                  onDeduct: deduct,
                  onCustomer: (id, label) => setCustomerFilter({ id, label }),
                  busyId,
                  control,
                  mainUser,
                  costVisible: catalogHasCostData,
                  undistributed: isUndistributed,
                  composition: compositionText,
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* ⚠️ MAXSUS KATALOG — mijoz uchun bir marta yasalgan buyumlar. Guruhga QO'SHILMAYDI
          (savat kabi har biri alohida karta) va o'z chipida holatidan qat'i nazar ko'rinadi. */}
      {customs.length > 0 && (
        <>
          <div className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[1.5px]" style={{ color: "var(--muted)" }}>
            Maxsus katalog <span className="font-semibold normal-case tracking-normal opacity-80">· mijoz uchun yasalgan, har biri alohida</span>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(275px,1fr))" }}>
            {customs.map((k) => (
              <CatalogItemCard
                key={k.id}
                k={k}
                actions={{
                  onSell: setSellItem,
                  onView: (x) => api.catalogItem(x.id).then(setViewItem).catch(() => showToast("Katalog tafsiloti topilmadi")),
                  onEdit: setEditItem,
                  onDelete: setConfirmDel,
                  onRework: (x) => setReworkOpen({ source: x }),
                  onTransfer: setTransferItem,
                  onDeduct: deduct,
                  onCustomer: (id, label) => setCustomerFilter({ id, label }),
                  busyId,
                  control,
                  mainUser,
                  costVisible: catalogHasCostData,
                  undistributed: isUndistributed,
                  composition: compositionText,
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* ⚠️ «Maxsus katalog» chipida yozuv bo'lmasa — bo'sh ekran emas, sabab aytiladi. */}
      {statusView === "custom" && customs.length === 0 && !loading && (
        <EmptyState title="Maxsus katalog yo'q" sub="Mijoz uchun alohida yasalgan buyum qo'shilsa shu yerda ko'rinadi." />
      )}

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
