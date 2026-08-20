"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Download, TrendingUp } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useStore, usePerm } from "@/lib/store";
import DateChips from "@/components/DateChips";
import FilterSelect from "@/components/FilterSelect";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { dateAfterParam, fmt } from "@/lib/format";
import { exportWorkbook, exportName } from "@/lib/xlsx";
import type { BranchReport, CatalogTransfer } from "@/lib/types";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// ⚠️ O'Z NUSXASI OLIB TASHLANDI. U «hafta» ni −7, «oy» ni −30 deb hisoblardi,
// umumiy helper esa −6 / oy boshi deb — ya'ni bu sahifa boshqa sahifalardan
// BIR KUN farq qiladigan davrni so'rardi. Endi yagona manba: lib/format.
const dateAfter = (f: string) => dateAfterParam(f as "bugun" | "hafta" | "oy");
// ikki bo'lim — chip-almashtirish (florist stock sahifasi bilan bir xil pattern; u app/floristlar'dan)
const TAB_LABEL = { hisobot: "Hisobot", tarix: "Yuborilganlar tarixi" } as const;
type Tab = keyof typeof TAB_LABEL;

export default function BranchReportPage() {
  const { showToast, dateFilter, dateRange } = useStore();
  const { canView } = usePerm();
  const allowed = canView("dashboard");
  const [rep, setRep] = useState<BranchReport | null>(null);
  const [transfers, setTransfers] = useState<CatalogTransfer[] | null>(null);
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<Tab>("hisobot");
  const [tBranch, setTBranch] = useState(""); // tarix tabi filiali (nom bo'yicha)

  const from = dateRange ? dateRange.from : dateAfter(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());

  // ?tab= o'qish/yozish (refresh/ulashilgan link o'sha ko'rinishga tushadi)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && t in TAB_LABEL) setTab(t as Tab);
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    if (typeof window !== "undefined") { const u = new URL(window.location.href); u.searchParams.set("tab", t); window.history.replaceState(null, "", u); }
  };

  const load = useCallback(() => {
    if (!allowed) return;
    api.branchReport({ from, to }).then((d) => { setRep(d); setErr(""); }).catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
    // ⚠️ catalog-transfers SANA filtrini QABUL QILMAYDI (OpenAPI: branch/ordering/search/…
    // faqat) — tarix BUTUN davrni ko'rsatadi. Bu tabda muted izoh bilan aytiladi.
    api.catalogTransfers({ ordering: "-created_at", page_size: 200 }).then(setTransfers).catch(() => setTransfers([]));
  }, [allowed, from, to]);
  useEffect(() => { load(); }, [load]);

  const maxRevenue = useMemo(() => Math.max(1, ...(rep?.branches ?? []).map((b) => +b.sold_revenue || 0)), [rep]);
  const transferBranchNames = useMemo(() => Array.from(new Set((transfers ?? []).map((t) => t.branch_name).filter(Boolean))), [transfers]);
  const shownTransfers = useMemo(() => (transfers ?? []).filter((t) => !tBranch || t.branch_name === tBranch), [transfers, tBranch]);
  // ⚠️ FILIAL foydalanuvchisiga backend `source_price`ni OLIB TASHLAYDI. Ustunni MA'LUMOTdan
  // aniqlaymiz: birorta transferda asl narx bo'lsagina «Asl → …» ko'rsatamiz (aks holda faqat filial narxi).
  const transfersHaveSource = useMemo(() => shownTransfers.some((t) => t.source_price != null), [shownTransfers]);

  const doExport = async () => {
    if (!rep) return;
    setExporting(true);
    try {
      // EKSPORT: filial HISOBOTINI (branches + JAMI) qamraydi, sana oralig'i bo'yicha.
      // «Yuborilganlar tarixi» (transfers) bu faylga KIRMAYDI.
      await exportWorkbook(exportName("Filial_hisoboti", from, to), [{
        name: "Filiallar",
        cols: [
          { header: "Filial", key: "branch_name", type: "text" },
          { header: "Jami kelgan (dona)", key: "incoming_quantity", type: "int" },
          { header: "Transfer (dona)", key: "received_quantity", type: "int" },
          { header: "Transfer (partiya)", key: "received_transfers", type: "int" },
          { header: "To'g'ridan-to'g'ri (dona)", key: "direct_quantity", type: "int" },
          { header: "Katalog yozuvlari", key: "catalog_items", type: "int" },
          { header: "Sotuvda", key: "available_quantity", type: "int" },
          { header: "Sotilgan", key: "sold_quantity", type: "int" },
          { header: "Tushum", key: "sold_revenue", type: "money" },
          { header: "Asl qiymati", key: "source_value", type: "money" },
          { header: "Ustama", key: "markup_total", type: "money" },
          { header: "Chegirmali sotuv", key: "discounted_sales_count", type: "int" },
          { header: "Chegirmali dona", key: "discounted_quantity", type: "int" },
          { header: "Chegirma jami", key: "discount_total", type: "money" },
        ],
        rows: rep.branches as unknown as Record<string, unknown>[],
        totals: { branch_name: "JAMI", incoming_quantity: rep.totals.incoming_quantity, received_quantity: rep.totals.received_quantity, direct_quantity: rep.totals.direct_quantity, sold_quantity: rep.totals.sold_quantity, sold_revenue: rep.totals.sold_revenue, discounted_quantity: rep.totals.discounted_quantity, discount_total: rep.totals.discount_total },
      }]);
      showToast("✓ Excel yuklab olindi");
    } catch { showToast("Eksport qilib bo'lmadi"); }
    finally { setExporting(false); }
  };

  if (!allowed) return <div className="p-8"><EmptyState title="Ruxsat yo'q" sub="Bu sahifa «dashboard» ruxsatini talab qiladi." /></div>;
  if (!rep && !err) return <FlowerLoader />;

  const branches = rep?.branches ?? [];
  const reportEmpty = branches.length === 0 || branches.every((b) => +b.sold_revenue === 0 && b.incoming_quantity === 0);

  return (
    <div className="flex flex-col gap-5">
      {/* SARLAVHA — har ikki tab uchun umumiy */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><Building2 size={18} strokeWidth={2} /></span>
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight">Filial hisoboti</h1>
          <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Nechta katalog yuborildi · nechtasi sotildi · <b style={{ color: "var(--text-2)" }}>ustama</b>. Pul oqimi (filiallar kesimida) → <Link href="/hisob-kitob" className="font-bold" style={{ color: "var(--primary)" }}>Hisob-kitob</Link></p>
        </div>
      </div>

      {/* DAVR + EKSPORT — BUTUN sahifani tavsiflaydi (tab ustida) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateChips />
        <button onClick={doExport} disabled={exporting || reportEmpty} title="Filial hisobotini (davr bo'yicha) Excelga — tarix kirmaydi" className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold transition-colors hover:bg-[var(--hover)] disabled:opacity-50" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>
          <Download size={14} strokeWidth={2} /> {exporting ? "Yuklanmoqda…" : "Excel"}
        </button>
      </div>

      {/* CHIPLAR — bir vaqtda bittasi */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button key={t} onClick={() => switchTab(t)} aria-pressed={tab === t}
            className={clsx("rounded-full border-[1.5px] px-5 py-2 text-[13px] font-bold", tab === t ? "text-white" : "bg-sfc")}
            style={tab === t ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* TAB 1 — HISOBOT (davr bo'yicha) */}
      {tab === "hisobot" && (
        err ? <EmptyState title="Yuklab bo'lmadi" sub={err} />
        : reportEmpty ? <EmptyState title="Bu davrda filial sotuvi yo'q" sub="Filialga katalog yuborilib, o'sha yerda sotilganda — yuborilgan soni, sotilgani va ustama shu yerda ko'rinadi. Katalogdan «Filialga yuborish» orqali boshlang, keyin filialda soting." />
        : (<>
          {/* ustama vs asl qiymat — stacked bar */}
          <section className="glass !rounded-[18px] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold"><TrendingUp size={16} strokeWidth={2.2} style={{ color: "var(--acc)" }} /> Ustama vs asl qiymat</h2>
            <div className="flex flex-col gap-3">
              {branches.map((b) => {
                const src = +b.source_value || 0, mk = +b.markup_total || 0, rev = +b.sold_revenue || 0;
                const w = (rev / maxRevenue) * 100;
                const srcPct = rev > 0 ? (src / rev) * 100 : 0;
                return (
                  <div key={b.branch_id}>
                    <div className="mb-1 flex items-center justify-between text-[12.5px]"><span className="font-bold">{b.branch_name}</span><span className="tabular-nums" style={{ color: "var(--muted)" }}>{fmt(rev)}</span></div>
                    <div className="h-5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                      <div className="flex h-full" style={{ width: `${w}%` }}>
                        <div style={{ width: `${srcPct}%`, background: "var(--chart-2)" }} title={`Asl qiymati: ${fmt(src)}`} />
                        <div style={{ width: `${100 - srcPct}%`, background: "var(--primary)" }} title={`Ustama: ${fmt(mk)}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[11.5px]" style={{ color: "var(--muted)" }}>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-2)" }} /> Asl qiymati</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--primary)" }} /> Ustama (filial qo&apos;shgan qiymat)</span>
            </div>
          </section>

          {/* ⚠️ §5 HALOL IZOH: asosiy foydalanuvchi filial kataloglarini YAKKA-yakka ko'ra olmaydi
              (GET /api/catalog/ filialga scoped, itemda 404; ?branch filtri yo'q). Shu hisobot —
              transfer/to'g'ridan-to'g'ri ajratmasi bilan — ularni kuzatishning yagona yo'li. */}
          <div className="flex items-start gap-1.5 rounded-[12px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
            <Building2 size={13} strokeWidth={2.2} className="mt-px shrink-0" />
            <span>Filial kataloglari asosiy ro&apos;yxatda ko&apos;rinmaydi (yakka item ochib bo&apos;lmaydi). Ular shu yerda — <b>transfer</b> yoki <b>to&apos;g&apos;ridan-to&apos;g&apos;ri</b> — yig&apos;indi sifatida hisoblanadi.</span>
          </div>

          {/* jadval */}
          <section className="glass !rounded-[18px] p-5">
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full min-w-[1040px] border-collapse text-[13px]">
                <thead><tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="px-2 py-2 font-semibold">Filial</th>
                  <th className="px-2 py-2 text-right font-semibold">Jami kelgan</th>
                  <th className="px-2 py-2 text-right font-semibold">Transfer</th>
                  <th className="px-2 py-2 text-right font-semibold">To&apos;g&apos;ridan-to&apos;g&apos;ri</th>
                  <th className="px-2 py-2 text-right font-semibold">Sotuvda</th>
                  <th className="px-2 py-2 text-right font-semibold">Sotilgan</th>
                  <th className="px-2 py-2 text-right font-semibold">Tushum</th>
                  <th className="px-2 py-2 text-right font-semibold">Asl qiymati</th>
                  <th className="px-2 py-2 text-right font-semibold">Ustama</th>
                  <th className="px-2 py-2 text-right font-semibold">Chegirma</th>
                </tr></thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.branch_id} className="border-t" style={{ borderColor: "var(--line2)" }}>
                      <td className="px-2 py-2.5 font-bold">{b.branch_name}</td>
                      {/* JAMI KELGAN (incoming) headline + ikki manba ajratmasi (transfer / to'g'ridan-to'g'ri) */}
                      <td className="px-2 py-2.5 text-right tabular-nums font-bold">{b.incoming_quantity}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{b.received_quantity}<div className="text-[11px]">{b.received_transfers} partiya</div></td>
                      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{b.direct_quantity}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{b.available_quantity}<div className="text-[11px]" style={{ color: "var(--muted)" }}>{b.catalog_items} yozuv</div></td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{b.sold_quantity}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{fmt(b.sold_revenue)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{fmt(b.source_value)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-bold" style={{ color: "var(--acc)" }}>{fmt(b.markup_total)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: b.discount_total && +b.discount_total > 0 ? "var(--warning-ink)" : "var(--muted)" }}>{+b.discount_total > 0 ? <>{fmt(b.discount_total)}<div className="text-[11px]">{b.discounted_quantity} dona</div></> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold" style={{ borderColor: "var(--border-strong)" }}>
                    <td className="px-2 py-2.5">JAMI</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{rep!.totals.incoming_quantity}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{rep!.totals.received_quantity}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{rep!.totals.direct_quantity}</td>
                    <td className="px-2 py-2.5" />
                    <td className="px-2 py-2.5 text-right tabular-nums">{rep!.totals.sold_quantity}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{fmt(rep!.totals.sold_revenue)}</td>
                    <td className="px-2 py-2.5" />
                    <td className="px-2 py-2.5" />
                    <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--warning-ink)" }}>{+rep!.totals.discount_total > 0 ? fmt(rep!.totals.discount_total) : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>)
      )}

      {/* TAB 2 — YUBORILGANLAR TARIXI (BUTUN davr — sana filtri qo'llanmaydi) */}
      {tab === "tarix" && (
        <section className="glass !rounded-[18px] p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">Yuborilganlar tarixi</h2>
            {transferBranchNames.length > 1 && (
              <FilterSelect value={tBranch} onChange={setTBranch} label="Filial" options={[{ value: "", label: "Barcha filiallar" }, ...transferBranchNames.map((nm) => ({ value: nm, label: nm }))]} />
            )}
          </div>
          {/* ⚠️ sana filtri bu tabga QO'LLANMAYDI — davr ustidagi picker faqat «Hisobot» tabi uchun */}
          <p className="mb-3 text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>Butun davr — sana filtri qo&apos;llanmaydi</p>
          {transfers === null ? <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>
            : shownTransfers.length === 0 ? <EmptyState title="Hozircha yuborilgan yo'q" sub="Asosiy filial katalogidagi mahsulotdan «Filialga yuborish» tugmasi orqali filialga yuboriladi — o'shanda bu yerda paydo bo'ladi." />
            : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full min-w-[640px] border-collapse text-[13px]">
                <thead><tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="px-2 py-2 font-semibold">Mahsulot</th><th className="px-2 py-2 font-semibold">Filial</th>
                  <th className="px-2 py-2 text-right font-semibold">Soni</th><th className="px-2 py-2 text-right font-semibold">{transfersHaveSource ? "Asl → Filial narxi" : "Filial narxi"}</th><th className="px-2 py-2 text-right font-semibold">Sana</th>
                </tr></thead>
                <tbody>
                  {shownTransfers.map((t) => (
                    <tr key={t.id} className="border-t" style={{ borderColor: "var(--line2)" }}>
                      {/* target — ODDIY MATN, LINK EMAS (asosiy admin filial itemni ocholmaydi: 404) */}
                      <td className="px-2 py-2.5 font-semibold">{t.catalog_name}<div className="text-[11px]" style={{ color: "var(--muted)" }}>filial yozuvi #{t.target_item ?? "—"}</div></td>
                      <td className="px-2 py-2.5">{t.branch_name}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{t.quantity}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{t.source_price != null ? <>{fmt(t.source_price)} → </> : ""}<b>{fmt(t.target_price)}</b></td>
                      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{(t.created_at || "").slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
