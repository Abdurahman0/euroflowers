"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Download, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useStore, usePerm } from "@/lib/store";
import DateChips from "@/components/DateChips";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { fmt } from "@/lib/format";
import { exportWorkbook, exportName } from "@/lib/xlsx";
import type { BranchReport, CatalogTransfer } from "@/lib/types";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dateAfter = (f: string) => { const d = new Date(); if (f === "hafta") d.setDate(d.getDate() - 7); else if (f === "oy") d.setDate(d.getDate() - 30); return ymd(d); };

export default function BranchReportPage() {
  const { showToast, dateFilter, dateRange } = useStore();
  const { canView } = usePerm();
  const allowed = canView("dashboard");
  const [rep, setRep] = useState<BranchReport | null>(null);
  const [transfers, setTransfers] = useState<CatalogTransfer[] | null>(null);
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState(false);

  const from = dateRange ? dateRange.from : dateAfter(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());

  const load = useCallback(() => {
    if (!allowed) return;
    api.branchReport({ from, to }).then((d) => { setRep(d); setErr(""); }).catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
    api.catalogTransfers({ ordering: "-created_at", page_size: 100 }).then(setTransfers).catch(() => setTransfers([]));
  }, [allowed, from, to]);
  useEffect(() => { load(); }, [load]);

  const maxRevenue = useMemo(() => Math.max(1, ...(rep?.branches ?? []).map((b) => +b.sold_revenue || 0)), [rep]);

  const doExport = async () => {
    if (!rep) return;
    setExporting(true);
    try {
      await exportWorkbook(exportName("Filial_hisoboti", from, to), [{
        name: "Filiallar",
        cols: [
          { header: "Filial", key: "branch_name", type: "text" },
          { header: "Yuborilgan (partiya)", key: "received_transfers", type: "int" },
          { header: "Yuborilgan (dona)", key: "received_quantity", type: "int" },
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
        totals: { branch_name: "JAMI", received_quantity: rep.totals.received_quantity, sold_quantity: rep.totals.sold_quantity, sold_revenue: rep.totals.sold_revenue, discounted_quantity: rep.totals.discounted_quantity, discount_total: rep.totals.discount_total },
      }]);
      showToast("✓ Excel yuklab olindi");
    } catch { showToast("Eksport qilib bo'lmadi"); }
    finally { setExporting(false); }
  };

  if (!allowed) return <div className="p-8"><EmptyState title="Ruxsat yo'q" sub="Bu sahifa «dashboard» ruxsatini talab qiladi." /></div>;
  if (!rep && !err) return <FlowerLoader />;

  const branches = rep?.branches ?? [];
  const empty = branches.length === 0 || branches.every((b) => +b.sold_revenue === 0 && b.received_quantity === 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><Building2 size={18} strokeWidth={2} /></span>
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight">Filial hisoboti</h1>
          {/* §1c: bu sahifa boshqa savolga javob beradi — pul oqimi Hisob-kitobda */}
          <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Nechta katalog yuborildi · nechtasi sotildi · <b style={{ color: "var(--text-2)" }}>ustama</b>. Pul oqimi (filiallar kesimida) → <Link href="/hisob-kitob" className="font-bold" style={{ color: "var(--primary)" }}>Hisob-kitob</Link></p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateChips />
        <button onClick={doExport} disabled={exporting || empty} className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold transition-colors hover:bg-[var(--hover)] disabled:opacity-50" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>
          <Download size={14} strokeWidth={2} /> {exporting ? "Yuklanmoqda…" : "Excel"}
        </button>
      </div>

      {err ? <EmptyState title="Yuklab bo'lmadi" sub={err} />
        : empty ? <EmptyState title="Hozircha ma'lumot yo'q" sub="Filialga katalog yuborilib sotilganda shu yerda ko'rinadi. Katalogdan «Filialga yuborish» orqali boshlang." />
        : (
        <>
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

          {/* jadval */}
          <section className="glass !rounded-[18px] p-5">
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full min-w-[900px] border-collapse text-[13px]">
                <thead><tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="px-2 py-2 font-semibold">Filial</th>
                  <th className="px-2 py-2 text-right font-semibold">Yuborilgan</th>
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
                      <td className="px-2 py-2.5 text-right tabular-nums">{b.received_quantity}<div className="text-[11px]" style={{ color: "var(--muted)" }}>{b.received_transfers} partiya</div></td>
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
                    <td className="px-2 py-2.5 text-right tabular-nums">{rep!.totals.received_quantity}</td>
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
        </>
      )}

      {/* YUBORILGANLAR TARIXI — target item PLAIN TEXT (asosiy admin uni ocholmaydi: 404) */}
      <section className="glass !rounded-[18px] p-5">
        <h2 className="mb-3 text-[15px] font-bold">Yuborilganlar tarixi</h2>
        {transfers === null ? <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>
          : transfers.length === 0 ? <EmptyState title="Yuborilgan yo'q" sub="Katalogdan «Filialga yuborish» orqali boshlang." />
          : (
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead><tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-2 py-2 font-semibold">Mahsulot</th><th className="px-2 py-2 font-semibold">Filial</th>
                <th className="px-2 py-2 text-right font-semibold">Soni</th><th className="px-2 py-2 text-right font-semibold">Asl → Filial narxi</th><th className="px-2 py-2 text-right font-semibold">Sana</th>
              </tr></thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-t" style={{ borderColor: "var(--line2)" }}>
                    <td className="px-2 py-2.5 font-semibold">{t.catalog_name}<div className="text-[11px]" style={{ color: "var(--muted)" }}>filial yozuvi #{t.target_item ?? "—"}</div></td>
                    <td className="px-2 py-2.5">{t.branch_name}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{t.quantity}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{fmt(t.source_price)} → <b>{fmt(t.target_price)}</b></td>
                    <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{(t.created_at || "").slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
