"use client";
import SearchInput from "@/components/SearchInput";
import ClearFilters from "@/components/ClearFilters";
import FilterSelect from "@/components/FilterSelect";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { dateAfterParam, fmtTime, movementLeadId, rangeParams } from "@/lib/format";
import DateChips from "@/components/DateChips";
import BatchDrawer from "@/components/BatchDrawer";
import StockBatchCard from "@/components/StockBatchCard";
import StockBatchModal from "@/components/StockBatchModal";
import { BatchMovementModal, BatchMovesModal } from "@/components/BatchMovementModal";
import { SupplierDetail } from "@/components/SupplierModal";
import MaterialSklad, { MaterialMovesJournal } from "@/components/MaterialSklad";
import clsx from "clsx";
import { Icon } from "@/components/icons";
import { MOVEMENT_HUE, stems as fmtStems, bunches as fmtBunches } from "@/lib/inventory";
import type { StockBatch, StockMovement, Supplier } from "@/lib/types";

const MOVE_LABEL: Record<string, string> = {
  in: "KIRIM", out: "CHIQIM", adjustment: "TUZATISH", waste: "CHIQIT", transfer_out: "O'TKAZMA →", transfer_in: "→ O'TKAZMA",
};
const MOVE_IN = new Set(["in", "transfer_in", "adjustment"]);

/** Jurnal xulosasi — joriy filtr bo'yicha Kirim / Ishlab chiqarishga / Chiqit jami. */
function MovesSummary({ moves }: { moves: StockMovement[] }) {
  const bunchSum = (pred: (m: StockMovement) => boolean) =>
    moves.reduce((a, m) => (pred(m) ? a + (parseFloat(m.quantity_bunches ?? "") || 0) : a), 0);
  const stemSum = (pred: (m: StockMovement) => boolean) =>
    moves.reduce((a, m) => (pred(m) ? a + (m.quantity_stems || 0) : a), 0);

  const cards = [
    { key: "kirim", label: "Kirim", hue: MOVEMENT_HUE.in, is: (m: StockMovement) => m.movement_type === "in" || m.movement_type === "transfer_in" },
    { key: "prod", label: "Ishlab chiqarishga", hue: MOVEMENT_HUE.out, is: (m: StockMovement) => m.movement_type === "out" || m.movement_type === "transfer_out" },
    { key: "chiqit", label: "Chiqit", hue: MOVEMENT_HUE.waste, is: (m: StockMovement) => m.movement_type === "waste" },
  ] as const;

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
    </div>
  );
}

