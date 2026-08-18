"use client";
import SearchInput from "@/components/SearchInput";
import { batchTitleNoHeight } from "@/lib/stockLabel";
import ClearFilters from "@/components/ClearFilters";
import FilterSelect from "@/components/FilterSelect";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import TotalsBar from "@/components/TotalsBar";
import RefreshButton from "@/components/RefreshButton";
import FlowerLoader from "@/components/FlowerLoader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { invalidateReportCache, notifyReportDataChanged } from "@/lib/reportCache";
import { useStore, usePerm } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { dateAfterParam, fmt, fmtDate, fmtTime, movementLeadId, movementRefLabel, rangeParams } from "@/lib/format";
import { totalsNum } from "@/lib/pagination";
import DateChips from "@/components/DateChips";
import BatchDrawer from "@/components/BatchDrawer";
import StockBatchCard from "@/components/StockBatchCard";
import StockBatchModal from "@/components/StockBatchModal";
import BatchEditModal from "@/components/BatchEditModal";
import DeliveryModal from "@/components/DeliveryModal";
import DeliveryDrawer from "@/components/DeliveryDrawer";
import MaterialDeliveryModal from "@/components/MaterialDeliveryModal";
import MaterialDeliveryDrawer from "@/components/MaterialDeliveryDrawer";
import { SupplierDetail } from "@/components/SupplierModal";
import MaterialSklad from "@/components/MaterialSklad";
import AccessorySklad from "@/components/AccessorySklad";
import clsx from "clsx";
import { Icon } from "@/components/icons";
import { DELIVERY, MATERIAL_DELIVERY, MOVEMENT_HUE, stems as fmtStems, bunches as fmtBunches, formatStemsAndBunches, freshness, PACKAGING_LABEL, compareBatchNewestFirst, compareDeliveryNewestFirst, batchMatchesQuery } from "@/lib/inventory";
import type { FloristStockIssue, FlowerVariant, MaterialDelivery, MaterialMovement, PackagingType, StockBatch, StockDelivery, StockMovement, Supplier } from "@/lib/types";

const MOVE_LABEL: Record<string, string> = {
  in: "KIRIM", out: "CHIQIM", adjustment: "TUZATISH", waste: "CHIQIT", transfer_out: "O'TKAZMA →", transfer_in: "→ O'TKAZMA",
};
const MOVE_IN = new Set(["in", "transfer_in", "adjustment"]);

/** Jurnal xulosasi — joriy filtr bo'yicha Kirim / Ishlab chiqarishga / Chiqit jami. */
function MovesSummary({ moves, floristWaste = [] }: { moves: StockMovement[]; floristWaste?: FloristStockIssue[] }) {
  const bunchSum = (pred: (m: StockMovement) => boolean) =>
    moves.reduce((a, m) => (pred(m) ? a + (parseFloat(m.quantity_bunches ?? "") || 0) : a), 0);
  const stemSum = (pred: (m: StockMovement) => boolean) =>
    moves.reduce((a, m) => (pred(m) ? a + (m.quantity_stems || 0) : a), 0);

  const cards = [
    { key: "kirim", label: "Kirim", hue: MOVEMENT_HUE.in, is: (m: StockMovement) => m.movement_type === "in" || m.movement_type === "transfer_in" },
    { key: "prod", label: "Ishlab chiqarishga", hue: MOVEMENT_HUE.out, is: (m: StockMovement) => m.movement_type === "out" || m.movement_type === "transfer_out" },
    { key: "chiqit", label: "Chiqit", hue: MOVEMENT_HUE.waste, is: (m: StockMovement) => m.movement_type === "waste" },
  ] as const;
  // florist qo'lidagi chiqit — ALOHIDA karta, sklad "Chiqit"iga QO'SHILMAYDI
  const fwStems = floristWaste.reduce((a, w) => a + w.quantity_stems, 0);

  return (
    <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
      {cards.map((c) => {
        const st = stemSum(c.is);
        const bu = bunchSum(c.is);
        const count = moves.filter(c.is).length;
        return (
          <div key={c.key} className="glass !rounded-[16px] p-3.5" style={{ borderLeft: `3px solid ${c.hue}` }}>
            {/* rang identifikatsiyasi chegara+nuqta+yorliqda; katta son doim --text
                (har temada kontrast kafolatlanadi — pushti temada primary yo'qolmaydi) */}
            <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: c.hue }}>
              <span className="h-2 w-2 rounded-full" style={{ background: c.hue }} />
              {c.label}
            </div>
            <div className="mt-1 text-[18px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>{fmtStems(st)}</div>
            <div className="text-[11.5px]" style={{ color: "var(--mut)" }}>
              {bu > 0 ? `${fmtBunches(bu)} · ` : ""}{count} harakat
            </div>
          </div>
        );
      })}
      {/* FLORIST QO'LIDAGI CHIQIT — sklad chiqiti bilan JAMLANMAGAN (ataylab) */}
      {fwStems > 0 && (
        <div className="glass !rounded-[16px] p-3.5" style={{ borderLeft: `3px solid ${MOVEMENT_HUE.waste}` }}>
          <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: MOVEMENT_HUE.waste }}>
            <span className="h-2 w-2 rounded-full" style={{ background: MOVEMENT_HUE.waste }} />
            Florist qo&apos;lidagi chiqit
          </div>
          <div className="mt-1 text-[18px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>{fmtStems(fwStems)}</div>
          <div className="text-[11.5px]" style={{ color: "var(--mut)" }}>Sklad chiqiti bilan qo&apos;shilmagan</div>
        </div>
      )}
    </div>
  );
}

