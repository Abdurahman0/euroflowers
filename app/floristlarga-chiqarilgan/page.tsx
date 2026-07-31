"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HandHelping, PackagePlus, Plus, RotateCcw, Scale, Trash2, Users } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { useStore, usePerm } from "@/lib/store";
import FlowerLoader from "@/components/FlowerLoader";
import EmptyState from "@/components/EmptyState";
import FilterSelect from "@/components/FilterSelect";
import StockLine, { lineFromBatchDetail } from "@/components/StockLine";
import FloristStockReturnDrawer from "@/components/FloristStockReturnDrawer";
import FloristStockIssueModal from "@/components/FloristStockIssueModal";
import FloristStockAdjustModal from "@/components/FloristStockAdjustModal";
import { fmt, fmtDate, fmtTime } from "@/lib/format";
import { formatStemsAndBunches, stems as stemsFmt } from "@/lib/inventory";
import type { FloristProfile, FloristStockBalance, FloristStockIssue, StockBatch } from "@/lib/types";

const floristName = (fp?: FloristProfile | null): string =>
  fp ? [fp.user_detail?.first_name, fp.user_detail?.last_name].filter(Boolean).join(" ") || fp.user_detail?.username || `#${fp.id}` : "—";

const dayKey = (iso: string) => (iso || "").slice(0, 10);
const KIND_HUE: Record<string, string> = { issue: "var(--primary)", return: "var(--success-ink, #3d8a5f)", waste: "var(--danger-ink)" };
// ikki bo'lim — chip-almashtirish (app/floristlar/page.tsx pattern'idan nusxalandi)
const TAB_LABEL = { balanslar: "Kimda qancha gul bor", tarix: "Tarix" } as const;
type Tab = keyof typeof TAB_LABEL;

