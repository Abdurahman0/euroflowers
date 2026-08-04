"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Info, Receipt } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { fmt, fmtLocalTime } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import DatePicker from "@/components/DatePicker";
import {
  buildSalesQuery, salesFiltersToParams, salesPageCount, totalsView, discountView, isDiscounted,
  saleNum, deliveryRowView, PAYMENT_FILTERS, SALES_PAGE_SIZE,
} from "@/lib/catalogSales";
import { paymentBreakdownLabel } from "@/lib/mixedPayment";
import type { CatalogSalesPage } from "@/lib/types";

/**
 * SOTUVLAR — katalog sahifasining ikkinchi tabi (GET /api/catalog/sales/).
 *
 * ⚠️ BU HISOB-KITOBGA QARSHI EMAS — jonli tekshiruvda AYNAN teng chiqdi:
 *   catalog/sales revenue 7 430 000 == accounting?branch=main total_sales 7 430 000.
 * Farqi: bu ro'yxat O'Z FILIALI sotuvlarini ko'rsatadi va TANNARX/FOYDA yo'q.
 * Shuning uchun sarlavha «Sotuvlar bo'yicha» — «Savdo» EMAS.
 */
export default function CatalogSalesTab({ branchUser, onOpenItem }: {
  /** filial foydalanuvchisida «Filial» ustuni CHIZILMAYDI (bitta takrorlanuvchi qiymat) */
  branchUser: boolean;
  onOpenItem: (catalogItemId: number) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [data, setData] = useState<CatalogSalesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [payment, setPayment] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  // URL'dan o'qish (chuqur havola) — bir marta
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const df = p.get("date_from"); if (df) setDateFrom(df);
    const dt = p.get("date_to"); if (dt) setDateTo(dt);
    const pm = p.get("payment"); if (pm) setPayment(pm);
    const s = p.get("q"); if (s) { setSearch(s); setQ(s); }
    const pg = Number(p.get("page")); if (pg > 1) setPage(pg);
  }, []);
  // URL'ga yozish — filtrlar BIR-BIRINI o'chirmaydi (hammasi birga saqlanadi)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    u.searchParams.set("tab", "sotuvlar");
    const keep = salesFiltersToParams({ dateFrom, dateTo, payment, search: q, page });
    for (const k of ["date_from", "date_to", "payment", "q", "page"]) u.searchParams.delete(k);
    for (const [k, v] of Object.entries(keep)) u.searchParams.set(k, v);
    window.history.replaceState(null, "", u);
  }, [dateFrom, dateTo, payment, q, page]);

  const load = useCallback(() => {
    setLoading(true);
    // ⚠️ SERVER sahifalash — hammasini olib klientda kesmaymiz (ro'yxat cheksiz o'sadi)
    api.catalogSales(buildSalesQuery({ dateFrom, dateTo, payment, search: q, page, pageSize: SALES_PAGE_SIZE }))
      .then((d) => { setData(d); setErr(""); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, payment, q, page]);
  useEffect(() => { load(); }, [load]);

  const t = totalsView(data?.totals);
  const rows = data?.results ?? [];
  const pages = salesPageCount(data?.count ?? 0, SALES_PAGE_SIZE);
  const filtered = !!(dateFrom || dateTo || payment || q);
  // ⚠️ «Filial» ustuni: filial foydalanuvchisida BITTA takrorlanuvchi qiymat bo'lgani
  // uchun chizilmaydi (Hisob-kitobdagi qoida bilan bir xil). Asosiy foydalanuvchida ham
  // faqat haqiqatan bir nechta filial ko'rinsa chiziladi.
  const branchCount = useMemo(() => new Set(rows.map((r) => r.branch_name).filter(Boolean)).size, [rows]);
  const showBranch = !branchUser && branchCount > 1;

  return (
    <div>
      {/* JAMILAR — server bergani AYNAN; BUTUN FILTR bo'yicha (ochiq sahifa emas) */}
      <div className="mb-3 rounded-[16px] border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-2">
            <Receipt size={16} strokeWidth={1.9} style={{ color: "var(--primary)" }} />
            <span className="text-[13px] font-extrabold">Sotuvlar bo&apos;yicha</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 text-[13px] font-bold tabular-nums">
            <span>{t.count} ta</span>
            <span style={{ color: "var(--muted)" }}>·</span>
            <span>{t.quantity} dona</span>
            <span style={{ color: "var(--muted)" }}>·</span>
            <span style={{ color: "var(--acc)" }}>{fmt(t.revenue)}</span>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>
          <span>naqd <b className="tabular-nums">{fmt(t.cash)}</b></span>
          <span>karta <b className="tabular-nums">{fmt(t.card)}</b></span>
          <span>qarz <b className="tabular-nums">{fmt(t.debt)}</b></span>
          {t.delivery > 0 && (
            <>
              <span>dastafka <b className="tabular-nums">{fmt(t.delivery)}</b></span>
              <span>kassaga tushgan <b className="tabular-nums">{fmt(t.received)}</b></span>
            </>
          )}
          {t.discount > 0 && <span style={{ color: "var(--warning-ink, #8a6d1f)" }}>chegirma <b className="tabular-nums">{fmt(t.discount)}</b></span>}
          {/* ⚠️ Sahifalash jamilarni O'ZGARTIRMAYDI — buni ochiq aytamiz */}
          <span style={{ color: "var(--muted)" }}>
            — {filtered ? "tanlangan filtr" : "butun davr"} bo&apos;yicha, ochiq sahifa emas
          </span>
        </div>
        {/* ⚠️ Uchinchi «savdo raqami» tug'ilmasin — farqi AYNAN nima ekanini aytamiz */}
        <p className="mt-2 flex items-start gap-1.5 border-t pt-2 text-[11px] leading-relaxed" style={{ borderColor: "var(--line2, var(--border))", color: "var(--muted)" }}>
          <Info size={12} strokeWidth={2} className="mt-px shrink-0" />
          <span>
            Bu ro&apos;yxat <b>o&apos;z filialingiz</b> sotuvlarini ko&apos;rsatadi; tannarx va foyda bu yerda yo&apos;q.
            Tannarx, sof foyda va filiallar ajratmasi uchun — <Link href="/hisob-kitob" className="font-bold underline underline-offset-2" style={{ color: "var(--primary)" }}>Hisob-kitob</Link>.
          </span>
        </p>
      </div>

      {/* FILTRLAR — hammasi SERVERDA, bir-birini o'chirmaydi */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-[150px]"><DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} placeholder="Sanadan" ariaLabel="Sanadan" /></div>
        <div className="w-[150px]"><DatePicker value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} placeholder="Sanagacha" ariaLabel="Sanagacha" /></div>
        <FilterSelect value={payment} label="To'lov" onChange={(v) => { setPayment(v); setPage(1); }} options={PAYMENT_FILTERS} />
        <SearchInput value={search} onChange={setSearch} placeholder="Katalog nomi bo'yicha…" ariaLabel="Sotuv qidirish" />
        {filtered && (
          <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setPayment(""); setSearch(""); setQ(""); setPage(1); }}
            className="text-[12px] font-bold underline underline-offset-2" style={{ color: "var(--primary)" }}>Tozalash</button>
        )}
      </div>

      {/* ⚠️ JONLI TEKSHIRUV: server `?payment_type=mixed` ni TANIMAYDI va filtrsiz
          hammasini qaytaradi (abrakadabra bilan bir xil). Jimgina «hammasi aralash»
          bo'lib ko'rinmasin — ochiq aytamiz. LIST 2. */}
      {payment === "mixed" && rows.length > 0 && rows.some((r) => r.payment_type !== "mixed") && (
        <p className="mb-3 rounded-[11px] px-3 py-2 text-[12px] font-semibold" style={{ background: "color-mix(in srgb, #b3873a 12%, transparent)", color: "var(--warning-ink, #8a6d1f)" }}>
          ⚠️ Server «aralash» filtrini qo&apos;llamadi — quyida BARCHA sotuvlar va butun davr jamilari ko&apos;rsatilyapti.
          Aralash sotuvlar to&apos;lov ustunidan bilinadi.
        </p>
      )}
      {err && <p className="mb-3 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

      {loading ? <FlowerLoader /> : rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Bu filtr bo'yicha sotuv yo'q" : "Hali sotuv yo'q"}
          sub={filtered ? "Sana oralig'ini kengaytiring yoki to'lov turini «hammasi» qiling." : "Katalogdan biror mahsulot sotilsa — bitta dona bo'lsa ham — shu yerda paydo bo'ladi."}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[16px] border" style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="px-3 py-2.5 font-semibold">Vaqt</th>
                  <th className="px-2 py-2.5 font-semibold">Katalog</th>
                  {showBranch && <th className="px-2 py-2.5 font-semibold">Filial</th>}
                  <th className="px-2 py-2.5 text-right font-semibold">Dona</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Summa</th>
                  <th className="px-2 py-2.5 font-semibold">To&apos;lov</th>
                  <th className="px-2 py-2.5 font-semibold">Hajm</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = discountView(r);
                  return (
                    <tr key={r.id} onClick={() => onOpenItem(r.catalog_item)}
                      className="cursor-pointer border-t transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--line2)" }}>
                      {/* ⚠️ created_at MAHALLIY (+05:00) — o'girilmaydi, satrdan AYNAN o'qiladi */}
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums" style={{ color: "var(--text-2)" }}>{fmtLocalTime(r.created_at)}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          {/* rasm BO'LMASLIGI mumkin — qator bo'shatilmaydi */}
                          {r.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image_url} alt="" className="h-8 w-8 shrink-0 rounded-[8px] object-cover" style={{ background: "var(--surface-2)" }} />
                          ) : (
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px]" style={{ background: "var(--surface-2)" }} aria-hidden>
                              <Receipt size={12} strokeWidth={1.9} style={{ color: "var(--muted)" }} />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate font-bold">{r.catalog_name}</span>
                            <span className="block truncate text-[11px]" style={{ color: "var(--muted)" }}>
                              {[r.florist_name, r.sold_by].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </span>
                          {r.sale_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.sale_image_url} alt="Sotuv rasmi" title="Sotuvda yuklangan rasm"
                              onClick={(e) => { e.stopPropagation(); window.open(r.sale_image_url, "_blank", "noopener"); }}
                              className="h-8 w-8 shrink-0 rounded-[8px] object-cover ring-1" style={{ background: "var(--surface-2)", boxShadow: "0 0 0 1px var(--acc)" }} />
                          ) : null}
                        </div>
                      </td>
                      {showBranch && <td className="px-2 py-2.5" style={{ color: "var(--text-2)" }}>{r.branch_name || "—"}</td>}
                      <td className="px-2 py-2.5 text-right tabular-nums">{r.quantity}</td>
                      <td className="px-2 py-2.5 text-right">
                        {d.listed != null ? (
                          <>
                            <span className="mr-1.5 line-through opacity-60 tabular-nums" style={{ color: "var(--muted)" }}>{fmt(d.listed)}</span>
                            <b className="tabular-nums">{fmt(d.sold)}</b>
                            {d.reason && <div className="text-[11px] italic" style={{ color: "var(--muted)" }}>«{d.reason}»</div>}
                          </>
                        ) : <b className="tabular-nums">{fmt(d.sold)}</b>}
                        {/* ⚠️ DASTAFKA summaning ICHIDA (2026-08-04 qoidasi) — QO'SHILMAYDI, AYRILADI.
                            Faqat > 0 bo'lganda chiziladi; aksariyat qator toza qoladi. */}
                        {(() => { const dv = deliveryRowView(r); return dv.hasDelivery ? (
                          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                            shundan {fmt(dv.delivery)} dastafka → tovar <b style={{ color: "var(--text-2)" }}>{fmt(dv.goods)}</b>
                          </div>
                        ) : null; })()}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={{ background: "var(--surface-2)", color: r.payment_type === "debt" ? "var(--danger-ink)" : r.payment_type === "mixed" ? "var(--acc)" : "var(--text-2)" }}>
                          {paymentBreakdownLabel(r.payment_label, r.payment_breakdown)}
                        </span>
                      </td>
                      <td className="px-2 py-2.5" style={{ color: "var(--text-2)" }}>{r.volume_label || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* SERVER sahifalash */}
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="flex items-center gap-1 rounded-[11px] border-[1.5px] px-3 py-1.5 text-[12px] font-bold disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
                <ChevronLeft size={13} /> Oldingi
              </button>
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--muted)" }}>{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => Math.min(p + 1, pages))}
                className="flex items-center gap-1 rounded-[11px] border-[1.5px] px-3 py-1.5 text-[12px] font-bold disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
                Keyingi <ChevronRight size={13} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