/** Material jurnali xulosasi — plain dona (gul emas, pochka yo'q). */
function MatSummary({ moves, totals }: { moves: MaterialMovement[]; totals?: Record<string, unknown> }) {
  const sum = (pred: (m: MaterialMovement) => boolean) =>
    moves.reduce((a, m) => (pred(m) ? a + (m.quantity || 0) : a), 0);
  const cards = [
    { key: "kirim", label: "Kirim", hue: MOVEMENT_HUE.in, is: (m: MaterialMovement) => m.movement_type === "in" || m.movement_type === "transfer_in" },
    { key: "prod", label: "Ishlab chiqarishga", hue: MOVEMENT_HUE.out, is: (m: MaterialMovement) => m.movement_type === "out" || m.movement_type === "transfer_out" },
    { key: "chiqit", label: "Chiqit", hue: MOVEMENT_HUE.waste, is: (m: MaterialMovement) => m.movement_type === "waste" },
  ] as const;
  return (
    <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
      {cards.map((c) => {
        const qty = sum(c.is);
        const count = moves.filter(c.is).length;
        return (
          <div key={c.key} className="glass !rounded-[16px] p-3.5" style={{ borderLeft: `3px solid ${c.hue}` }}>
            <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: c.hue }}>
              <span className="h-2 w-2 rounded-full" style={{ background: c.hue }} />{c.label}
            </div>
            <div className="mt-1 text-[18px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>{Math.abs(qty).toLocaleString("ru")} dona</div>
            <div className="text-[11.5px]" style={{ color: "var(--mut)" }}>{count} harakat</div>
          </div>
        );
      })}
      {Number(totals?.sale_total ?? 0) > 0 && <div className="glass !rounded-[16px] p-3.5" style={{ borderLeft: "3px solid var(--acc)" }}><div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--acc)" }}>Accessory sotuvlari</div><div className="mt-1 text-[18px] font-extrabold tabular-nums">{fmt(Number(totals?.sale_total ?? 0))} so&apos;m</div><div className="text-[11.5px]" style={{ color: "var(--mut)" }}>alohida sotuv jami</div></div>}
    </div>
  );
}

const MAT_TYPES: PackagingType[] = ["wrap", "basket", "box", "other"];

