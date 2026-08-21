"use client";
import { useEffect, useMemo, useState } from "react";
import { Archive, History, Pencil, Plus, ShoppingCart, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { usePagedList } from "@/lib/usePagedList";
import Pagination from "@/components/Pagination";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { AccessorySellModal, MaterialModal } from "@/components/MaterialSklad";
import AccessoryDetail from "@/components/AccessoryDetail";
import { fmt, fmtDate, fmtTime } from "@/lib/format";
import type { MaterialMovement, Packaging } from "@/lib/types";

const money = (v?: string | number | null) => +(v ?? 0) > 0 ? fmt(v) : "—";


export default function AccessorySklad() {
  const showToast = useStore((s) => s.showToast); const { canControl } = usePerm(); const control = canControl("inventory");
  const [search, setSearch] = useState(""); const [q, setQ] = useState(""); const [active, setActive] = useState(true); const [edit, setEdit] = useState<Packaging | null | undefined>(undefined); const [sell, setSell] = useState<Packaging | null>(null); const [detail, setDetail] = useState<Packaging | null>(null);
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  const filters = useMemo(() => ({ packaging_type: "other", search: q || undefined, is_active: active ? true : undefined }), [q, active]);
  const list = usePagedList<Packaging>({ fetcher: (query, signal) => api.packagingPage(query, signal), filters, defaultPageSize: 50 });
  const refresh = list.refresh;
  const save = (item: Packaging) => { setEdit(undefined); refresh(); showToast("✓ Aksessuar saqlandi"); };
  if (!list.ready && list.loading) return <FlowerLoader />;
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end gap-3">
      <div><p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[2px]" style={{ color: "var(--primary)" }}><Sparkles size={14} /> Accessory sklad</p><h1 className="mt-1 text-[24px] font-extrabold tracking-tight">Aksessuarlar</h1><p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>Sovg'a mahsulotlari, qoldiq va alohida sotuvlar</p></div>
      <div className="ml-auto flex flex-wrap items-center gap-2"><input className="h-10 w-[190px] rounded-[13px] border bg-transparent px-3 text-[13px] outline-none" style={{ borderColor: "var(--border)" }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Accessory qidirish…" /><button onClick={() => setActive((x) => !x)} className="h-10 rounded-[13px] border px-3 text-[12.5px] font-bold" style={active ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-2)" }}>{active ? "Faol" : "Barchasi"}</button>{control && <button onClick={() => setEdit(null)} className="btn-primary !h-10"><Plus size={17} /> Aksessuar</button>}</div>
    </div>
    <div className="rounded-[18px] border px-4 py-2.5" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--surface-solid) 72%, transparent)" }}><Pagination info={list.info} onPage={list.setPage} alwaysShow label="aksessuar" busy={list.loading} /></div>
    {list.error && <p className="rounded-[12px] bg-peach px-3 py-2 text-[13px] font-semibold text-peachink">{list.error}</p>}
    {list.rows.length === 0 ? <EmptyState title="Aksessuar topilmadi" sub="Yangi o'yinchoq, shokolad yoki otkritka qo'shing." /> : <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))" }}>{list.rows.map((m) => <article key={m.id} className="glass card-hover flex flex-col overflow-hidden !rounded-[20px]" style={{ opacity: m.is_active ? 1 : .55 }}><div className="relative h-[160px] bg-bg2">{m.image_url ? <img src={m.image_url} alt={m.name_uz} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Sparkles size={30} style={{ color: "var(--muted)" }} /></div>}<span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white">Boshqalar</span>{!m.is_active && <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white">NOFAOL</span>}</div><div className="flex flex-1 flex-col gap-2.5 p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-bold">{m.name_uz || m.name_ru}</h3><span className="shrink-0 text-[14px] font-extrabold" style={{ color: "var(--acc)" }}>{money(m.sale_price)}</span></div>{/* ⚠️ TANNARX RO'YXATDA KO'RSATILMAYDI (so'rov) — u faqat tafsilot oynasida. */}<div className="text-[12px]"><div className="rounded-[11px] bg-tint px-2.5 py-2"><span className="block" style={{ color: "var(--muted)" }}>Qoldiq</span><b>{m.quantity} dona</b></div></div>{m.last_delivery && <p className="truncate text-[11.5px]" style={{ color: "var(--muted)" }}>Oxirgi yuk: <b style={{ color: "var(--text-2)" }}>{m.last_delivery.number}</b> · {fmtDate(m.last_delivery.received_at)}</p>}<div className="mt-auto flex gap-1.5 pt-1"><button onClick={() => setDetail(m)} className="icon-btn" title="Tafsilot: tannarx, qoldiq, tarix"><History size={15} /></button>{control && <button onClick={() => setEdit(m)} className="icon-btn" title="Tahrirlash"><Pencil size={15} /></button>}{control && <button onClick={() => setSell(m)} disabled={m.quantity <= 0} className="flex flex-1 items-center justify-center gap-1 rounded-[10px] border text-[12px] font-bold disabled:opacity-40" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}><ShoppingCart size={14} /> Alohida sotish</button>}</div></div></article>)}</div>}
    {edit !== undefined && <MaterialModal material={edit} accessoryOnly onClose={() => setEdit(undefined)} onSaved={save} />}
    {sell && <AccessorySellModal material={sell} onClose={() => setSell(null)} onDone={() => { setSell(null); refresh(); }} />}
    {detail && (
      <AccessoryDetail
        item={detail}
        control={control}
        onClose={() => setDetail(null)}
        onEdit={() => { const it = detail; setDetail(null); setEdit(it); }}
        onChanged={(upd) => { if (upd) setDetail(upd); refresh(); }}
      />
    )}
  </div>;
}
