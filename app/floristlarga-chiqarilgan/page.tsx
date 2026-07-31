"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HandHelping, PackagePlus, RotateCcw, Trash2, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore, usePerm } from "@/lib/store";
import FlowerLoader from "@/components/FlowerLoader";
import EmptyState from "@/components/EmptyState";
import Select from "@/components/Select";
import FilterSelect from "@/components/FilterSelect";
import DualQtyInput, { type QtyMode } from "@/components/DualQtyInput";
import StockLine, { lineFromBatchDetail, lineFromStockBatch } from "@/components/StockLine";
import FloristStockReturnDrawer from "@/components/FloristStockReturnDrawer";
import { fmt, fmtDate, fmtTime } from "@/lib/format";
import { formatStemsAndBunches, stems as stemsFmt } from "@/lib/inventory";
import type { FloristProfile, FloristStockBalance, FloristStockIssue, StockBatch } from "@/lib/types";

const floristName = (fp?: FloristProfile | null): string =>
  fp ? [fp.user_detail?.first_name, fp.user_detail?.last_name].filter(Boolean).join(" ") || fp.user_detail?.username || `#${fp.id}` : "—";

const dayKey = (iso: string) => (iso || "").slice(0, 10);
const KIND_HUE: Record<string, string> = { issue: "var(--primary)", return: "var(--success-ink, #3d8a5f)", waste: "var(--danger-ink)" };