export default function SkladPage() {
  const router = useRouter();
  const { showToast, dateFilter, dateRange, setDateFilter } = useStore();
  // partiya YARATISH/TAHRIRLASH ruxsati (spec: admin/warehouse = inventory boshqarish)
  const { canControl } = usePerm();
  const canManage = canControl("inventory");
  // bo'limlar: yuklar, gul sklad (partiyalar), material sklad va kirim-chiqim jurnali
  const [tab, setTab] = useState<"gul" | "yuklar" | "material" | "accessory" | "jurnal">("gul");
  const [deliveries, setDeliveries] = useState<StockDelivery[] | null>(null);
  const [selDelivery, setSelDelivery] = useState<StockDelivery | null>(null);
  const [newDeliveryOpen, setNewDeliveryOpen] = useState(false);
  // YUKLAR tabi ichida Gul/Material segment (Kirim-chiqim jurnalidagi jSource pattern'i)
  const [dSource, setDSource] = useState<"gul" | "material">("gul");
  const [matDeliveries, setMatDeliveries] = useState<MaterialDelivery[] | null>(null);
  const [selMatDelivery, setSelMatDelivery] = useState<MaterialDelivery | null>(null);
  const [newMatDeliveryOpen, setNewMatDeliveryOpen] = useState(false);
  // §1 material yuklari filtri — raqam bo'yicha qidiruv + postavshik (klientda; ro'yxat kichik)
  const [mdSearch, setMdSearch] = useState("");
  const [mdSupplier, setMdSupplier] = useState("");
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [floristWaste, setFloristWaste] = useState<FloristStockIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [kirimOpen, setKirimOpen] = useState(false);
  // dashboard alertidan chuqur havola: ?show=low (kam qolgan) | wilt (8+ kunlik)
  const [showFilter, setShowFilter] = useState<"" | "low" | "wilt">("");
  const [showDepleted, setShowDepleted] = useState(false); // tugagan (remaining_stems=0) partiyalarni ko'rsatish
  // §1c TEKIN filtri (server ?is_free=) va §3 GUL NAVI filtri (server ?variant=) — URL'da saqlanadi
  const [freeFilter, setFreeFilter] = useState<"" | "true" | "false">("");
  const [variantFilter, setVariantFilter] = useState("");
  const [variants, setVariants] = useState<FlowerVariant[]>([]);
  const [selBatch, setSelBatch] = useState<StockBatch | null>(null);
  const [editBatch, setEditBatch] = useState<StockBatch | null>(null); // kartadagi ikonkadan tahrirlash
  const [search, setSearch] = useState("");
  // server filtrlari
  const [moveType, setMoveType] = useState("");
  const [moveSupplier, setMoveSupplier] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  // jurnal manbasi — Gul sklad / Material sklad (sahifada saqlanadi)
  const [jSource, setJSource] = useState<"gul" | "material">("gul");
  const [matMoves, setMatMoves] = useState<MaterialMovement[]>([]);
  const [matMoveTotals, setMatMoveTotals] = useState<Record<string, unknown> | undefined>();
  const [matType, setMatType] = useState(""); // material turi — KLIENT filtri (packaging_type)
  // partiya batafsil (view) modali — barcha amallar shu yerda
  const [supplierDetail, setSupplierDetail] = useState<Supplier | null>(null);

  // ⚠️ ESKIRGAN JAVOB YOZIB KETMASIN — listPaged bitta so'rovga IKKI marta javob beradi
  // (birinchi sahifa + to'lig'i), filtr esa shu orada o'zgarishi mumkin.
  /**
   * ⚠️ JAMILAR SERVERDAN — `GET /api/stock-batches/` javobidagi `totals` bloki
   * (spec: FRONTEND_PAGINATION_TOTALS_API.md). Ilgari «Jami qoldiq» ekrandagi
   * qatorlar yig'indisidan hisoblanardi; ro'yxat kesilsa yoki sahifalansa u
   * jimgina noto'g'ri raqam ko'rsatardi.
   * ⚠️ `totals` FILTRGA ergashadi — shuning uchun ro'yxat bilan AYNAN bir xil
   * parametrlar yuboriladi; `page_size=1` — bizga faqat jamilar kerak.
   */
  const [totals, setTotals] = useState<Record<string, unknown> | undefined>();
  const batchFilters = useMemo(() => ({
    is_active: true,
    ...(freeFilter ? { is_free: freeFilter } : {}),
    ...(variantFilter ? { variant: variantFilter } : {}),
  }), [freeFilter, variantFilter]);
  useEffect(() => {
    const ac = new AbortController();
    api.stockBatchesPage({ ...batchFilters, page_size: 1 }, ac.signal)
      .then((d) => setTotals(d.totals))
      .catch(() => {});
    return () => ac.abort();
  }, [batchFilters]);

  const loadGen = useRef(0);
  const load = useCallback(async () => {
    const gen = ++loadGen.current;
    try {
      // ⚠️ TARTIB: server FAQAT received_at bo'yicha tartiblaydi (-id/-created_at e'tiborsiz) va bir
      // kun ichida BEQAROR — shuning uchun klientda compareBatchNewestFirst bilan barqarorlashtiramiz.
      // ⚠️ Bosqichma-bosqich: birinchi sahifa darhol chiziladi, «Jami qoldiq» va «kam qolgan»
      // sonlari to'liq ro'yxat kelgach aniqlashadi (ikkalasi ham HAMMA partiyadan hisoblanadi —
      // serverda bunday jami YO'Q, shuning uchun ro'yxat baribir to'liq olinadi).
      await api.stockBatchesPaged({
        is_active: true,
        // ⚠️ SAHIFALASH UCHUN BARQAROR TARTIB — `-received_at` da server teng sanali
        // qatorlarni har so'rovda boshqacha joylashtiradi va sahifa chegarasida qator
        // TUSHIB QOLADI (jonli: 141 dan 6 tasi yo'qolib, «Jami qoldiq» 225 → 175 bo'lgan).
        // Ekrandagi tartib pastda `compareBatchNewestFirst` bilan baribir qayta quriladi.
        ordering: "-id",
        ...(freeFilter ? { is_free: freeFilter } : {}),
        ...(variantFilter ? { variant: variantFilter } : {}),
      }, (rows, done) => {
        if (gen !== loadGen.current) return;
        setBatches(rows);
        if (!done) setLoading(false);   // partiyalar ekranga DARHOL chiqadi
      });
    } catch (e) {
      if (gen === loadGen.current) showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, [showToast, freeFilter, variantFilter]);

  /**
   * ⚠️ JURNAL ALOHIDA VA FAQAT O'Z TABIDA. Ilgari `stock-movements` HAR SAFAR, «Partiyalar»
   * tabida turganda ham yuklanardi — jonli o'lchov (08.08.2026): 423 qator, 5 ketma-ket
   * sahifa ≈ 8.6 s. Ya'ni sklad ochilishining katta qismi ko'rinmaydigan ro'yxatga ketardi.
   * ⚠️ SAHIFALANMAYDI: MovesSummary jamilari (tur bo'yicha dona/pochka) BUTUN davr bo'yicha
   * hisoblanadi va serverda bunday agregat yo'q — bo'lak-bo'lak olsak jami noto'g'ri chiqardi.
   */
  const loadMoves = useCallback(async () => {
    const range = dateRange ? rangeParams(dateRange) : { created_at_after: dateAfterParam(dateFilter) };
    try {
      setMoves(await api.stockMovements({
        ordering: "-created_at",
        ...range,
        movement_type: moveType || undefined,
        supplier: moveSupplier || undefined,
      }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Jurnalni yuklab bo'lmadi");
    }
    // florist qo'lidagi chiqit — alohida ko'rsatiladi (jamlanmaydi)
    api.floristStockIssues({ kind: "waste", ...range, page_size: 200 }).then(setFloristWaste).catch(() => setFloristWaste([]));
  }, [showToast, dateFilter, dateRange, moveType, moveSupplier]);
  useEffect(() => { if (tab === "jurnal" && jSource === "gul") loadMoves(); }, [tab, jSource, loadMoves]);

  // yetkazib beruvchilar — jurnal filtri uchun (bir marta)
  useEffect(() => {
    api.suppliers({ is_active: true, page_size: "all" }).then(setSuppliers).catch(() => {});
  }, []);

  // material harakatlari — faqat Material manbasi tanlanganda, davr+tur filtri server tomonda
  const loadMat = useCallback(async () => {
    try {
      const d = await api.packagingMovementsPage({
        ordering: "-created_at",
        ...(dateRange ? rangeParams(dateRange) : { created_at_after: dateAfterParam(dateFilter) }),
        movement_type: moveType || undefined,
        packaging__packaging_type: matType || undefined,
      });
      setMatMoves(d.results);
      setMatMoveTotals(d.totals);
    } catch { /* jimgina */ }
  }, [dateFilter, dateRange, moveType, matType]);
  useEffect(() => { if (tab === "jurnal" && jSource === "material") loadMat(); }, [tab, jSource, loadMat]);

  // YUKLAR — faqat shu tab ochilganda (server ordering: eng yangi birinchi)
  const loadDeliveries = useCallback(() => {
    // ⚠️ server bir kun ichida beqaror — klientda barqarorlashtiramiz (partiya bilan AYNAN bir qoida)
    api.stockDeliveries({ is_active: true, ordering: "-received_at" }).then((ds) => setDeliveries([...ds].sort(compareDeliveryNewestFirst))).catch(() => setDeliveries([]));
  }, []);
  const loadMatDeliveries = useCallback(() => {
    api.materialDeliveries({ is_active: true, ordering: "-received_at" }).then(setMatDeliveries).catch(() => setMatDeliveries([]));
  }, []);
  useEffect(() => {
    if (tab !== "yuklar") return;
    if (dSource === "gul") loadDeliveries(); else loadMatDeliveries();
  }, [tab, dSource, loadDeliveries, loadMatDeliveries]);

  useEffect(() => { api.flowerVariants({ is_active: true }).then(setVariants).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  // ⚠️ Davriy yangilash KO'RINIB TURGAN narsani yangilaydi: jurnal tabida jurnalni ham,
  // aks holda faqat partiyalarni (ko'rinmaydigan 423 qatorli ro'yxatni har safar tortmaymiz).
  const refreshVisible = useCallback(() => {
    load();
    if (tab === "jurnal") { if (jSource === "gul") loadMoves(); else loadMat(); }
  }, [load, tab, jSource, loadMoves, loadMat]);
  // ⚠️ avtomatik taymer YO'Q — «Yangilash» tugmasi orqali (RefreshButton)
  const { refresh, loadedAt } = useAutoRefresh(refreshVisible);

  // WS: supplier_stock (yangi partiya keldi) → sklad darhol yangilanadi.
  // Kesh ham tozalanadi (WS push invalidate qilmaydi) — mount holatida stale qolmasin.
  useEffect(() => {
    // ⚠️ YUKLAR HAM qayta yuklanadi: partiyaning `received_stems`i to'g'rilansa yukning
    // JAMILARI (dona/tannarx) siljiydi — aks holda ro'yxat eskirgan raqam ko'rsatib turadi.
    const onStock = () => { invalidateReportCache(); refreshVisible(); loadDeliveries(); };
    window.addEventListener("ef:stock-changed", onStock);
    return () => window.removeEventListener("ef:stock-changed", onStock);
  }, [refreshVisible, loadDeliveries]);

  // §1c/§3 FILTRLARNI URL'da SAQLASH — yangilash yoki havola ulashishda saqlanadi
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const fr = p.get("free"); if (fr === "true" || fr === "false") setFreeFilter(fr);
    const va = p.get("variant"); if (va) setVariantFilter(va);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    freeFilter ? u.searchParams.set("free", freeFilter) : u.searchParams.delete("free");
    variantFilter ? u.searchParams.set("variant", variantFilter) : u.searchParams.delete("variant");
    window.history.replaceState(null, "", u);
  }, [freeFilter, variantFilter]);

  // chuqur havola: ?tab=partiyalar&batch=N (suppliers'dan) yoki ?batch=N
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("tab") === "partiyalar") setTab("gul");
    const show = p.get("show");
    if (show === "low" || show === "wilt") { setTab("gul"); setShowFilter(show); }
    const bid = Number(p.get("batch"));
    if (bid) api.stockBatch(bid).then(setSelBatch).catch(() => {});
    const sid = Number(p.get("supplier"));
    if (sid) api.supplier(sid).then(setSupplierDetail).catch(() => {});
  }, []);

  const q = search.trim().toLowerCase();
  // ko'p so'zli qidiruv + BO'YI («prut 40» → Prut navi, 40 sm) — lib/inventory
  const searched = q ? batches.filter((b) => batchMatchesQuery(b, q)) : batches;
  // qoldig'i yetarli bo'lmagan partiyalar YUQORIGA suriladi (restock diqqati):
  //   0 — kam qoldi (hali sotiladi, tugash arafasida), 1 — tugadi, 2 — normal
  const stockRank = (b: StockBatch) =>
    b.remaining_stems === 0 ? 1 : b.remaining_stems <= b.minimum_sale_stems * 2 ? 0 : 2;
  const shown = showFilter === "low"
    ? searched.filter((b) => b.is_active && b.remaining_stems > 0 && b.remaining_stems <= b.minimum_sale_stems * 2)
    : showFilter === "wilt"
      ? searched.filter((b) => b.is_active && b.remaining_stems > 0 && freshness(b.received_at).days >= 8)
      // TUGAGAN (remaining_stems=0) partiyalar sukut bo'yicha yashiriladi (tanlash/ko'rish uchun) — toggle bilan qaytariladi.
      // Hisobotlar (Hisob-kitob/Analitika) accounting/harakatlar'ga tayanadi — bu filtr ularga TA'SIR QILMAYDI.
      : searched.filter((b) => showDepleted || b.remaining_stems > 0);
  // ⚠️ §2 SUKUT TARTIBI — «oxirgi qo'shilgan birinchi» (barqaror: sana ↓ → created_at ↓ → id ↓).
  // Ilgari bu yerda stockRank (kam qoldiq yuqoriga) turardi va u yangilik tartibini BOSIB KETARDI;
  // kam qoldiq diqqati «Kam qolgan partiyalar» chipi orqali saqlanib qoldi.
  const fBatches = [...shown].sort(compareBatchNewestFirst);
  const depletedCount = searched.filter((b) => b.remaining_stems === 0).length;
  // ⚠️ SERVERNING jamisi; javob hali kelmagan bo'lsa zaxira — ro'yxat yig'indisi
  const total = totals ? totalsNum(totals, "remaining_stems") : batches.reduce((a, b) => a + b.remaining_stems, 0);
  const lows = batches.filter((b) => b.remaining_stems > 0 && b.remaining_stems <= b.minimum_sale_stems * 2);
  const fMoves = moves;
  // material turi — packaging_type bo'yicha KLIENT filtri (API'da faqat packaging id filtri bor)
  const fMatMoves = matType
    ? matMoves.filter((m) => (m.packaging_detail?.packaging_type ?? m.material_detail?.packaging_type) === matType)
    : matMoves;

  if (loading) return <FlowerLoader />;

  const TAB_LABEL = { gul: "Partiyalar", yuklar: DELIVERY.many, material: "Material sklad", accessory: "Aksessuarlar", jurnal: "Kirim-chiqim jurnali" } as const;
  const tabBar = (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {(["gul", "yuklar", "material", "accessory", "jurnal"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          aria-pressed={tab === t}
          className={clsx("rounded-full border-[1.5px] px-5 py-2 text-[13px] font-bold", tab === t ? "text-white" : "bg-sfc")}
          style={tab === t ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}
        >
          {TAB_LABEL[t]}
        </button>
      ))}
    </div>
  );

  if (tab === "yuklar") {
    const isGul = dSource === "gul";
    // §1 material yuklari — postavshik variantlari + qidiruv/filtr natijasi (server ordering: eng yangi birinchi)
    const mdSupplierOpts = [
      { value: "", label: "Barcha postavshiklar" },
      ...Array.from(new Map((matDeliveries ?? []).filter((d) => d.supplier_detail).map((d) => [d.supplier_detail!.id, d.supplier_detail!.name])).entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, name]) => ({ value: String(id), label: name })),
    ];
    const mdQ = mdSearch.trim().toLowerCase();
    const shownMatDeliveries = (matDeliveries ?? []).filter((d) =>
      (!mdQ || (d.number ?? "").toLowerCase().includes(mdQ) || (d.note ?? "").toLowerCase().includes(mdQ))
      && (!mdSupplier || String(d.supplier ?? d.supplier_detail?.id ?? "") === mdSupplier));
    return (
      <>
        {tabBar}
        {/* GUL / MATERIAL segment — Kirim-chiqim jurnalidagi manba segmenti bilan bir xil IA */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["gul", "material"] as const).map((sVal) => (
            <button key={sVal} onClick={() => setDSource(sVal)} aria-pressed={dSource === sVal}
              className={clsx("flex items-center gap-1.5 rounded-full border-[1.5px] px-4 py-1.5 text-[12.5px] font-bold transition-colors", dSource === sVal ? "text-white" : "bg-sfc")}
              style={dSource === sVal ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--line)", color: "var(--mut)" }}>
              {sVal === "gul" ? "Gul yuklari" : MATERIAL_DELIVERY.many}
            </button>
          ))}
        </div>

        {!isGul ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
                Material yuki = bir kelishda kelgan materiallar guruhi. Avval yuk ochiladi, keyin materiallar kiritiladi.
              </p>
              <button onClick={() => setNewMatDeliveryOpen(true)} className="btn-primary !flex-none px-4 py-2.5 text-[14px] ml-auto">
                <Plus size={18} strokeWidth={1.75} /> {MATERIAL_DELIVERY.neu}
              </button>
            </div>
            {/* §1 FILTRLAR — raqam bo'yicha qidiruv + postavshik (gul Yuklaridagi bilan bir xil his) */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SearchInput value={mdSearch} onChange={setMdSearch} ariaLabel="Yuk raqami bo'yicha qidirish" placeholder="Yuk raqami…" />
              {mdSupplierOpts.length > 1 && <FilterSelect value={mdSupplier} onChange={setMdSupplier} label={MATERIAL_DELIVERY.supplierWord} options={mdSupplierOpts} />}
              <ClearFilters show={!!(mdSearch || mdSupplier)} onClear={() => { setMdSearch(""); setMdSupplier(""); }} />
            </div>
            {matDeliveries === null ? <FlowerLoader /> : shownMatDeliveries.length === 0 ? (
              <EmptyState title={matDeliveries.length === 0 ? "Hali material yuki yo'q" : "Bu filtrda yuk topilmadi"} sub={matDeliveries.length === 0 ? "«Yangi material yuki» orqali birinchi yukni oching, so'ng materiallarni kiriting." : "Qidiruv yoki postavshik filtrini o'zgartiring."} />
            ) : (
              <section className="glass !rounded-[20px] p-2 sm:p-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-[13px]" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "var(--muted)" }}>
                        <th className="px-3 py-2 text-left font-semibold">{MATERIAL_DELIVERY.colNumber}</th>
                        <th className="px-3 py-2 text-left font-semibold">Sana</th>
                        <th className="px-3 py-2 text-left font-semibold">{MATERIAL_DELIVERY.supplierWord}</th>
                        <th className="px-3 py-2 text-right font-semibold">Xil</th>
                        <th className="px-3 py-2 text-right font-semibold">Dona</th>
                        <th className="px-3 py-2 text-right font-semibold">Tannarx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* ⚠️ key = id (number TAKRORLANADI) */}
                      {shownMatDeliveries.map((dv) => {
                        const fr = freshness(dv.received_at);
                        return (
                        <tr key={dv.id} onClick={() => setSelMatDelivery(dv)} tabIndex={0} role="button"
                          onKeyDown={(e) => e.key === "Enter" && setSelMatDelivery(dv)}
                          className="cursor-pointer border-t transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--line2)" }}>
                          <td className="px-3 py-2.5 font-bold">{dv.number}</td>
                          <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--text-2)" }}>
                            {fmtDate(dv.received_at)}
                            {/* YANGILIK chipi — gul partiyalaridagi bilan bir xil shkala */}
                            <span className="ml-1.5 rounded-full px-1.5 py-px text-[10px] font-bold" style={{ background: `color-mix(in srgb, ${fr.hue} 14%, transparent)`, color: fr.hue }}>{fr.label}</span>
                          </td>
                          {/* POSTAVSHIK chipi — bosilganda postavshik sahifasiga (qator ochilishini to'xtatamiz) */}
                          <td className="px-3 py-2.5">
                            {dv.supplier_detail ? (
                              <span role="link" tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); router.push(`/postavshiklar?supplier=${dv.supplier_detail!.id}`); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); router.push(`/postavshiklar?supplier=${dv.supplier_detail!.id}`); } }}
                                className="cursor-pointer rounded-full px-2 py-0.5 text-[12px] font-semibold underline-offset-2 hover:underline"
                                style={{ background: "var(--hover)", color: "var(--text-2)" }}>{dv.supplier_detail.name}</span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{dv.item_count}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{dv.total_quantity.toLocaleString("ru")}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmt(dv.total_cost)}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {newMatDeliveryOpen && <MaterialDeliveryModal onClose={() => setNewMatDeliveryOpen(false)} onSaved={(dv) => { setNewMatDeliveryOpen(false); loadMatDeliveries(); setSelMatDelivery(dv); }} />}
            {selMatDelivery && <MaterialDeliveryDrawer delivery={selMatDelivery} onClose={() => setSelMatDelivery(null)} onChanged={loadMatDeliveries} />}
          </>
        ) : (<>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
            Yuk = bir kelishda kelgan gullar guruhi. Avval yuk ochiladi, keyin ichiga partiyalar qo&apos;shiladi.
          </p>
          <button onClick={() => setNewDeliveryOpen(true)} className="btn-primary !flex-none px-4 py-2.5 text-[14px] ml-auto">
            <Plus size={18} strokeWidth={1.75} /> {DELIVERY.neu}
          </button>
        </div>
        {deliveries === null ? <FlowerLoader /> : deliveries.length === 0 ? (
          <EmptyState title="Hali yuk yo'q" sub="«Yangi yuk» orqali birinchi yukni oching, so'ng ichiga gullarni kiriting." />
        ) : (
          <section className="glass !rounded-[20px] p-2 sm:p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--muted)" }}>
                    <th className="px-3 py-2 text-left font-semibold">{DELIVERY.colNumber}</th>
                    <th className="px-3 py-2 text-left font-semibold">Sana</th>
                    <th className="px-3 py-2 text-left font-semibold">{DELIVERY.supplierWord}</th>
                    <th className="px-3 py-2 text-right font-semibold">Xil gul</th>
                    <th className="px-3 py-2 text-right font-semibold">Kelgan</th>
                    <th className="px-3 py-2 text-right font-semibold">Qolgan</th>
                    <th className="px-3 py-2 text-right font-semibold">Tannarx</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ⚠️ key = id (number TAKRORLANADI) */}
                  {deliveries.map((dv) => (
                    <tr key={dv.id} onClick={() => setSelDelivery(dv)} tabIndex={0} role="button"
                      onKeyDown={(e) => e.key === "Enter" && setSelDelivery(dv)}
                      className="cursor-pointer border-t transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--line2)" }}>
                      <td className="px-3 py-2.5 font-bold">{dv.number}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--text-2)" }}>{fmtDate(dv.received_at)}</td>
                      <td className="px-3 py-2.5">{dv.supplier_detail?.name ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{dv.batch_count}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtStems(dv.total_stems)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmtStems(dv.remaining_stems)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmt(dv.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {newDeliveryOpen && <DeliveryModal onClose={() => setNewDeliveryOpen(false)} onSaved={(dv) => { setNewDeliveryOpen(false); loadDeliveries(); setSelDelivery(dv); }} />}
        {selDelivery && <DeliveryDrawer delivery={selDelivery} onClose={() => setSelDelivery(null)} onChanged={loadDeliveries} />}
        </>)}
      </>
    );
  }

  if (tab === "material") {
    return (
      <>
        {tabBar}
        <MaterialSklad />
      </>
    );
  }

  if (tab === "accessory") {
    return (
      <>
        {tabBar}
        <AccessorySklad />
      </>
    );
  }

  if (tab === "jurnal") {
    const isGul = jSource === "gul";
    return (
      <>
        {tabBar}
        {/* MANBA — Gul sklad / Material sklad (segment) */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["gul", "material"] as const).map((sVal) => (
            <button
              key={sVal}
              onClick={() => setJSource(sVal)}
              aria-pressed={jSource === sVal}
              className={clsx("flex items-center gap-1.5 rounded-full border-[1.5px] px-4 py-1.5 text-[12.5px] font-bold transition-colors", jSource === sVal ? "text-white" : "bg-sfc")}
              style={jSource === sVal ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--line)", color: "var(--mut)" }}
            >
              {sVal === "gul" ? "Gul sklad" : "Material sklad"}
            </button>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
            {isGul ? "Gul partiyalari bo'yicha kirim-chiqim harakatlari" : "Material (o'ram/savat/quti) kirim-chiqim harakatlari"}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <FilterSelect
              value={moveType}
              onChange={setMoveType}
              label="Harakat"
              options={[
                { value: "", label: "Barcha harakatlar" },
                { value: "in", label: "Kirim" },
                { value: "out", label: "Chiqim" },
                { value: "adjustment", label: "Tuzatish" },
                { value: "waste", label: "Chiqit" },
                { value: "transfer_in", label: "O'tkazma kirdi" },
                { value: "transfer_out", label: "O'tkazma chiqdi" },
              ]}
            />
            {/* gul → yetkazib beruvchi; material → material turi */}
            {isGul && suppliers.length > 0 && (
              <FilterSelect
                value={moveSupplier}
                onChange={setMoveSupplier}
                label="Yetkazib beruvchi"
                options={[{ value: "", label: "Barcha yetkazib beruvchilar" }, ...suppliers.map((s) => ({ value: String(s.id), label: s.name }))]}
              />
            )}
            {!isGul && (
              <FilterSelect
                value={matType}
                onChange={setMatType}
                label="Material turi"
                options={[{ value: "", label: "Barcha turlar" }, ...MAT_TYPES.map((t) => ({ value: t, label: PACKAGING_LABEL[t] }))]}
              />
            )}
            <DateChips />
            <ClearFilters
              show={!!(moveType || (isGul ? moveSupplier : matType) || dateRange || dateFilter !== "oy")}
              onClear={() => { setMoveType(""); setMoveSupplier(""); setMatType(""); setDateFilter("oy"); }}
            />
          </div>
        </div>

        {/* xulosa — manba bo'yicha (gul: dona+pochka, material: dona) */}
        {isGul ? <MovesSummary moves={fMoves} floristWaste={floristWaste} /> : <MatSummary moves={fMatMoves} totals={matMoveTotals} />}

        {/* MATERIAL harakatlari — timeline */}
        {!isGul && (
          <section className="glass !rounded-[20px] p-5">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="text-base font-bold">Material harakatlari</h2>
              <span className="text-xs" style={{ color: "var(--mut)" }}>o&apos;ram/savat/quti kirim-chiqim</span>
            </div>
            {fMatMoves.map((m) => {
              const isIn = MOVE_IN.has(m.movement_type);
              const md = m.packaging_detail ?? m.material_detail;
              const leadId = movementLeadId(m);
              const who = m.performed_by_detail
                ? [m.performed_by_detail.first_name, m.performed_by_detail.last_name].filter(Boolean).join(" ") || m.performed_by_detail.username
                : "Tizim";
              return (
                <div
                  key={m.id}
                  onClick={leadId ? () => router.push(`/buyurtmalar?order=${leadId}`) : undefined}
                  role={leadId ? "link" : undefined}
                  tabIndex={leadId ? 0 : undefined}
                  onKeyDown={leadId ? (e) => e.key === "Enter" && router.push(`/buyurtmalar?order=${leadId}`) : undefined}
                  className={`row-lux flex items-center gap-3.5 border-t py-3 ${leadId ? "cursor-pointer" : ""}`}
                  style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(fMatMoves.indexOf(m) * 40, 480)}ms` }}
                >
                  <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full ${isIn ? "bg-mint text-mintink" : "bg-peach text-peachink"}`}>
                    {isIn ? <ArrowDown size={16} strokeWidth={2} /> : <ArrowUp size={16} strokeWidth={2} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">
                      {md?.name_uz || md?.name_ru || `Material #${m.packaging ?? "—"}`} — {Math.abs(m.quantity)} dona
                      {m.reason ? ` · ${m.reason}` : ""}
                    </div>
                    <div className="mt-0.5 truncate text-xs" style={{ color: "var(--mut)" }}>
                      {md?.packaging_type ? `${PACKAGING_LABEL[md.packaging_type as PackagingType] ?? md.packaging_type} · ` : ""}{who} · {fmtTime(m.created_at)}
                    </div>
                  </div>
                  <span className={`min-w-[52px] rounded-full border px-2.5 py-0.5 text-center text-[11px] font-bold ${isIn ? "bg-mint text-mintink" : "bg-peach text-peachink"}`} style={{ borderColor: "var(--line2)" }}>
                    {MOVE_LABEL[m.movement_type] ?? m.movement_type.toUpperCase()}
                  </span>
                </div>
              );
            })}
            {fMatMoves.length === 0 && <EmptyState title="Tanlangan davrda material harakati yo&apos;q" sub="Davr yoki tur filtrini kengaytirib ko&apos;ring." />}
          </section>
        )}

        {/* GUL harakatlari — timeline */}
        {isGul && (
        <section className="glass !rounded-[20px] p-5">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-base font-bold">Gul harakatlari</h2>
            <span className="text-xs" style={{ color: "var(--mut)" }}>partiyalar bo&apos;yicha kirim-chiqim</span>
          </div>
          {fMoves.map((m) => {
            const isIn = MOVE_IN.has(m.movement_type);
            const leadId = movementLeadId(m);
            const who = m.performed_by_detail
              ? [m.performed_by_detail.first_name, m.performed_by_detail.last_name].filter(Boolean).join(" ") || m.performed_by_detail.username
              : "Tizim";
            return (
              <div
                key={m.id}
                onClick={leadId ? () => router.push(`/buyurtmalar?order=${leadId}`) : undefined}
                role={leadId ? "link" : undefined}
                tabIndex={leadId ? 0 : undefined}
                onKeyDown={leadId ? (e) => e.key === "Enter" && router.push(`/buyurtmalar?order=${leadId}`) : undefined}
                title={leadId ? `Buyurtma #${leadId} kartasini ochish` : undefined}
                className={`row-lux flex items-center gap-3.5 border-t py-3 ${leadId ? "cursor-pointer" : ""}`}
                style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(fMoves.indexOf(m) * 40, 480)}ms` }}
              >
                <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-base font-extrabold ${isIn ? "bg-mint text-mintink" : "bg-peach text-peachink"}`}>
                  {isIn ? <ArrowDown size={16} strokeWidth={2} /> : <ArrowUp size={16} strokeWidth={2} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold" title={`${batchTitleNoHeight(m.batch_detail, "")} — ${formatStemsAndBunches(Math.abs(m.quantity_stems), m.batch_detail?.stems_per_bunch)}${m.reason ? ` · ${m.reason}` : ""}`}>
                    {/* ⚠️ nom helper'dan — «general» qatorda bo'sh nav qo'sh bo'shliq qoldirardi */}
                    {batchTitleNoHeight(m.batch_detail)} — {formatStemsAndBunches(Math.abs(m.quantity_stems), m.batch_detail?.stems_per_bunch)}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate text-xs" style={{ color: "var(--mut)" }}>
                    <span>{who} · {fmtTime(m.created_at)}</span>
                    {m.reference_type?.startsWith("florist") && movementRefLabel(m.reference_type) && (
                      <span className="rounded-full px-1.5 py-px text-[10.5px] font-bold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>{movementRefLabel(m.reference_type)}</span>
                    )}
                    {(m.cost_value != null || m.sale_value != null) && (
                      <span className="flex items-center gap-1.5 tabular-nums">
                        {m.cost_value != null && +m.cost_value !== 0 && <span title="Tannarx qiymati">Tannarx <b style={{ color: "var(--text-2)" }}>{fmt(Math.abs(+m.cost_value))}</b></span>}
                        {m.sale_value != null && +m.sale_value !== 0 && <span title="Sotuv qiymati">Sotuv <b style={{ color: "var(--acc)" }}>{fmt(Math.abs(+m.sale_value))}</b></span>}
                      </span>
                    )}
                  </div>
                </div>
                {leadId != null && (
                  <span className="shrink-0 whitespace-nowrap text-[11.5px] font-bold" style={{ color: "var(--primary)" }}>Buyurtma #{leadId} ↗</span>
                )}
                <span className={`min-w-[52px] rounded-full border px-2.5 py-0.5 text-center text-[11px] font-bold ${isIn ? "bg-mint text-mintink" : "bg-peach text-peachink"}`} style={{ borderColor: "var(--line2)" }}>
                  {MOVE_LABEL[m.movement_type] ?? m.movement_type.toUpperCase()}
                </span>
              </div>
            );
          })}
          {fMoves.length === 0 && <EmptyState title="Tanlangan davrda harakat yo&apos;q" sub="Davr filtrini kengaytirib ko&apos;ring." />}
        </section>
        )}
      </>
    );
  }

  return (
    <>
      {tabBar}
      {/* ⚠️ HAMMA RAQAM SERVERNING `totals` blokidan — filtr o'zgarsa u ham o'zgaradi */}
      <TotalsBar
        items={[
          { label: "Partiya", value: totalsNum(totals, "batches") },
          { label: "Xil gul", value: totalsNum(totals, "flowers") },
          { label: "Postavshik", value: totalsNum(totals, "suppliers") },
          { label: "Skladda", value: totalsNum(totals, "remaining_stems"), unit: "dona" },
          { label: "Qoldiq tannarxi", value: totalsNum(totals, "remaining_cost"), money: true },
          { label: "Qoldiq sotuvda", value: totalsNum(totals, "remaining_sale_value"), money: true, hue: "var(--acc)" },
        ]}
        loading={!totals}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          {/* ⚠️ «Jami qoldiq» — SERVERNING totals.remaining_stems i (ro'yxat yig'indisi EMAS) */}
          Jami qoldiq: <b>{total.toLocaleString("ru")}</b> dona · {lows.length} pozitsiya minimal chegarada
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* ⚠️ avtomatik yangilash o'chirilgan — eskirganini yashirmaslik uchun tugma + vaqt */}
          <RefreshButton onRefresh={refresh} loadedAt={loadedAt} busy={loading} />
          {depletedCount > 0 && !showFilter && (
            <button
              onClick={() => setShowDepleted((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold transition-colors hover:bg-[var(--hover)]"
              style={{ borderColor: showDepleted ? "var(--primary)" : "var(--border)", color: showDepleted ? "var(--primary)" : "var(--text-2)" }}
              title={showDepleted ? "Tugagan partiyalarni yashirish" : "Tugagan partiyalarni ko'rsatish"}
            >
              Tugagan partiyalar ({depletedCount}){showDepleted ? " ✕" : ""}
            </button>
          )}
          {showFilter && (
            <button
              onClick={() => setShowFilter("")}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold transition-colors hover:bg-[var(--hover)]"
              style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
              title="Filtrni tozalash"
            >
              {showFilter === "low" ? "Kam qolgan partiyalar" : "So'lish xavfi (8+ kun)"} ✕
            </button>
          )}
          <SearchInput value={search} onChange={setSearch} ariaLabel="Partiya qidirish" />
          {/* §3 GUL NAVI — server ?variant= (qidiriladigan; gul · nav · rang bilan) */}
          <FilterSelect
            value={variantFilter}
            onChange={setVariantFilter}
            label="Gul navi"
            searchable
            options={[{ value: "", label: "Barcha navlar" }, ...variants.map((v) => ({
              value: String(v.id),
              label: `${v.flower_detail?.name_uz ?? "Gul"} ${v.name_uz ?? ""}`.trim(),
              sub: v.color_uz || undefined,
            }))]}
          />
          {/* §1c TEKIN — server ?is_free= */}
          <FilterSelect
            value={freeFilter}
            onChange={(v) => setFreeFilter(v as "" | "true" | "false")}
            label="Tekin"
            options={[
              { value: "", label: "Hammasi" },
              { value: "false", label: "Sotib olingan" },
              { value: "true", label: "Tekin" },
            ]}
          />
          <ClearFilters
            show={!!search || !!showFilter || !!freeFilter || !!variantFilter}
            onClear={() => { setSearch(""); setShowFilter(""); setFreeFilter(""); setVariantFilter(""); }}
          />
          <button onClick={() => setKirimOpen(true)} className="btn-primary !flex-none px-4 py-2.5 text-[14px]">
            <Plus size={18} strokeWidth={1.75} /> Yangi partiya
          </button>
        </div>
      </div>

      {/* partiya kartalari — stem gauge + freshness + supplier chip */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {fBatches.map((b) => (
          <StockBatchCard
            key={b.id}
            batch={b}
            onOpenSupplier={(sid) => api.supplier(sid).then(setSupplierDetail).catch(() => {})}
            onView={() => setSelBatch(b)}
            onEdit={canManage ? () => setEditBatch(b) : undefined}
          />
        ))}
        {fBatches.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              title={q ? "Qidiruvga mos partiya topilmadi" : "Skladda faol partiya yo'q"}
              sub={q ? "Boshqa so'z bilan urinib ko'ring." : "«Yangi partiya» orqali birinchi partiyani kiriting."}
            />
          </div>
        )}
      </div>

      {kirimOpen && <StockBatchModal onClose={() => setKirimOpen(false)} onSaved={() => { notifyReportDataChanged(); load(); }} />}
      {editBatch && (
        <BatchEditModal
          batch={editBatch}
          onClose={() => setEditBatch(null)}
          onSaved={(upd) => { setBatches((bs) => bs.map((x) => (x.id === upd.id ? upd : x))); load(); }}
        />
      )}
      {selBatch && (
        <BatchDrawer
          batch={selBatch}
          onClose={() => setSelBatch(null)}
          onChanged={(upd) => {
            if (upd) setBatches((bs) => bs.map((x) => (x.id === upd.id ? upd : x)));
            notifyReportDataChanged(); // partiya tahriri/o'chirish/chiqit/harakat → hisobot
            load();
          }}
        />
      )}
      {supplierDetail && (
        <SupplierDetail supplier={supplierDetail} onClose={() => setSupplierDetail(null)} onOpenBatch={(bch) => { setSupplierDetail(null); setSelBatch(bch); }} />
      )}
    </>
  );
}
