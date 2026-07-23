"use client";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import SearchInput from "@/components/SearchInput";
import ClearFilters from "@/components/ClearFilters";
import FilterSelect from "@/components/FilterSelect";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGroup, motion } from "framer-motion";
import clsx from "clsx";
import { api } from "@/lib/api";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { usePerm, useStore } from "@/lib/store";
import { dateAfterParam, fmt, fmtTime, rangeParams } from "@/lib/format";
import DateChips from "@/components/DateChips";
import { statusBadgeProps, statusName, SOURCE_BADGE } from "@/components/badges";
import LeadModal from "@/components/LeadModal";
import NewLeadModal from "@/components/NewLeadModal";
import EditLeadModal from "@/components/EditLeadModal";
import LeadStatusManager from "@/components/LeadStatusManager";
import { Clock, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import type { Customer, Lead, LeadStatus, LeadStatusDef } from "@/lib/types";

/** Buyurtmalar — alohida sahifa (ilgari CRM ichida "Leadlar" edi).
    Kanban ustunlari ENDI BACKENDDAN keladi (/api/lead-statuses/) — nomi,
    rangi va tartibi dinamik; «Statuslar» tugmasi orqali boshqariladi. */

/** API ishlamay qolsa ham kanban chizilaverishi uchun zaxira to'plam */
const FALLBACK_STATUSES: LeadStatusDef[] = [
  { id: -1, key: "new", name_uz: "Yangi", name_ru: "Новый", color: "#c2703f", order: 10, is_active: true },
  { id: -3, key: "contacted", name_uz: "Aloqada", name_ru: "На связи", color: "#b3873a", order: 30, is_active: true },
  { id: -4, key: "won", name_uz: "Sotildi", name_ru: "Продан", color: "#3d8a5f", order: 40, is_active: true },
  { id: -5, key: "lost", name_uz: "Bekor", name_ru: "Отменён", color: "#a04a4a", order: 50, is_active: true },
];

/** Karta preview: mini-app eslatmalarida URL qatori tashlanadi, emoji
    prefikslar tozalanadi — 3 qatorli qisqartma toza matndan boshlanadi. */
const notePreview = (t: string): string => {
  if (!t.includes("\n")) return t;
  return t
    .split("\n")
    .filter((l) => !/https?:\/\//.test(l))
    .map((l) => l.replace(/^[\uD800-\uDFFF\uFE0F\s]+/, "").trim())
    .filter(Boolean)
    .join(" · ");
};

/** Karta ichki mazmuni — ro'yxatdagi karta va sudralayotgan jonli nusxa
    (drag ghost) AYNAN bir xil ko'rinishi uchun bitta joyda. */
function CardBody({ l, onEdit, onDelete }: { l: Lead; onEdit?: () => void; onDelete?: () => void }) {
  const name = l.customer_detail?.name || `@${l.customer_detail?.instagram_username ?? "—"}`;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[14px] font-bold" title={name}>{name}</span>
        <span className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              draggable={false}
              onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
              title="Tahrirlash"
              aria-label="Buyurtmani tahrirlash"
              className="icon-btn !h-7 !w-7 opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
            >
              <Pencil size={13.5} strokeWidth={1.75} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              draggable={false}
              onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
              title="O'chirish"
              aria-label="Buyurtmani o'chirish"
              className="icon-btn icon-btn-danger !h-7 !w-7 opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
            >
              <Trash2 size={13.5} strokeWidth={1.75} />
            </button>
          )}
          <span className={clsx(SOURCE_BADGE(l.source), "shrink-0")}>{l.source || "—"}</span>
        </span>
      </div>
      <p className="clamp-3 mt-1 text-[13px] leading-snug" style={{ color: "var(--mut)" }}>{notePreview(l.request_uz || l.request_ru || "")}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="min-w-0 truncate text-[14px] font-bold" style={{ color: "var(--acc)" }}>{fmt(l.estimated_price)}</span>
        <span className="shrink-0 text-[11px]" style={{ color: "var(--mut)" }}>{fmtTime(l.created_at)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs" style={{ color: "var(--mut)" }}>{l.customer_detail?.phone || l.customer_detail?.masked_phone || "tel yo'q"}</span>
        {l.delivery_at && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--primary)" }} title="Yetkazish vaqti">
            <Clock size={11} strokeWidth={2} /> {fmtTime(l.delivery_at)}
          </span>
        )}
      </div>
    </>
  );
}

