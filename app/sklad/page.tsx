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
import { dateAfterParam, fmt, fmtDate, fmtTime, movementLeadId, rangeParams } from "@/lib/format";
import DateChips from "@/components/DateChips";
import KirimModal from "@/components/KirimModal";
import BatchDrawer from "@/components/BatchDrawer";
import MaterialSklad, { MaterialMovesJournal } from "@/components/MaterialSklad";
import clsx from "clsx";
import { Icon } from "@/components/icons";
import type { StockBatch, StockMovement } from "@/lib/types";

const MOVE_LABEL: Record<string, string> = {
  in: "KIRIM", out: "CHIQIM", adjustment: "TUZATISH", waste: "CHIQIT", transfer_out: "O'TKAZMA →", transfer_in: "→ O'TKAZMA",
};
const MOVE_IN = new Set(["in", "transfer_in", "adjustment"]);

export default function SkladPage() {
  const router = useRouter();
  const { user, showToast, dateFilter, dateRange, setDateFilter } = useStore();
  // uch bo'lim: gul sklad (partiyalar), material sklad va kirim-chiqim jurnali
  const [tab, setTab] = useState<"gul" | "material" | "jurnal">("gul");
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [kirimOpen, setKirimOpen] = useState(false);
  const [selBatch, setSelBatch] = useState<StockBatch | null>(null);
  const [search, setSearch] = useState("");
  // server filtrlari
  const [branch, setBranch] = useState("");
  const [moveType, setMoveType] = useState("");

  const load = useCallback(async () => {
    try {
      const [bs, ms] = await Promise.all([
        api.stockBatches({ is_active: true, ordering: "-received_at", branch: branch || undefined }),
        // davr + tur filtri server tomonda
        api.stockMovements({
          ordering: "-created_at",
          ...(dateRange ? rangeParams(dateRange) : { created_at_after: dateAfterParam(dateFilter) }),
          movement_type: moveType || undefined,
        }),
      ]);
      setBatches(bs);
      setMoves(ms);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [showToast, dateFilter, dateRange, branch, moveType]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  const q = search.trim().toLowerCase();
  const fBatches = q
    ? batches.filter((b) => {
        const v = b.variant_detail;
        return [v?.flower_detail?.name_uz, v?.name_uz, v?.color_uz, b.batch_number, b.branch_detail?.name]
          .some((x) => (x ?? "").toLowerCase().includes(q));
      })
    : batches;
  const total = batches.reduce((a, b) => a + b.remaining_stems, 0);
  const lows = batches.filter((b) => b.remaining_stems > 0 && b.remaining_stems <= b.minimum_sale_stems * 2);
  const fMoves = moves;

  if (loading) return <FlowerLoader />;

  const TAB_LABEL = { gul: "Gul sklad", material: "Material sklad", jurnal: "Kirim-chiqim jurnali" } as const;
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
            <DateChips />
            <ClearFilters
              show={!!(moveType || dateRange || dateFilter !== "oy")}
              onClear={() => { setMoveType(""); setDateFilter("oy"); }}
            />
          </div>
        </div>

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
                onClick={leadId ? () => router.push(`/crm?lead=${leadId}`) : undefined}
                role={leadId ? "link" : undefined}
                tabIndex={leadId ? 0 : undefined}
                onKeyDown={leadId ? (e) => e.key === "Enter" && router.push(`/crm?lead=${leadId}`) : undefined}
                title={leadId ? `Lead #${leadId} kartasini ochish` : undefined}
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
                  <span className="shrink-0 whitespace-nowrap text-[11.5px] font-bold" style={{ color: "var(--primary)" }}>Lead #{leadId} ↗</span>
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
          <FilterSelect
            value={branch}
            onChange={setBranch}
            label="Filial"
            options={[
              { value: "", label: "Barcha filiallar" },
              ...(user?.profile.branches ?? []).map((b) => ({ value: String(b.id), label: b.name })),
            ]}
          />
          <ClearFilters
            show={!!(search || branch)}
            onClear={() => { setSearch(""); setBranch(""); }}
          />
          <button onClick={() => setKirimOpen(true)} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[14px]">
            <Plus size={18} strokeWidth={1.75} /> Keldi qilish
          </button>
        </div>
      </div>

      {/* partiya kartalari */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(255px,1fr))" }}>
        {fBatches.map((b) => {
          const low = b.remaining_stems > 0 && b.remaining_stems <= b.minimum_sale_stems * 2;
          const v = b.variant_detail;
          return (
            <article
              key={b.id}
              onClick={() => setSelBatch(b)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setSelBatch(b)}
              className="glass card-hover flex cursor-pointer flex-col overflow-hidden !rounded-[18px] text-left"
            >
              <div className="relative h-[120px] bg-bg2">
                {(b.image_url || v?.image_url) && <img src={b.image_url || v.image_url} alt={v?.name_uz} className="h-full w-full object-cover" />}
                {b.remaining_stems === 0 && <span className="absolute right-2 top-2 rotate-2 rounded-full border border-[#221833] bg-[#5a5a5a] px-2.5 py-0.5 text-[11px] font-bold text-white">TUGADI</span>}
                {low && <span className="absolute right-2 top-2 rotate-2 rounded-full border border-[#221833] bg-[#E4572E] px-2.5 py-0.5 text-[11px] font-bold text-white">KAM QOLDI</span>}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3.5">
                <div>
                  <div className="text-sm font-bold">{v?.flower_detail?.name_uz} — {v?.name_uz}</div>
                  <div className="text-xs" style={{ color: "var(--mut)" }}>
                    {b.branch_detail?.name} · keldi: {fmtDate(b.received_at)} · №{b.batch_number}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] font-semibold">{v?.color_uz}</span>
                  <span className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] font-semibold">{b.height_cm} sm</span>
                  <span className="rounded-full bg-peach px-2.5 py-0.5 text-[12px] font-semibold">min. {b.minimum_sale_stems} dona</span>
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <div className="text-[12px]" style={{ color: "var(--mut)" }}>Qoldiq</div>
                    <div className="text-sm font-bold">{b.remaining_bunches} pochka · {b.remaining_stems} dona</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px]" style={{ color: "var(--mut)" }}>Dona narxi</div>
                    <div className="text-sm font-bold" style={{ color: "var(--acc)" }}>{fmt(b.sale_price_per_stem)}</div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {fBatches.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              title={q ? "Qidiruvga mos partiya topilmadi" : "Skladda faol partiya yo'q"}
              sub={q ? "Boshqa so'z bilan urinib ko'ring." : "«Keldi qilish» orqali birinchi partiyani kiriting."}
            />
          </div>
        )}
      </div>

      {kirimOpen && <KirimModal onClose={() => setKirimOpen(false)} onSaved={load} />}
      {selBatch && (
        <BatchDrawer
          batch={selBatch}
          onClose={() => setSelBatch(null)}
          onChanged={(upd) => {
            if (upd) setBatches((bs) => bs.map((x) => (x.id === upd.id ? upd : x)));
            // kartalar + jurnal DARHOL yangilanadi (load jimgina — loader chiqmaydi)
            load();
          }}
        />
      )}
    </>
  );
}