export default function FloristStockIssuePage() {
  const { showToast, user } = useStore();
  const { canView } = usePerm();
  const allowed = canView("inventory");
  // FLORIST-role — faqat o'z yozuvlari (admin zonalari ko'rsatilmaydi)
  const role = user?.profile.role;
  const isFlorist = role === "florist" || role === "apprentice";

  const [myFloristId, setMyFloristId] = useState<number | null>(null);
  const [balances, setBalances] = useState<FloristStockBalance[] | null>(null);
  const [onlyAvail, setOnlyAvail] = useState(true);
  const [issues, setIssues] = useState<FloristStockIssue[] | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [florists, setFlorists] = useState<FloristProfile[]>([]);

  // issue form
  const [fFlorist, setFFlorist] = useState(0);
  const [fBatch, setFBatch] = useState(0);
  const [fMode, setFMode] = useState<QtyMode>("stems");
  const [fQty, setFQty] = useState("");
  const [fReason, setFReason] = useState("");
  const [issuing, setIssuing] = useState(false);

  // history filters
  const [hFlorist, setHFlorist] = useState("");
  const [hKind, setHKind] = useState("");
  // return/waste drawer
  const [returnTarget, setReturnTarget] = useState<{ balance: FloristStockBalance; kind: "return" | "waste" } | null>(null);

  useEffect(() => {
    if (isFlorist) api.floristMe().then((f) => setMyFloristId(f.id)).catch(() => setMyFloristId(null));
  }, [isFlorist]);

  // ?florist=<id> — composer «Floristga gul chiqarish» yorlig'idan oldindan tanlash
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fid = Number(new URLSearchParams(window.location.search).get("florist"));
    if (fid) setFFlorist(fid);
  }, []);

  const loadBalances = useCallback(() => {
    api.floristStockBalances({ only_available: onlyAvail ? undefined : "false", ordering: "florist" })
      .then(setBalances).catch(() => setBalances([]));
  }, [onlyAvail]);
  const loadIssues = useCallback(() => {
    api.floristStockIssues({ ordering: "-created_at", florist: hFlorist || undefined, page_size: 200 })
      .then(setIssues).catch(() => setIssues([]));
  }, [hFlorist]);

  useEffect(() => { loadBalances(); }, [loadBalances]);
  useEffect(() => { loadIssues(); }, [loadIssues]);
  useEffect(() => {
    if (isFlorist) return; // florist issue forma/ro'yxatlarini ko'rmaydi
    api.stockBatches({ is_active: true }).then((bs) => setBatches(bs.filter((b) => b.remaining_stems > 0))).catch(() => {});
    api.florists({ is_active: true, ordering: "user" }).then(setFlorists).catch(() => {});
  }, [isFlorist]);

  // florist-role — hamma narsani O'Z id'siga cheklaymiz
  const scopedBalances = useMemo(() => {
    if (!balances) return null;
    return isFlorist && myFloristId ? balances.filter((b) => b.florist === myFloristId) : balances;
  }, [balances, isFlorist, myFloristId]);
  const scopedIssues = useMemo(() => {
    if (!issues) return null;
    let xs = isFlorist && myFloristId ? issues.filter((i) => i.florist === myFloristId) : issues;
    if (hKind) xs = xs.filter((i) => i.kind === hKind);
    return xs;
  }, [issues, isFlorist, myFloristId, hKind]);

  const selBatch = batches.find((b) => b.id === fBatch);
  const spb = selBatch?.stems_per_bunch || 1;
  const fStems = fMode === "bunches" ? Math.round((parseFloat(fQty) || 0) * spb) : Math.round(parseFloat(fQty) || 0);
  const fOver = selBatch ? fStems > selBatch.remaining_stems : false;

  const submitIssue = async () => {
    if (!fFlorist) return showToast("Floristni tanlang");
    if (!fBatch) return showToast("Partiyani tanlang");
    if (fStems <= 0) return showToast("Miqdorni kiriting");
    if (fOver) return showToast(`Skladda atigi ${formatStemsAndBunches(selBatch!.remaining_stems, spb)} bor`);
    setIssuing(true);
    try {
      await api.floristStockIssue({ florist: fFlorist, batch: fBatch, quantity_stems: fStems, reason: fReason.trim() || undefined });
      showToast(`✓ ${fStems} dona chiqarildi`);
      setFQty(""); setFReason("");
      // ⚠️ issue javobida stems_per_bunch yo'q — balanslarni QAYTA yuklaymiz
      loadBalances(); loadIssues();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Chiqarib bo'lmadi");
    } finally {
      setIssuing(false);
    }
  };

  // header chiplari (admin ko'rinishi) — faqat qoldig'i bor qatorlardan
  const chips = useMemo(() => {
    const rows = (scopedBalances ?? []).filter((b) => b.remaining_stems > 0);
    const florSet = new Set(rows.map((b) => b.florist));
    const stems = rows.reduce((s, b) => s + b.remaining_stems, 0);
    const value = rows.reduce((s, b) => s + b.remaining_stems * (+b.batch_detail.cost_per_stem || 0), 0);
    return { florists: florSet.size, stems, value };
  }, [scopedBalances]);

  // balanslar — florist bo'yicha guruh
  const groupedBalances = useMemo(() => {
    const m = new Map<number, { name: string; rows: FloristStockBalance[] }>();
    for (const b of scopedBalances ?? []) {
      const g = m.get(b.florist) ?? { name: b.florist_name, rows: [] };
      g.rows.push(b); m.set(b.florist, g);
    }
    return Array.from(m.entries());
  }, [scopedBalances]);

  // tarix — kun bo'yicha guruh + summary
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
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><HandHelping size={18} strokeWidth={2} /></span>
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight">Floristlarga chiqarilgan gullar</h1>
          <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Gul avval floristga chiqariladi, keyin katalog uning qo&apos;lidagi guldan yasaladi.</p>
        </div>
      </div>

      {/* header chiplari — admin ko'rinishi */}
      {!isFlorist && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Chip icon={<Users size={16} strokeWidth={2} />} label="Gul ushlab turgan floristlar" value={String(chips.florists)} />
          <Chip icon={<PackagePlus size={16} strokeWidth={2} />} label="Jami chiqarilgan (qoldiq)" value={stemsFmt(chips.stems)} />
          <Chip icon={<HandHelping size={16} strokeWidth={2} />} label="Tannarx bo'yicha qiymati" value={fmt(chips.value)} />
        </div>
      )}

      {/* ISSUE FORM — admin (florist o'ziga chiqara olmaydi) */}
      {!isFlorist && (
        <section className="glass !rounded-[18px] p-5">
          <h2 className="mb-3 text-[15px] font-bold tracking-tight">Skladdan chiqarish</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>Florist</div>
              <Select value={fFlorist} onChange={(v) => setFFlorist(+v)} placeholder="Floristni tanlang"
                options={florists.map((fp) => ({ value: fp.id, label: floristName(fp) }))} searchable />
            </div>
            <div>
              <div className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>Partiya (skladdan)</div>
              <Select value={fBatch} onChange={(v) => { setFBatch(+v); setFQty(""); }} placeholder="Gulni tanlang" searchable
                options={[...batches].sort((a, b) => `${a.variant_detail?.flower_detail?.name_uz}`.localeCompare(`${b.variant_detail?.flower_detail?.name_uz}`)).map((b) => ({
                  value: b.id,
                  label: `${b.variant_detail?.flower_detail?.name_uz ?? ""} ${b.variant_detail?.name_uz ?? ""}${b.variant_detail?.color_uz ? ` · ${b.variant_detail.color_uz}` : ""}`,
                  sub: `№${b.batch_number} · ${formatStemsAndBunches(b.remaining_stems, b.stems_per_bunch)}`,
                }))} />
            </div>
          </div>

          {/* tanlangan partiya — balanslar bilan BIR XIL qator grammatikasi */}
          {selBatch && (
            <div className="mt-3 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
              <StockLine data={lineFromStockBatch(selBatch)} right={<span className="text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{formatStemsAndBunches(selBatch.remaining_stems, spb)}</span>} />
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <DualQtyInput mode={fMode} value={fQty} stemsPerBunch={spb} onMode={setFMode} onValue={setFQty} label="Soni" />
            <div>
              <div className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>Izoh (ixtiyoriy)</div>
              <input className="inp" value={fReason} onChange={(e) => setFReason(e.target.value)} placeholder="Masalan: Ertangi buketlar uchun" />
            </div>
          </div>

          {selBatch && fStems > 0 && (
            <div className="mt-3 rounded-[12px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: fOver ? "var(--danger-soft, rgba(160,74,74,.12))" : "var(--surface-2)", color: fOver ? "var(--danger-ink)" : "var(--text-2)" }}>
              {fOver ? `Skladda atigi ${formatStemsAndBunches(selBatch.remaining_stems, spb)} bor`
                : <>Qoldiq: {selBatch.remaining_stems.toLocaleString("ru")} → <b style={{ color: "var(--primary)" }}>{(selBatch.remaining_stems - fStems).toLocaleString("ru")}</b> dona</>}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button onClick={submitIssue} disabled={issuing || fOver || fStems <= 0 || !fFlorist} className="btn-primary disabled:opacity-60">
              {issuing ? "Chiqarilmoqda…" : "Chiqarish"}
            </button>
          </div>
        </section>
      )}

      {/* BALANSLAR */}
      <section className="glass !rounded-[18px] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold tracking-tight">{isFlorist ? "Mening qoldig'im" : "Kimda qancha gul bor"}</h2>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
            <input type="checkbox" checked={!onlyAvail} onChange={(e) => setOnlyAvail(!e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Nol qoldiqlarni ham ko&apos;rsatish
          </label>
        </div>
        {groupedBalances.length === 0 ? (
          <EmptyState title="Hozircha gul chiqarilmagan" sub={isFlorist ? "Sizga gul chiqarilganda shu yerda ko'rinadi." : "Yuqoridagi forma orqali floristga gul chiqaring."} />
        ) : (
          <div className="flex flex-col gap-4">
            {groupedBalances.map(([fid, g]) => (
              <div key={fid}>
                {!isFlorist && <div className="mb-2 text-[13px] font-bold" style={{ color: "var(--primary)" }}>{g.name}</div>}
                <div className="flex flex-col gap-2">
                  {g.rows.map((b) => {
                    const bd = b.batch_detail;
                    const spbb = bd.stems_per_bunch || 1;
                    const val = b.remaining_stems * (+bd.cost_per_stem || 0);
                    return (
                      <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)", opacity: b.remaining_stems === 0 ? 0.6 : 1 }}>
                        <div className="min-w-[200px] flex-1">
                          <StockLine data={lineFromBatchDetail(bd)} right={
                            <div>
                              <div className="text-[13px] font-bold tabular-nums">{formatStemsAndBunches(b.remaining_stems, spbb)}</div>
                              <div className="text-[11px]" style={{ color: "var(--muted)" }}>{fmt(val)}</div>
                            </div>
                          } />
                        </div>
                        {!isFlorist && b.remaining_stems > 0 && (
                          <div className="flex shrink-0 gap-2">
                            <button onClick={() => setReturnTarget({ balance: b, kind: "return" })} className="flex items-center gap-1.5 rounded-[11px] border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--success-ink, #3d8a5f)" }}><RotateCcw size={13} strokeWidth={2.2} /> Qaytarish</button>
                            <button onClick={() => setReturnTarget({ balance: b, kind: "waste" })} className="flex items-center gap-1.5 rounded-[11px] border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--danger-ink)" }}><Trash2 size={13} strokeWidth={2.2} /> Chiqit</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* TARIX */}
      <section className="glass !rounded-[18px] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold tracking-tight">Tarix</h2>
          <div className="flex flex-wrap gap-2">
            {!isFlorist && <FilterSelect value={hFlorist} onChange={setHFlorist} label="Florist" options={[{ value: "", label: "Barcha floristlar" }, ...florists.map((fp) => ({ value: String(fp.id), label: floristName(fp) }))]} />}
            <FilterSelect value={hKind} onChange={setHKind} label="Turi" options={[{ value: "", label: "Barchasi" }, { value: "issue", label: "Chiqarilgan" }, { value: "return", label: "Qaytarilgan" }, { value: "waste", label: "Chiqit" }]} />
          </div>
        </div>
        {/* summary strip */}
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

      {returnTarget && (
        <FloristStockReturnDrawer
          balance={returnTarget.balance}
          initialKind={returnTarget.kind}
          onClose={() => setReturnTarget(null)}
          onDone={() => { loadBalances(); loadIssues(); }}
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