export default function FloristStockIssuePage() {
  const { showToast, user } = useStore();
  const { canView, canControl } = usePerm();
  const allowed = canView("inventory");
  // ADJUST (hisobni to'g'rilash) — BOSHQARISH huquqi kerak (nafaqat ko'rish).
  // View-only foydalanuvchi balanslarni ko'radi, lekin tugmalar chiqmaydi.
  const canManage = canControl("inventory");
  const role = user?.profile.role;
  const isFlorist = role === "florist" || role === "apprentice";

  const [myFloristId, setMyFloristId] = useState<number | null>(null);
  const [balances, setBalances] = useState<FloristStockBalance[] | null>(null);
  const [onlyAvail, setOnlyAvail] = useState(true);
  const [issues, setIssues] = useState<FloristStockIssue[] | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [florists, setFlorists] = useState<FloristProfile[]>([]);

  // chiqarish MODALI (inline forma o'rniga) + ?florist= deep link uchun prefill
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueFlorist, setIssueFlorist] = useState(0);
  // TAB — ?tab= URL'da saqlanadi (refresh/ulashilgan link o'sha ko'rinishga tushadi)
  const [tab, setTab] = useState<Tab>("balanslar");

  const [hFlorist, setHFlorist] = useState("");
  const [hKind, setHKind] = useState("");
  const [returnTarget, setReturnTarget] = useState<{ balance: FloristStockBalance; kind: "return" | "waste" } | null>(null);
  // HISOBNI TO'G'RILASH modali — scoped=balance (per-row, ikkala yo'nalish) yoki
  // scoped=null (per-florist, faqat to_catalog, hamma partiya)
  const [adjust, setAdjust] = useState<{ florist: number; name: string; scoped: FloristStockBalance | null; total: number } | null>(null);

  // URL o'qish: ?tab= va ?florist= (deep link modalni prefill bilan OCHADI)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const t = q.get("tab");
    if (t && t in TAB_LABEL) setTab(t as Tab);
    const fid = Number(q.get("florist"));
    if (fid && !isFlorist) { setIssueFlorist(fid); setIssueOpen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    if (typeof window !== "undefined") { const u = new URL(window.location.href); u.searchParams.set("tab", t); window.history.replaceState(null, "", u); }
  };

  useEffect(() => {
    if (isFlorist) api.floristMe().then((f) => setMyFloristId(f.id)).catch(() => setMyFloristId(null));
  }, [isFlorist]);

  const loadBalances = useCallback(() => {
    api.floristStockBalances({ only_available: onlyAvail ? undefined : "false", ordering: "florist" }).then(setBalances).catch(() => setBalances([]));
  }, [onlyAvail]);
  const loadIssues = useCallback(() => {
    api.floristStockIssues({ ordering: "-created_at", florist: hFlorist || undefined, page_size: 200 }).then(setIssues).catch(() => setIssues([]));
  }, [hFlorist]);
  useEffect(() => { loadBalances(); }, [loadBalances]);
  useEffect(() => { loadIssues(); }, [loadIssues]);

  // ADJUST muvaffaqiyatidan keyin — katalog tannarxi (SOTILGANLARNIKI ham) o'zgardi:
  //   1) invalidateReportCache() — hisobot keshi kalitlarini tozalaydi:
  //        • accounting:<from>:<to>:<branch>  (Hisob-kitob §1/§2/§4 + Analitika eksport)
  //        • stock-batches:active             (Dashboard alertlari, Analitika BatchSarfiPanel)
  //   2) ef:stock-changed — MOUNT bo'lgan hisobot sahifalari (Hisob-kitob, Sklad) qayta yuklaydi
  //   3) loadBalances/loadIssues — SHU sahifa (florist-stock-balances + issues)
  //   Katalog ro'yxati (api.catalog) — Hisob-kitob event orqali, boshqa sahifalar keyingi mount'da.
  //   (1)+(2) markazlashgan notifyReportDataChanged() ichida; (3) shu sahifa refetch'i.
  const onAdjustDone = useCallback(() => {
    notifyReportDataChanged();
    loadBalances();
    loadIssues();
  }, [loadBalances, loadIssues]);
  // florist chiqarish/qaytarish/chiqit ham sklad qoldig'i + qiymatini o'zgartiradi → hisobot
  const onStockChange = useCallback(() => {
    notifyReportDataChanged();
    loadBalances();
    loadIssues();
  }, [loadBalances, loadIssues]);
  useEffect(() => {
    if (isFlorist) return; // florist chiqarish forma/ro'yxatini ko'rmaydi
    api.stockBatches({ is_active: true }).then((bs) => setBatches(bs.filter((b) => b.remaining_stems > 0))).catch(() => {});
    api.florists({ is_active: true, ordering: "user" }).then(setFlorists).catch(() => {});
  }, [isFlorist]);

  const scopedBalances = useMemo(() => (!balances ? null : isFlorist && myFloristId ? balances.filter((b) => b.florist === myFloristId) : balances), [balances, isFlorist, myFloristId]);
  const scopedIssues = useMemo(() => {
    if (!issues) return null;
    let xs = isFlorist && myFloristId ? issues.filter((i) => i.florist === myFloristId) : issues;
    if (hKind) xs = xs.filter((i) => i.kind === hKind);
    return xs;
  }, [issues, isFlorist, myFloristId, hKind]);

  const chips = useMemo(() => {
    const rows = (scopedBalances ?? []).filter((b) => b.remaining_stems > 0);
    return { florists: new Set(rows.map((b) => b.florist)).size, stems: rows.reduce((s, b) => s + b.remaining_stems, 0), value: rows.reduce((s, b) => s + b.remaining_stems * (+(b.batch_detail?.cost_per_stem ?? 0) || 0), 0) };
  }, [scopedBalances]);
  const groupedBalances = useMemo(() => {
    const m = new Map<number, { name: string; rows: FloristStockBalance[] }>();
    for (const b of scopedBalances ?? []) { const g = m.get(b.florist) ?? { name: b.florist_name, rows: [] }; g.rows.push(b); m.set(b.florist, g); }
    return Array.from(m.entries());
  }, [scopedBalances]);
  const groupedIssues = useMemo(() => {
    const m = new Map<string, FloristStockIssue[]>();
    for (const i of scopedIssues ?? []) { const k = dayKey(i.created_at); (m.get(k) ?? m.set(k, []).get(k)!).push(i); }
    return Array.from(m.entries());
  }, [scopedIssues]);
  const summary = useMemo(() => {
    const s = { issue: 0, return: 0, waste: 0 };
    for (const i of scopedIssues ?? []) if (i.kind in s) s[i.kind as keyof typeof s] += i.quantity_stems;
    return s;
  }, [scopedIssues]);

  if (!allowed) return <div className="p-8"><EmptyState title="Ruxsat yo'q" sub="Bu sahifa «inventory» ruxsatini talab qiladi." /></div>;
  if (balances === null || issues === null) return <FlowerLoader />;

  return (
    <div className="flex flex-col gap-5">
      {/* SARLAVHA + BOSH AMAL (o'ng-yuqori, katalog sahifasi bilan bir xil joy/uslub) */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><HandHelping size={18} strokeWidth={2} /></span>
          <div>
            <h1 className="text-[18px] font-extrabold tracking-tight">Floristlarga chiqarilgan gullar</h1>
            <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Gul avval floristga chiqariladi, keyin katalog uning qo&apos;lidagi guldan yasaladi.</p>
          </div>
        </div>
        {!isFlorist && (
          <button onClick={() => { setIssueFlorist(0); setIssueOpen(true); }} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[14px]">
            <Plus size={18} strokeWidth={1.75} /> Skladdan chiqarish
          </button>
        )}
      </div>

      {/* header chiplari — BUTUN sahifani tavsiflaydi (tab ustida qoladi) */}
      {!isFlorist && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Chip icon={<Users size={16} strokeWidth={2} />} label="Gul ushlab turgan floristlar" value={String(chips.florists)} />
          <Chip icon={<PackagePlus size={16} strokeWidth={2} />} label="Jami chiqarilgan (qoldiq)" value={stemsFmt(chips.stems)} />
          <Chip icon={<HandHelping size={16} strokeWidth={2} />} label="Tannarx bo'yicha qiymati" value={fmt(chips.value)} />
        </div>
      )}

      {/* CHIPLAR — bir vaqtda bittasi (app/floristlar tab pattern'i) */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button key={t} onClick={() => switchTab(t)} aria-pressed={tab === t}
            className={clsx("rounded-full border-[1.5px] px-5 py-2 text-[13px] font-bold", tab === t ? "text-white" : "bg-sfc")}
            style={tab === t ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}>
            {isFlorist && t === "balanslar" ? "Mening qoldig'im" : TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* BALANSLAR TABI */}
      {tab === "balanslar" && (
        <section className="glass !rounded-[18px] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold tracking-tight">{isFlorist ? "Mening qoldig'im" : "Kimda qancha gul bor"}</h2>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
              <input type="checkbox" checked={!onlyAvail} onChange={(e) => setOnlyAvail(!e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              Nol qoldiqlarni ham ko&apos;rsatish
            </label>
          </div>
          {groupedBalances.length === 0 ? (
            <EmptyState title="Hozircha gul chiqarilmagan" sub={isFlorist ? "Sizga gul chiqarilganda shu yerda ko'rinadi." : "«Skladdan chiqarish» tugmasi orqali floristga gul chiqaring."} />
          ) : (
            <div className="flex flex-col gap-4">
              {groupedBalances.map(([fid, g]) => {
                const groupTotal = g.rows.reduce((s, b) => s + b.remaining_stems, 0);
                return (
                <div key={fid}>
                  {!isFlorist && (
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-[13px] font-bold" style={{ color: "var(--primary)" }}>{g.name}</div>
                      {/* PER-FLORIST: hamma partiya qoldig'i katalogga bo'linadi (faqat to_catalog) */}
                      {canManage && groupTotal > 0 && (
                        <button onClick={() => setAdjust({ florist: fid, name: g.name, scoped: null, total: groupTotal })}
                          className="flex items-center gap-1.5 rounded-[11px] border px-2.5 py-1 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
                          <Scale size={13} strokeWidth={2.2} /> Hisobni to&apos;g&apos;rilash
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {g.rows.map((b) => {
                      const bd = b.batch_detail;
                      const spbb = bd?.stems_per_bunch || 1;
                      const val = b.remaining_stems * (+(bd?.cost_per_stem ?? 0) || 0);
                      return (
                        <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)", opacity: b.remaining_stems === 0 ? 0.6 : 1 }}>
                          <div className="min-w-[200px] flex-1">
                            <StockLine data={lineFromBatchDetail(bd)} right={<div><div className="text-[13px] font-bold tabular-nums">{formatStemsAndBunches(b.remaining_stems, spbb)}</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>{fmt(val)}</div></div>} />
                          </div>
                          {!isFlorist && b.remaining_stems > 0 && (
                            <div className="flex shrink-0 flex-wrap gap-2">
                              {/* PER-BATCH: shu partiya — ikkala yo'nalish ochiq */}
                              {canManage && (
                                <button onClick={() => setAdjust({ florist: b.florist, name: b.florist_name, scoped: b, total: b.remaining_stems })} className="flex items-center gap-1.5 rounded-[11px] border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}><Scale size={13} strokeWidth={2.2} /> To&apos;g&apos;rilash</button>
                              )}
                              <button onClick={() => setReturnTarget({ balance: b, kind: "return" })} className="flex items-center gap-1.5 rounded-[11px] border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--success-ink, #3d8a5f)" }}><RotateCcw size={13} strokeWidth={2.2} /> Qaytarish</button>
                              <button onClick={() => setReturnTarget({ balance: b, kind: "waste" })} className="flex items-center gap-1.5 rounded-[11px] border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--danger-ink)" }}><Trash2 size={13} strokeWidth={2.2} /> Chiqit</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TARIX TABI — filtrlar SHU tabda (almashganda o'tib ketmaydi) */}
      {tab === "tarix" && (
        <section className="glass !rounded-[18px] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold tracking-tight">Tarix</h2>
            <div className="flex flex-wrap gap-2">
              {!isFlorist && <FilterSelect value={hFlorist} onChange={setHFlorist} label="Florist" options={[{ value: "", label: "Barcha floristlar" }, ...florists.map((fp) => ({ value: String(fp.id), label: floristName(fp) }))]} />}
              <FilterSelect value={hKind} onChange={setHKind} label="Turi" options={[{ value: "", label: "Barchasi" }, { value: "issue", label: "Chiqarilgan" }, { value: "return", label: "Qaytarilgan" }, { value: "waste", label: "Chiqit" }]} />
            </div>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {([["issue", "Chiqarilgan"], ["return", "Qaytarilgan"], ["waste", "Chiqit"]] as const).map(([k, lbl]) => (
              <div key={k} className="rounded-[12px] border px-3 py-2" style={{ borderColor: "var(--border)" }}>
                <div className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{lbl}</div>
                <div className="text-[15px] font-extrabold tabular-nums" style={{ color: KIND_HUE[k] }}>{stemsFmt(summary[k])}</div>
              </div>
            ))}
          </div>
          {groupedIssues.length === 0 ? (
            <EmptyState title="Tarix bo'sh" sub="Chiqarish, qaytarish va chiqit shu yerda ko'rinadi." />
          ) : (
            <div className="flex flex-col gap-4">
              {groupedIssues.map(([day, rows]) => (
                <div key={day}>
                  <div className="mb-1.5 text-[12px] font-bold" style={{ color: "var(--muted)" }}>{fmtDate(day)}</div>
                  <div className="flex flex-col gap-1.5">
                    {rows.map((i) => (
                      <div key={i.id} className="flex flex-wrap items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--line2)" }}>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_HUE[i.kind] ?? "var(--muted)" }} />
                        <div className="min-w-[180px] flex-1"><StockLine size="sm" data={lineFromBatchDetail(i.batch_detail)} right={<span className="text-[12.5px] font-bold tabular-nums" style={{ color: KIND_HUE[i.kind] }}>{i.quantity_stems} dona</span>} /></div>
                        <div className="flex shrink-0 items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
                          {!isFlorist && <span className="font-semibold" style={{ color: "var(--text-2)" }}>{i.florist_name}</span>}
                          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `color-mix(in srgb, ${KIND_HUE[i.kind]} 14%, transparent)`, color: KIND_HUE[i.kind] }}>{i.kind_label}</span>
                          <span>{fmtTime(i.created_at)}</span>
                        </div>
                        {i.reason && <div className="w-full truncate pl-5 text-[12px] italic" style={{ color: "var(--mut)" }} title={i.reason}>{i.reason}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {issueOpen && (
        <FloristStockIssueModal
          initialFlorist={issueFlorist}
          batches={batches}
          florists={florists}
          onClose={() => setIssueOpen(false)}
          onDone={onStockChange}
        />
      )}
      {returnTarget && (
        <FloristStockReturnDrawer balance={returnTarget.balance} initialKind={returnTarget.kind} onClose={() => setReturnTarget(null)} onDone={onStockChange} />
      )}
      {adjust && (
        <FloristStockAdjustModal
          florist={adjust.florist}
          floristName={adjust.name}
          scoped={adjust.scoped}
          totalRemaining={adjust.total}
          onClose={() => setAdjust(null)}
          onDone={onAdjustDone}
        />
      )}
    </div>
  );
}

function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-lite flex items-center gap-3 !rounded-[16px] p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{label}</div>
        <div className="text-[17px] font-extrabold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