export default function SkladPage() {
  const router = useRouter();
  const { showToast, dateFilter, dateRange, setDateFilter } = useStore();
  // uch bo'lim: gul sklad (partiyalar), material sklad va kirim-chiqim jurnali
  const [tab, setTab] = useState<"gul" | "material" | "jurnal">("gul");
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [kirimOpen, setKirimOpen] = useState(false);
  const [selBatch, setSelBatch] = useState<StockBatch | null>(null);
  const [search, setSearch] = useState("");
  // server filtrlari
  const [moveType, setMoveType] = useState("");
  const [moveSupplier, setMoveSupplier] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  // partiya amallari
  const [wasteBatch, setWasteBatch] = useState<StockBatch | null>(null);
  const [movesBatch, setMovesBatch] = useState<StockBatch | null>(null);
  const [supplierDetail, setSupplierDetail] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    try {
      const [bs, ms] = await Promise.all([
        api.stockBatches({ is_active: true, ordering: "-received_at" }),
        // davr + tur filtri server tomonda
        api.stockMovements({
          ordering: "-created_at",
          ...(dateRange ? rangeParams(dateRange) : { created_at_after: dateAfterParam(dateFilter) }),
          movement_type: moveType || undefined,
          supplier: moveSupplier || undefined,
        }),
      ]);
      setBatches(bs);
      setMoves(ms);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [showToast, dateFilter, dateRange, moveType, moveSupplier]);

  // yetkazib beruvchilar — jurnal filtri uchun (bir marta)
  useEffect(() => {
    api.suppliers({ is_active: true }).then(setSuppliers).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  // WS: supplier_stock (yangi partiya keldi) → sklad darhol yangilanadi
  useEffect(() => {
    const onStock = () => load();
    window.addEventListener("ef:stock-changed", onStock);
    return () => window.removeEventListener("ef:stock-changed", onStock);
  }, [load]);

  // chuqur havola: ?tab=partiyalar&batch=N (suppliers'dan) yoki ?batch=N
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("tab") === "partiyalar") setTab("gul");
    const bid = Number(p.get("batch"));
    if (bid) api.stockBatch(bid).then(setSelBatch).catch(() => {});
    const sid = Number(p.get("supplier"));
    if (sid) api.supplier(sid).then(setSupplierDetail).catch(() => {});
  }, []);

  // partiya kartasini lokal yangilash (waste/edit'dan keyin darhol ko'rinsin)
  const patchBatch = (b: StockBatch) => setBatches((bs) => bs.map((x) => (x.id === b.id ? b : x)));

  const q = search.trim().toLowerCase();
  const searched = q
    ? batches.filter((b) => {
        const v = b.variant_detail;
        return [v?.flower_detail?.name_uz, v?.name_uz, v?.color_uz, b.batch_number]
          .some((x) => (x ?? "").toLowerCase().includes(q));
      })
    : batches;
  // qoldig'i yetarli bo'lmagan partiyalar YUQORIGA suriladi (restock diqqati):
  //   0 — kam qoldi (hali sotiladi, tugash arafasida), 1 — tugadi, 2 — normal
  const stockRank = (b: StockBatch) =>
    b.remaining_stems === 0 ? 1 : b.remaining_stems <= b.minimum_sale_stems * 2 ? 0 : 2;
  const fBatches = [...searched].sort((a, b) => stockRank(a) - stockRank(b));
  const total = batches.reduce((a, b) => a + b.remaining_stems, 0);
  const lows = batches.filter((b) => b.remaining_stems > 0 && b.remaining_stems <= b.minimum_sale_stems * 2);
  const fMoves = moves;

  if (loading) return <FlowerLoader />;

  const TAB_LABEL = { gul: "Partiyalar", material: "Material sklad", jurnal: "Kirim-chiqim jurnali" } as const;
  const tabBar = (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {(["gul", "material", "jurnal"] as const).map((t) => (
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

  if (tab === "material") {
    return (
      <>
        {tabBar}
        <MaterialSklad />
      </>
    );
  }

  if (tab === "jurnal") {
    return (
      <>
        {tabBar}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
            Sklad bo&apos;yicha barcha harakatlar — gul va material kirim-chiqimlari
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
            {suppliers.length > 0 && (
              <FilterSelect
                value={moveSupplier}
                onChange={setMoveSupplier}
                label="Yetkazib beruvchi"
                options={[{ value: "", label: "Barcha yetkazib beruvchilar" }, ...suppliers.map((s) => ({ value: String(s.id), label: s.name }))]}
              />
            )}
            <DateChips />
            <ClearFilters
              show={!!(moveType || moveSupplier || dateRange || dateFilter !== "oy")}
              onClear={() => { setMoveType(""); setMoveSupplier(""); setDateFilter("oy"); }}
            />
          </div>
        </div>

        {/* xulosa — joriy filtr bo'yicha kirim/ishlab chiqarish/chiqit */}
        <MovesSummary moves={fMoves} />

        {/* gul harakatlari — timeline */}
        <section className="glass !rounded-[20px] p-5">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-base font-bold">Gul harakatlari</h2>
            <span className="text-xs" style={{ color: "var(--mut)" }}>partiyalar bo&apos;yicha kirim-chiqim</span>
          </div>
          {fMoves.map((m) => {
            const isIn = MOVE_IN.has(m.movement_type);
            const v = m.batch_detail?.variant_detail;
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
                  <div className="truncate text-[14px] font-semibold" title={`${v?.flower_detail?.name_uz ?? ""} ${v?.name_uz ?? ""} — ${m.quantity_stems} dona${m.reason ? ` · ${m.reason}` : ""}`}>
                    {v?.flower_detail?.name_uz} {v?.name_uz} — {m.quantity_stems} dona
                    {m.reason ? ` · ${m.reason}` : ""}
                  </div>
                  <div className="mt-0.5 truncate text-xs" style={{ color: "var(--mut)" }}>{who} · {fmtTime(m.created_at)}</div>
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

        {/* material harakatlari */}
        <MaterialMovesJournal />
      </>
    );
  }

  return (
    <>
      {tabBar}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Jami qoldiq: <b>{total.toLocaleString("ru")}</b> dona · {lows.length} pozitsiya minimal chegarada
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Partiya qidirish" />
          <ClearFilters
            show={!!search}
            onClear={() => setSearch("")}
          />
          <button onClick={() => setKirimOpen(true)} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[14px]">
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
            onWaste={() => setWasteBatch(b)}
            onMoves={() => setMovesBatch(b)}
            onEdit={() => setSelBatch(b)}
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

      {kirimOpen && <StockBatchModal onClose={() => setKirimOpen(false)} onSaved={load} />}
      {selBatch && (
        <BatchDrawer
          batch={selBatch}
          onClose={() => setSelBatch(null)}
          onChanged={(upd) => {
            if (upd) setBatches((bs) => bs.map((x) => (x.id === upd.id ? upd : x)));
            load();
          }}
        />
      )}
      {wasteBatch && (
        <BatchMovementModal batch={wasteBatch} onClose={() => setWasteBatch(null)} onDone={(upd) => { patchBatch(upd); load(); }} />
      )}
      {movesBatch && <BatchMovesModal batch={movesBatch} onClose={() => setMovesBatch(null)} />}
      {supplierDetail && (
        <SupplierDetail supplier={supplierDetail} onClose={() => setSupplierDetail(null)} onOpenBatch={(bch) => { setSupplierDetail(null); setSelBatch(bch); }} />
      )}
    </>
  );
}
