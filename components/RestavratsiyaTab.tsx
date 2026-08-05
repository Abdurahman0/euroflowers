"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Recycle, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { fmt, fmtLocalTime } from "@/lib/format";
import FilterSelect from "./FilterSelect";
import EmptyState from "./EmptyState";
import FlowerLoader from "./FlowerLoader";
import { stems } from "@/lib/inventory";
import type { CatalogRework, FloristProfile, Paginated } from "@/lib/types";

const PAGE_SIZE = 20;

/** ⚠️ Server qabul qiladigan tartiblar (jonli OpenAPI): -created_at (sukut),
    florist_amount, input_stems, output_stems. Boshqasi YUBORILMAYDI. */
const ORDER_OPTS = [
  { value: "-created_at", label: "Yangi birinchi" },
  { value: "created_at", label: "Eski birinchi" },
  { value: "-florist_amount", label: "Florist haqi (ko'p)" },
  { value: "-input_stems", label: "Kirim (ko'p)" },
  { value: "-output_stems", label: "Chiqim (ko'p)" },
];

const floristLabel = (fl: FloristProfile): string => {
  const u = fl.user_detail;
  return [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.username || `#${fl.id}`;
};

/**
 * RESTAVRATSIYA TARIXI — Katalog sahifasining uchinchi tabi (GET /api/catalog-reworks/).
 *
 * ⚠️ QAYTMAS HUJJATLAR — OpenAPI'da `{id}/` FAQAT GET (PATCH/DELETE YO'Q). Bu yerda
 * ko'rinadigan hech narsani bekor qilib bo'lmaydi; shuning uchun ro'yxat «tarix» —
 * tahrirlash amali ATAYIN chizilmagan.
 *
 * ⚠️ `waste_stems`/`waste_cost` — HAQIQIY yo'qotish, lekin sklad CHIQIT harakati
 * yaratilmaydi (LIST 2: hisobotdagi «chiqit» bu raqamni KO'RMAYDI). Shu bois
 * hujjatda ko'zga tashlanadigan qilib chiqariladi.
 */
export default function RestavratsiyaTab({ onOpenItem }: { onOpenItem: (catalogItemId: number) => void }) {
  const [data, setData] = useState<Paginated<CatalogRework> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  const [florist, setFlorist] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => { api.florists().then(setFlorists).catch(() => {}); }, []);

  // URL'dan o'qish (chuqur havola) — bir marta
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const f = p.get("florist"); if (f) setFlorist(f);
    const o = p.get("ordering"); if (o && ORDER_OPTS.some((x) => x.value === o)) setOrdering(o);
    const pg = Number(p.get("page")); if (pg > 1) setPage(pg);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    u.searchParams.set("tab", "restavratsiya");
    for (const k of ["florist", "ordering", "page"]) u.searchParams.delete(k);
    if (florist) u.searchParams.set("florist", florist);
    if (ordering !== "-created_at") u.searchParams.set("ordering", ordering);
    if (page > 1) u.searchParams.set("page", String(page));
    window.history.replaceState(null, "", u);
  }, [florist, ordering, page]);

  const load = useCallback(() => {
    setLoading(true);
    api.catalogReworks({ page, page_size: PAGE_SIZE, ordering, florist: florist || undefined })
      .then((d) => { setData(d); setErr(""); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [page, ordering, florist]);
  useEffect(() => { load(); }, [load]);

  const rows = data?.results ?? [];
  const pages = Math.max(Math.ceil((data?.count ?? 0) / PAGE_SIZE), 1);
  const filtered = !!florist;
  const floristOpts = useMemo(
    () => [{ value: "", label: "Barcha floristlar" }, ...florists.map((fl) => ({ value: String(fl.id), label: floristLabel(fl) }))],
    [florists]
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="note-chip text-[13.5px]" style={{ color: "var(--mut)" }}>
          Restavratsiya tarixi ({data?.count ?? 0}) — buzilgan mahsulot va undan yasalganlar
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FilterSelect value={florist} options={floristOpts} onChange={(v) => { setFlorist(v); setPage(1); }} label="Florist" />
          <FilterSelect value={ordering} options={ORDER_OPTS} onChange={(v) => { setOrdering(v); setPage(1); }} label="Tartib" />
          {filtered && (
            <button type="button" onClick={() => { setFlorist(""); setPage(1); }} className="text-[12px] font-bold underline underline-offset-2" style={{ color: "var(--primary)" }}>Tozalash</button>
          )}
        </div>
      </div>

      {err && <p className="mb-3 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

      {loading ? <FlowerLoader /> : rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Bu florist bo'yicha restavratsiya yo'q" : "Hali restavratsiya yo'q"}
          sub={filtered ? "Filtrni «Barcha floristlar» qiling." : "Sotilmay qolgan buket buzilib, undan yangi mahsulot yasalsa — shu yerda paydo bo'ladi."}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {rows.map((r) => {
              const isOpen = open === r.id;
              return (
                <article key={r.id} className="glass overflow-hidden !rounded-[18px]">
                  <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5 text-left transition-colors duration-150 hover:bg-[var(--hover)]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                      <Recycle size={17} strokeWidth={1.85} />
                    </span>
                    <span className="min-w-[150px] flex-1">
                      <span className="block text-[13.5px] font-bold">
                        {r.outputs.map((o) => o.catalog_item_name).filter(Boolean).join(" · ") || `Restavratsiya #${r.id}`}
                      </span>
                      <span className="block text-[12px]" style={{ color: "var(--muted)" }}>
                        {/* ⚠️ +05:00 — satrdan AYNAN o'qiladi, mintaqa o'girilmaydi */}
                        {fmtLocalTime(r.created_at)}
                        {r.florist_name ? ` · ${r.florist_name}` : ""}
                        {r.created_by_name ? ` · ${r.created_by_name}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-semibold tabular-nums">
                      <span title="Kirim">↓ {stems(r.input_stems)}</span>
                      <span title="Chiqim" style={{ color: "var(--acc)" }}>↑ {stems(r.output_stems)}</span>
                      {r.waste_stems > 0 && (
                        <span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ background: "color-mix(in srgb, var(--danger-ink) 12%, transparent)", color: "var(--danger-ink)" }}>
                          Yo&apos;qotish {r.waste_stems} dona
                        </span>
                      )}
                      {+(r.florist_amount ?? 0) > 0 && <span style={{ color: "var(--primary)" }}>{fmt(r.florist_amount)}</span>}
                    </span>
                    <ChevronDown size={16} strokeWidth={2} className="shrink-0 transition-transform" style={{ transform: isOpen ? undefined : "rotate(-90deg)", color: "var(--muted)" }} />
                  </button>

                  {isOpen && (
                    <div className="border-t px-3.5 pb-3.5 pt-3" style={{ borderColor: "var(--border)" }}>
                      {/* ⚠️ YO'QOTISH — hujjatning ASOSIY raqami; sklad chiqitiga TUSHMAYDI */}
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[13px] border px-3.5 py-2.5"
                        style={{ borderColor: r.waste_stems > 0 ? "color-mix(in srgb, var(--danger-ink) 35%, var(--border))" : "var(--border)", background: "var(--surface-2)" }}>
                        <span className="flex items-center gap-1.5 text-[12.5px] font-bold">
                          {r.waste_stems > 0 && <TriangleAlert size={14} strokeWidth={2} style={{ color: "var(--danger-ink)" }} />}
                          Yo&apos;qotish: <b style={{ color: r.waste_stems > 0 ? "var(--danger-ink)" : "var(--text-2)" }}>{r.waste_stems} dona · {fmt(r.waste_cost)}</b>
                        </span>
                        <span className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
                          Kirim {r.input_stems} dona · {fmt(r.input_cost)} → chiqim {r.output_stems} dona
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        {/* BUZILGAN */}
                        <Block title="Buzilgan mahsulot">
                          {r.sources.length === 0 && <Muted>Yo&apos;q — faqat skladdan olingan.</Muted>}
                          {r.sources.map((s) => (
                            <Row key={s.id ?? s.catalog_item} onClick={() => onOpenItem(s.catalog_item)}
                              title={`${s.catalog_item_name ?? `#${s.catalog_item}`} × ${s.quantity}`}
                              sub={`${s.stems ?? 0} dona`} right={fmt(s.cost)} />
                          ))}
                        </Block>

                        {/* SKLADDAN */}
                        <Block title="Skladdan qo'shimcha">
                          {r.stock_inputs.length === 0 && <Muted>Yo&apos;q — sklad kamaymagan.</Muted>}
                          {r.stock_inputs.map((si) => (
                            <Row key={si.id ?? si.stock_batch}
                              title={si.variant_name || si.batch_number || `Partiya #${si.stock_batch}`}
                              sub={`${si.batch_number ?? ""} · ${si.quantity_stems} dona`} right={fmt(si.cost)} />
                          ))}
                        </Block>

                        {/* YANGI */}
                        <Block title="Yangi mahsulotlar">
                          {r.outputs.map((o) => (
                            <Row key={o.id ?? o.catalog_item}
                              onClick={o.catalog_item ? () => onOpenItem(o.catalog_item as number) : undefined}
                              title={`${o.catalog_item_name ?? `#${o.catalog_item}`} × ${o.quantity}`}
                              sub={`${o.stems ?? 0} dona · narx ${fmt(o.catalog_item_price)}`}
                              right={fmt(o.allocated_cost)}
                              // ⚠️ Har mahsulotga tegishli florist haqi ULUSHI — server taqsimlaydi
                              rightSub={+(o.allocated_florist_amount ?? 0) > 0 ? `haq ${fmt(o.allocated_florist_amount)}` : undefined} />
                          ))}
                        </Block>
                      </div>

                      {r.note && (
                        <p className="mt-3 rounded-[12px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>{r.note}</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {pages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="icon-btn !h-8 !w-8 disabled:opacity-40" aria-label="Oldingi"><ChevronLeft size={15} strokeWidth={2} /></button>
              <span className="text-[12.5px] font-bold tabular-nums">{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="icon-btn !h-8 !w-8 disabled:opacity-40" aria-label="Keyingi"><ChevronRight size={15} strokeWidth={2} /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{title}</div>
    <div className="flex flex-col gap-1">{children}</div>
  </div>
);

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px]" style={{ color: "var(--muted)" }}>{children}</p>
);

const Row = ({ title, sub, right, rightSub, onClick }: { title: string; sub?: string; right?: string; rightSub?: string; onClick?: () => void }) => {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold">{title}</span>
        {sub && <span className="block truncate text-[11.5px]" style={{ color: "var(--muted)" }}>{sub}</span>}
      </span>
      {right && (
        <span className="shrink-0 text-right">
          <span className="block text-[12px] font-bold tabular-nums" style={{ color: "var(--acc)" }}>{right}</span>
          {rightSub && <span className="block text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>{rightSub}</span>}
        </span>
      )}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex items-start gap-2 rounded-[9px] px-1 py-0.5 text-left transition-colors duration-150 hover:bg-[var(--hover)]">{inner}</button>
  ) : (
    <span className="flex items-start gap-2 px-1 py-0.5">{inner}</span>
  );
};