function LeadCard({ l, accent, dragging, onOpen, onEdit, onDelete, onDrag, onDragEnd, onDragOverCard }: { l: Lead; accent?: string; dragging: boolean; onOpen: () => void; onEdit?: () => void; onDelete?: () => void; onDrag: (e: React.DragEvent) => void; onDragEnd: () => void; onDragOverCard?: (e: React.DragEvent) => void }) {
  // status rangi kartada chap chiziqcha bo'lib ko'rinadi (kontrakt: status_detail.color)
  const stripe = l.status_detail?.color ?? accent;
  return (
    <div
      draggable
      onClick={onOpen}
      onDragStart={onDrag}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverCard}
      className="glass group shrink-0 cursor-grab !rounded-[15px] p-3.5 transition-[opacity] duration-150 animate-[rowIn_0.18s_var(--ease)] hover:!border-[var(--acc)]"
      // sudralayotgan kartaning ASL o'RNI — 15% sharpa + shtrixli chegara:
      // karta ikki nusxada ko'rinmaydi, ustun balandligi saqlanadi
      style={
        dragging
          ? { opacity: 0.15, borderStyle: "dashed", borderColor: "var(--primary)" }
          : stripe
            ? { boxShadow: `inset 3px 0 0 0 ${stripe}` }
            : undefined
      }
    >
      <CardBody l={l} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

const ARR_OPTS = [
  { value: "", label: "Barcha turlar" },
  { value: "bouquet", label: "Buket" },
  { value: "basket", label: "Savat" },
  { value: "stems", label: "Donalab" },
  { value: "catalog", label: "Katalog" },
];

export default function BuyurtmalarPage() {
  const { user, showToast, dateFilter, dateRange, setDateFilter } = useStore();
  const { canControl } = usePerm();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusDef[]>(FALLBACK_STATUSES);
  const [statusMgr, setStatusMgr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [selLead, setSelLead] = useState<Lead | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  // o'chirish: tasdiq oynasi + jarayon flagi
  const [confirmDelLead, setConfirmDelLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);
  // ustun ichida QAYERGA tashlanishi (0..n) — pozitsion ko'rsatkich
  const [overIdx, setOverIdx] = useState<number | null>(null);
  // JONLI drag ghost: brauzerning xira/sifatsiz snapshot'i o'rniga kartaning
  // haqiqiy DOM nusxasi kursorga ergashadi — to'liq tiniq va aniq ko'rinadi
  const [ghost, setGhost] = useState<{ l: Lead; w: number } | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const grabRef = useRef({ dx: 0, dy: 0, x: 0, y: 0 });
  const emptyImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // 1×1 shaffof rasm — natif drag snapshot butunlay yashiriladi
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    emptyImgRef.current = img;
  }, []);

  useEffect(() => {
    if (!ghost) return;
    // pozitsiya to'g'ridan-to'g'ri DOM'ga yoziladi — har px'da re-render bo'lmaydi
    const move = (e: DragEvent) => {
      const g = ghostRef.current;
      if (!g || (e.clientX === 0 && e.clientY === 0)) return;
      g.style.transform = `translate(${e.clientX - grabRef.current.dx}px, ${e.clientY - grabRef.current.dy}px)`;
    };
    document.addEventListener("dragover", move);
    return () => document.removeEventListener("dragover", move);
  }, [ghost]);
  const [newLead, setNewLead] = useState(false);
  const kanbanRef = useRef<HTMLDivElement>(null);
  const [kanbanH, setKanbanH] = useState<number | null>(null);
  // server tomonda ishlaydigan filtrlar
  const [search, setSearch] = useState("");
  const [q, setQ] = useState(""); // debounce qilingan qiymat
  const [arrType, setArrType] = useState("");
  // status (kanban ustuni) filtri — FAQAT jadval ko'rinishida ko'rsatiladi
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // kanban pastki chegarasi ham sidebar bilan bir chiziqda (chat kabi):
  // viewport − ustki joylashuv − 14px (Shell tashqi paddingi)
  useEffect(() => {
    const measure = () => {
      const top = kanbanRef.current?.getBoundingClientRect().top ?? 0;
      setKanbanH(Math.max(window.innerHeight - top - 14, 420));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [loading, view]);

  // POYGA HIMOYASI: PATCH'dan OLDIN boshlangan GET keyin kelib, yangi statusni
  // eski ro'yxat bilan bosib qo'ymasin — har mutatsiya seq'ni oshiradi,
  // eskirgan yuklash javobi esa e'tiborsiz qoldiriladi
  const loadSeq = useRef(0);

  // CHEKSIZ SKROLL: sahifalab yuklash (kontrakt: page/page_size, max 100)
  const PAGE_SIZE = 50;
  const pagesRef = useRef(1); // hozircha yuklangan sahifalar soni
  const loadingMoreRef = useRef(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  const baseParams = useCallback(
    () => ({
      // ustun ichidagi qo'lda tartib saqlanadi (reorder-column kontrakti)
      ordering: "sort_order",
      ...(dateRange ? rangeParams(dateRange) : { created_at_after: dateAfterParam(dateFilter) }),
      search: q || undefined,
      arrangement_type: arrType || undefined,
      // status filtri faqat jadvalda amal qiladi — kanban hamma ustunni ko'rsatadi
      status: view === "table" && statusFilter ? statusFilter : undefined,
    }),
    [dateRange, dateFilter, q, arrType, view, statusFilter]
  );

  // filtr o'zgarsa — sahifalash boshidan
  useEffect(() => { pagesRef.current = 1; }, [dateRange, dateFilter, q, arrType, statusFilter, view]);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [pageData, cs, sts] = await Promise.all([
        // yuklangan sahifalar qayta o'qiladi (auto-refresh skrollangan joyni yo'qotmasin)
        (async () => {
          const acc: Lead[] = [];
          let count = 0;
          let more = false;
          for (let pg = 1; pg <= pagesRef.current; pg++) {
            const res = await api.leadsPage({ ...baseParams(), page: pg, page_size: PAGE_SIZE });
            acc.push(...res.results);
            count = res.count;
            more = !!res.next;
            if (!res.next) break;
          }
          return { acc, count, more };
        })(),
        // yangi buyurtma formasi uchun mavjud mijozlar ro'yxati
        api.customers({ ordering: "-created_at" }),
        // kanban ustunlari — backenddan; xato bo'lsa zaxira to'plam qoladi
        api.leadStatuses().catch(() => null),
      ]);
      if (seq !== loadSeq.current) return; // eskirgan javob — undan keyin mutatsiya bo'lgan
      setLeads(pageData.acc);
      setTotal(pageData.count);
      setHasMore(pageData.more);
      setCustomers(cs);
      if (sts && sts.length) setStatuses(sts);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [showToast, baseParams]);

  /** Skroll yarmidan oshganda keyingi sahifa qo'shiladi. */
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const seq = loadSeq.current; // bu orada mutatsiya bo'lsa — javob tashlanadi
    try {
      const page = pagesRef.current + 1;
      const res = await api.leadsPage({ ...baseParams(), page, page_size: PAGE_SIZE });
      if (seq !== loadSeq.current) return;
      pagesRef.current = page;
      setHasMore(!!res.next);
      setTotal(res.count);
      setLeads((ls) => {
        const seen = new Set(ls.map((l) => l.id));
        return [...ls, ...res.results.filter((r) => !seen.has(r.id))];
      });
    } catch {
      /* keyingi skrollda qayta uriniladi */
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, baseParams]);

  /** Skroll pozitsiyasi yarmidan oshdimi? (faqat haqiqatan skrollansa) */
  const halfReached = (el: { scrollTop: number; scrollHeight: number; clientHeight: number }) => {
    const track = el.scrollHeight - el.clientHeight;
    return track > 40 && el.scrollTop >= track / 2;
  };

  // jadval ko'rinishida kontent Shell ichidagi scroll-konteynerda aylanadi
  // (window emas!) — shuning uchun capture-rejimda istalgan skrollni tinglaymiz
  useEffect(() => {
    if (view !== "table") return;
    const onScroll = (e: Event) => {
      const el = e.target instanceof HTMLElement ? e.target : document.documentElement;
      if (halfReached(el)) loadMore();
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
  }, [view, loadMore]);

  /** Lokal mutatsiya — davom etayotgan har qanday yuklashni bekor qiladi. */
  const mutateLeads = useCallback((fn: (ls: Lead[]) => Lead[]) => {
    loadSeq.current++;
    setLeads(fn);
  }, []);

  useEffect(() => { load(); }, [load]);
  // boshqa joyda ma'lumot o'zgarsa ham ko'rinib turishi uchun jimgina yangilash
  useAutoRefresh(load);

  // chuqur havola: /buyurtmalar?order=ID (eski ?lead=ID ham) — dashboard,
  // sklad jurnali va mijoz tarixidan kelganda o'sha kanban kartasi ochiladi
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = Number(p.get("order") ?? p.get("lead"));
    if (!id) return;
    window.history.replaceState(null, "", "/buyurtmalar");
    api.lead(id)
      .then(setSelLead)
      .catch(() => showToast("Buyurtma topilmadi yoki o'chirilgan"));
  }, [showToast]);

  const fLeads = leads;
  // faol ustunlar (tartib bo'yicha); «Malakali» ustuni ko'rsatilmaydi —
  // qualified buyurtmalar «Yangi»da turadi (foydalanuvchi talabi)
  const cols = statuses.filter((s) => s.is_active && s.key !== "qualified").sort((a, b) => a.order - b.order);
  const statusOf = (key: LeadStatus) => statuses.find((s) => s.key === key);

  /** Statusni backendga yozamiz. «Sotildi»da sklad kamaytirishni BACKEND o'zi
      bajaradi (lead.stock_usage/packaging_usage bo'yicha); qoldiq yetmasa 400
      qaytadi va status o'zgarishi bekor bo'ladi — biz optimistik holatni qaytaramiz. */
  const setLeadStatus = async (id: number, st: LeadStatus) => {
    const prev = leads;
    // await'dan OLDIN o'qiladi — javob kelgach solishtirish uchun
    const wasDeducted = !!leads.find((l) => l.id === id)?.stock_deducted_at;
    mutateLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: st } : l)));
    try {
      const upd = await api.updateLead(id, { status: st });
      mutateLeads((ls) => ls.map((l) => (l.id === id ? upd : l)));
      setSelLead((s) => (s?.id === id ? upd : s));
      if (st === "won" && upd.stock_deducted_at && !wasDeducted) {
        showToast("✓ Sotildi — sklad qoldig'i avtomatik kamaytirildi");
      } else if (st === "won" && !upd.stock_deducted_at && !(upd.stock_usage?.length || upd.packaging_usage?.length)) {
        showToast("Sotildi. Diqqat: sarf kiritilmagani uchun sklad kamaymadi");
      } else if (wasDeducted && st !== "won") {
        showToast("↩ Sotuvdan qaytarildi — sklad qoldig'i avtomatik tiklandi");
      } else {
        showToast(`Buyurtma «${statusName(st, statusOf(st))}» ustuniga ko'chirildi`);
      }
    } catch (e) {
      mutateLeads(() => prev);
      setSelLead((s) => (s?.id === id ? (prev.find((l) => l.id === id) ?? s) : s));
      showToast(e instanceof Error ? e.message : "Statusni saqlab bo'lmadi");
    }
  };

  /** Ustun elementlari — ekranda ko'rinadigan tartibda ("new" qualified'ni ham o'z ichiga oladi). */
  const colItems = useCallback(
    (ls: Lead[], key: string) => ls.filter((l) => (key === "new" ? l.status === "new" || l.status === "qualified" : l.status === key)),
    []
  );

  /** Drag tugadi: kartani target ustunning TANLANGAN POZITSIYASIGA qo'yamiz va
      butun ustun tartibini bitta so'rovda saqlaymiz (POST /leads/reorder-column/).
      Status o'zgarishi ham shu endpointda: won'ga o'tsa sklad kamayadi,
      won'dan chiqsa avtomatik qaytadi (backend). */
  const reorderTo = async (targetKey: LeadStatus) => {
    const id = dragId;
    if (id == null) return;
    const moved = leads.find((l) => l.id === id);
    if (!moved) return;
    const prev = leads;
    const prevStatus = moved.status;
    const wasDeducted = !!moved.stock_deducted_at;

    // ko'rsatilgan joy: slot indeksi ekrandagi ro'yxatga nisbatan (sudralayotgan karta bilan)
    const displayed = colItems(leads, targetKey);
    let idx = overIdx ?? displayed.length;
    const srcPos = displayed.findIndex((l) => l.id === id);
    if (srcPos >= 0 && srcPos < idx) idx--; // o'z o'rni olib tashlangach siljish

    // optimistik: global massivda kartani target ustunning idx-o'rniga ko'chiramiz
    const movedUpd: Lead = { ...moved, status: targetKey, status_detail: statusOf(targetKey) ?? moved.status_detail };
    mutateLeads((ls) => {
      const without = ls.filter((l) => l.id !== id);
      const items = colItems(without, targetKey);
      const anchor = items[idx];
      if (anchor) {
        const gi = without.indexOf(anchor);
        return [...without.slice(0, gi), movedUpd, ...without.slice(gi)];
      }
      const last = items[items.length - 1];
      if (last) {
        const gi = without.indexOf(last);
        return [...without.slice(0, gi + 1), movedUpd, ...without.slice(gi + 1)];
      }
      return [...without, movedUpd];
    });

    // payload: target ustun (AYNAN shu status) idlari yangi tartibda —
    // "new"dagi qualified kartalarni yubormaymiz
    const nextState = (() => {
      const without = prev.filter((l) => l.id !== id);
      const items = colItems(without, targetKey);
      const anchor = items[idx];
      const arr = [...without];
      if (anchor) arr.splice(arr.indexOf(anchor), 0, movedUpd);
      else if (items.length) arr.splice(arr.indexOf(items[items.length - 1]) + 1, 0, movedUpd);
      else arr.push(movedUpd);
      return arr;
    })();
    const leadIds = nextState
      .filter((l) => l.status === targetKey)
      .map((l) => l.id);

    try {
      await api.reorderColumn({ status: targetKey, lead_ids: leadIds });
      if (targetKey === "won" && prevStatus !== "won") {
        // yechim natijasini bilish uchun leadni yangilaymiz
        const fresh = await api.lead(id).catch(() => null);
        if (fresh) {
          mutateLeads((ls) => ls.map((l) => (l.id === id ? fresh : l)));
          setSelLead((s) => (s?.id === id ? fresh : s));
        }
        if (fresh?.stock_deducted_at && !wasDeducted) showToast("✓ Sotildi — sklad qoldig'i avtomatik kamaytirildi");
        else if (fresh && !fresh.stock_deducted_at && !(fresh.stock_usage?.length || fresh.packaging_usage?.length))
          showToast("Sotildi. Diqqat: sarf kiritilmagani uchun sklad kamaymadi");
        else showToast(`Buyurtma «${statusName(targetKey, statusOf(targetKey))}» ustuniga ko'chirildi`);
      } else if (prevStatus === "won" && targetKey !== "won") {
        const fresh = await api.lead(id).catch(() => null);
        if (fresh) mutateLeads((ls) => ls.map((l) => (l.id === id ? fresh : l)));
        showToast("↩ Sotuvdan qaytarildi — sklad qoldig'i avtomatik tiklandi");
      } else if (prevStatus !== targetKey) {
        showToast(`Buyurtma «${statusName(targetKey, statusOf(targetKey))}» ustuniga ko'chirildi`);
      }
      // bir xil ustun ichidagi tartib — jim saqlanadi
    } catch (e) {
      mutateLeads(() => prev);
      showToast(e instanceof Error ? e.message : "Tartibni saqlab bo'lmadi");
    }
  };

  const drop = (st: LeadStatus) => {
    if (dragId != null) reorderTo(st);
    setDragId(null); setOverCol(null); setOverIdx(null); setGhost(null);
  };

  // buyurtmani butunlay o'chirish — tasdiqdan keyin (DELETE /api/leads/{id}/)
  const doDeleteLead = async () => {
    if (!confirmDelLead) return;
    const victim = confirmDelLead;
    setDeletingLead(true);
    try {
      await api.deleteLead(victim.id);
      mutateLeads((ls) => ls.filter((l) => l.id !== victim.id));
      setTotal((t) => (t != null && t > 0 ? t - 1 : t));
      setSelLead((s) => (s?.id === victim.id ? null : s));
      setEditLead((s) => (s?.id === victim.id ? null : s));
      setConfirmDelLead(null);
      showToast("✓ Buyurtma o'chirildi");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "O'chirib bo'lmadi");
    } finally {
      setDeletingLead(false);
    }
  };

  if (loading) return <FlowerLoader />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Buyurtmalar ({total != null && total > fLeads.length ? `${fLeads.length} / ${total}` : fLeads.length}) — sudrab statusni o&apos;zgartiring
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Buyurtma qidirish" />
          <FilterSelect value={arrType} options={ARR_OPTS} onChange={setArrType} label="Turi" />
          {view === "table" && (
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              label="Status"
              options={[
                { value: "", label: "Barcha statuslar" },
                ...cols.map((s) => ({ value: s.key, label: statusName(s.key, s) })),
              ]}
            />
          )}
          <DateChips />
          <ClearFilters
            show={!!(search || arrType || (view === "table" && statusFilter) || dateRange || dateFilter !== "oy")}
            onClear={() => { setSearch(""); setArrType(""); setStatusFilter(""); setDateFilter("oy"); }}
          />
          {canControl("crm") && (
            <button onClick={() => setNewLead(true)} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[13.5px]">
              <Plus size={17} strokeWidth={1.75} /> Buyurtma
            </button>
          )}
          {canControl("crm") && ["admin", "operator", "developer"].includes(user?.profile.role ?? "") && (
            <button
              onClick={() => setStatusMgr(true)}
              className="icon-btn border !flex-none"
              style={{ borderColor: "var(--border)" }}
              title="Kanban statuslarini boshqarish"
              aria-label="Statuslarni boshqarish"
            >
              <SlidersHorizontal size={16} strokeWidth={1.75} />
            </button>
          )}
          <div className="glass flex gap-1 !rounded-xl p-1">
            {(["kanban", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={clsx("rounded-[9px] px-4 py-1.5 text-xs font-bold", view === v ? "text-white" : "")} style={view === v ? { background: "var(--acc)" } : { color: "var(--mut)" }}>
                {v === "kanban" ? "Kanban" : "Jadval"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "kanban" && (
        <div
          ref={kanbanRef}
          // HAR DOIM flex + gorizontal skroll: status ko'p bo'lsa ustunlar
          // yo'qolib qolmaydi (grid'da ikkinchi qatorga o'ralib ketardi)
          className="mb-[-40px] flex gap-3.5 overflow-x-auto overscroll-x-contain max-lg:snap-x max-lg:snap-mandatory"
          style={{ height: kanbanH ?? "calc(100dvh - 220px)" }}
        >
          <LayoutGroup>
          {cols.map((sdef) => {
            const st = sdef.key;
            const items = fLeads.filter((l) => (st === "new" ? l.status === "new" || l.status === "qualified" : l.status === st));
            const isOver = overCol === st && dragId != null;
            return (
              <div
                key={sdef.id}
                onDragOver={(e) => { e.preventDefault(); setOverCol(st); setOverIdx((v) => (overCol === st && v != null ? v : items.length)); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setOverCol(null); setOverIdx(null); } }}
                onDrop={(e) => { e.preventDefault(); drop(st); }}
                className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border-[1.5px] p-3 max-lg:w-[85vw] max-lg:min-w-[85vw] max-lg:max-w-[420px] max-lg:shrink-0 max-lg:snap-center lg:min-w-[235px] lg:flex-1"
                // ustun foni — backend statusning rangidan yumshoq ohang
                style={{ background: `color-mix(in srgb, ${sdef.color} 9%, var(--bg2))`, borderColor: `color-mix(in srgb, ${sdef.color} 22%, var(--line))` }}
              >
                <div className="kanban-head flex shrink-0 items-center justify-between px-1.5 pb-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold tracking-wide">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sdef.color }} aria-hidden />
                    <span className="truncate">{statusName(st, sdef).toUpperCase()}</span>
                  </span>
                  <span
                    className="rounded-full px-2.5 text-[12px] font-bold text-white"
                    style={{ background: "var(--side)" }}
                    title={`Bu ustunda ${items.length} ta buyurtma`}
                    aria-label={`${items.length} ta buyurtma`}
                  >
                    {items.length}
                  </span>
                </div>
                {/* har ustun o'z ichida skrollanadi; slot TANLANGAN POZITSIYADA
                    ochiladi — layout animatsiya bilan kartalar SILLIQ suriladi */}
                <div
                  data-lenis-prevent
                  onScroll={(e) => { if (halfReached(e.currentTarget)) loadMore(); }}
                  className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain pr-0.5"
                >
                  {(() => {
                    const slotAt = isOver ? Math.min(overIdx ?? items.length, items.length) : -1;
                    const rows: React.ReactNode[] = [];
                    const slotEl = (
                      <motion.div
                        key="drop-slot"
                        layout
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 84, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 520, damping: 40 }}
                        className="box-border shrink-0 rounded-[15px] border-2 border-dashed"
                        style={{ borderColor: "var(--acc)", background: "rgba(255,255,255,.15)" }}
                        aria-hidden
                      />
                    );
                    items.forEach((l, idx) => {
                      if (slotAt === idx) rows.push(slotEl);
                      rows.push(
                        <motion.div
                          key={l.id}
                          layout
                          layoutId={`lead-${l.id}`}
                          transition={{ type: "spring", stiffness: 480, damping: 38 }}
                          className="shrink-0"
                        >
                          <LeadCard
                            l={l}
                            accent={sdef.color}
                            dragging={dragId === l.id}
                            onOpen={() => setSelLead(l)}
                            onEdit={canControl("crm") ? () => setEditLead(l) : undefined}
                            onDelete={canControl("crm") ? () => setConfirmDelLead(l) : undefined}
                            onDragOverCard={(e) => {
                              // kartaning ustki/pastki yarmi — qo'yish nuqtasini belgilaydi
                              e.preventDefault();
                              e.stopPropagation();
                              const r = e.currentTarget.getBoundingClientRect();
                              setOverCol(st);
                              setOverIdx(e.clientY < r.top + r.height / 2 ? idx : idx + 1);
                            }}
                            onDrag={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              grabRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY };
                              // natif snapshot o'chiriladi — o'rniga jonli ghost kursorga ergashadi
                              if (emptyImgRef.current) e.dataTransfer.setDragImage(emptyImgRef.current, 0, 0);
                              setGhost({ l, w: r.width });
                              setTimeout(() => setDragId(l.id), 0);
                            }}
                            onDragEnd={() => { setDragId(null); setOverCol(null); setOverIdx(null); setGhost(null); }}
                          />
                        </motion.div>
                      );
                    });
                    if (slotAt >= items.length) rows.push(slotEl);
                    return rows;
                  })()}
                </div>
              </div>
            );
          })}
          </LayoutGroup>
        </div>
      )}

      {view === "table" && (
        <div className="glass overflow-hidden !rounded-[20px] max-md:overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-[1.6fr_2.2fr_1fr_1.1fr_1fr_.8fr] gap-2.5 border-b-[1.5px] bg-tint px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest text-tintink" style={{ borderColor: "var(--line)" }}>
            <span>Mijoz</span><span>So&apos;rov</span><span>Manba</span><span>Taxminiy narx</span><span>Status</span><span>Vaqt</span>
          </div>
          {[...fLeads].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).map((l, ri) => (
            <button key={l.id} onClick={() => setSelLead(l)} className="row-lux group relative grid w-full min-w-[720px] grid-cols-[1.6fr_2.2fr_1fr_1.1fr_1fr_.8fr] items-center gap-2.5 border-t px-4 py-3 text-left text-[13px]" style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(ri * 45, 500)}ms` }}>
              <span className="min-w-0">
                <span className="block truncate font-bold" title={l.customer_detail?.name || `@${l.customer_detail?.instagram_username}`}>{l.customer_detail?.name || `@${l.customer_detail?.instagram_username}`}</span>
                <span className="block truncate text-[12px]" style={{ color: "var(--mut)" }}>{l.customer_detail?.phone || l.customer_detail?.masked_phone || "tel yo'q"}</span>
              </span>
              <span className="min-w-0 truncate" style={{ color: "var(--mut)" }} title={l.request_uz || l.request_ru}>{l.request_uz || l.request_ru}</span>
              <span><span className={SOURCE_BADGE(l.source)}>{l.source || "—"}</span></span>
              <span className="font-bold" style={{ color: "var(--acc)" }}>{fmt(l.estimated_price)}</span>
              <span>
                {(() => { const bp = statusBadgeProps(l.status, l.status_detail ?? statusOf(l.status)); return <span className={bp.className} style={bp.style}>{statusName(l.status, l.status_detail ?? statusOf(l.status))}</span>; })()}
              </span>
              <span className="text-xs" style={{ color: "var(--mut)" }}>{fmtTime(l.created_at)}</span>
              {/* qator amallari — hover'da (tugma ichida tugma bo'lmasin: span role=button) */}
              {canControl("crm") && (
                // markazlash flex bilan — transform emas (hover'dagi translateX(2px) transformni bosib yuboradi)
                <span className="absolute inset-y-0 right-3 flex items-center opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
                <span className="flex items-center gap-1 rounded-[10px] px-1 py-0.5 backdrop-blur-sm" style={{ background: "color-mix(in srgb, var(--surface) 78%, transparent)" }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setEditLead(l); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setEditLead(l); } }}
                    title="Tahrirlash"
                    aria-label={`Buyurtma #${l.id} — tahrirlash`}
                    className="icon-btn !h-7 !w-7"
                  >
                    <Pencil size={13.5} strokeWidth={1.75} />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setConfirmDelLead(l); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setConfirmDelLead(l); } }}
                    title="O'chirish"
                    aria-label={`Buyurtma #${l.id} — o'chirish`}
                    className="icon-btn icon-btn-danger !h-7 !w-7"
                  >
                    <Trash2 size={13.5} strokeWidth={1.75} />
                  </span>
                </span>
                </span>
              )}
            </button>
          ))}
          {fLeads.length === 0 && <EmptyState title="Tanlangan davrda buyurtma yo&apos;q" sub="Davr filtrini kengaytiring yoki yangi suhbatlarni kuting — AI buyurtmalarni avtomatik yaratadi." />}
          {loadingMore && (
            <p className="border-t py-3 text-center text-[12.5px] font-semibold" style={{ borderColor: "var(--line2)", color: "var(--muted)" }}>
              Yana yuklanmoqda…
            </p>
          )}
        </div>
      )}

      {selLead != null && (
        <LeadModal
          lead={selLead}
          statuses={cols}
          onClose={() => setSelLead(null)}
          onStatus={(st) => { setLeadStatus(selLead.id, st); setSelLead({ ...selLead, status: st }); }}
          onUpdated={(upd) => { setSelLead(upd); mutateLeads((ls) => ls.map((l) => (l.id === upd.id ? upd : l))); }}
          onEdit={canControl("crm") ? () => setEditLead(selLead) : undefined}
          onDelete={canControl("crm") ? () => setConfirmDelLead(selLead) : undefined}
        />
      )}
      {statusMgr && (
        <LeadStatusManager
          statuses={statuses}
          onClose={() => setStatusMgr(false)}
          onChanged={() => { api.leadStatuses().then((s) => s.length && setStatuses(s)).catch(() => {}); }}
        />
      )}
      {editLead != null && (
        <EditLeadModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={(upd) => {
            setEditLead(null);
            mutateLeads((ls) => ls.map((l) => (l.id === upd.id ? upd : l)));
            setSelLead((s) => (s?.id === upd.id ? upd : s));
          }}
        />
      )}
      {newLead && (
        <NewLeadModal
          customers={customers}
          onClose={() => setNewLead(false)}
          onSaved={(l) => { setNewLead(false); mutateLeads((ls) => [l, ...ls]); }}
        />
      )}

      {/* o'chirish tasdig'i — qaytarib bo'lmaydigan amal. PORTAL body ostida:
          sahifa animatsiyalari stacking-context yaratadi, aks holda dialog
          drawer overlay'i (body portali) ORQASIDA qolib ketadi */}
      {confirmDelLead && createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-5" style={{ background: "rgba(24,17,12,.4)", backdropFilter: "blur(8px)" }} onClick={() => setConfirmDelLead(null)} role="dialog" aria-modal="true" data-lenis-prevent>
          <div className="glass-modal w-[min(400px,100%)] p-6 animate-[rowIn_0.22s_var(--ease)_both]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-bold">Buyurtmani o&apos;chirish</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-2)]">
              «{confirmDelLead.customer_detail?.name || `@${confirmDelLead.customer_detail?.instagram_username ?? "—"}`} · #{confirmDelLead.id}» buyurtmasi butunlay o&apos;chirilsinmi? Bu amalni bekor qilib bo&apos;lmaydi.
            </p>
            {confirmDelLead.stock_deducted_at && (
              <p className="mt-2 rounded-[11px] bg-peach px-3 py-2 text-[12.5px] font-semibold leading-snug text-peachink">
                ⚠ Bu buyurtma bo&apos;yicha sklad allaqachon yechilgan.
              </p>
            )}
            <div className="mt-5 flex gap-2.5">
              <button onClick={() => setConfirmDelLead(null)} className="btn-ghost flex-1">Bekor qilish</button>
              <button onClick={doDeleteLead} disabled={deletingLead} className={`btn-danger flex-1 ${deletingLead ? "btn-loading" : ""}`}>O&apos;chirish</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* jonli drag ghost — kartaning o'zi, to'liq tiniq, yumshoq soya bilan */}
      {ghost &&
        createPortal(
          <div
            ref={(el) => {
              ghostRef.current = el;
              if (el) el.style.transform = `translate(${grabRef.current.x - grabRef.current.dx}px, ${grabRef.current.y - grabRef.current.dy}px)`;
            }}
            style={{ position: "fixed", left: 0, top: 0, width: ghost.w, zIndex: 120, pointerEvents: "none", willChange: "transform" }}
            aria-hidden
          >
            <div
              className="glass !rounded-[15px] p-3.5"
              style={{
                background: "var(--surface-solid)",
                boxShadow: `0 18px 44px rgba(20, 12, 8, 0.28)${ghost.l.status_detail?.color ? `, inset 3px 0 0 0 ${ghost.l.status_detail.color}` : ""}`,
                borderColor: "var(--acc)",
              }}
            >
              <CardBody l={ghost.l} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
