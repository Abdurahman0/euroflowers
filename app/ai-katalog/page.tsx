"use client";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Image as ImageIcon, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import type { AICatalogInput, AICatalogItem } from "@/lib/types";

const TYPES = [
  { value: "", label: "Barcha turlar" }, { value: "bouquet", label: "Buket" },
  { value: "basket", label: "Savat" }, { value: "box", label: "Quti" }, { value: "other", label: "Boshqa" },
];
const typeLabel = (v: string) => TYPES.find((x) => x.value === v)?.label ?? v;
const money = (v: string | number) => `${Math.round(+v || 0).toLocaleString("ru-RU")} so'm`;

function Editor({ item, onClose, onSaved }: { item: AICatalogItem | null; onClose: () => void; onSaved: (x: AICatalogItem) => void }) {
  const showToast = useStore((s) => s.showToast);
  const [f, setF] = useState({ name: item?.name ?? "", arrangement_type: (item?.arrangement_type ?? "bouquet") as AICatalogItem["arrangement_type"], quantity: String(item?.quantity ?? 1), volume: item?.volume ?? "", price: item?.price ?? "", note: item?.note ?? "", image_url: item?.image_url ?? "", instagram_link: item?.instagram_link ?? "", is_active: item?.is_active ?? true });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.name.trim() || !f.price.trim()) return showToast("Nomi va narxni kiriting");
    setBusy(true);
    try {
      const payload: AICatalogInput = { ...f, name: f.name.trim(), arrangement_type: f.arrangement_type as AICatalogInput["arrangement_type"], quantity: Math.max(0, Math.floor(+f.quantity || 0)), price: String(+f.price || 0), volume: f.volume.trim(), note: f.note.trim(), image_url: f.image_url.trim(), instagram_link: f.instagram_link.trim() };
      const saved = item ? await api.updateAICatalogItem(item.id, payload) : await api.createAICatalogItem(payload);
      showToast(item ? "✓ AI katalog yangilandi" : "✓ AI katalogga qo'shildi"); onSaved(saved);
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi"); } finally { setBusy(false); }
  };
  const field = (key: keyof typeof f, label: string, extra = "") => <label className={`flex flex-col gap-1.5 text-[12px] font-bold ${extra}`}><span style={{ color: "var(--muted)" }}>{label}</span><input className="inp" value={String(f[key])} onChange={(e) => setF({ ...f, [key]: e.target.value })} /></label>;
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md" onMouseDown={onClose}>
    <div className="glass-modal w-[min(680px,100%)] max-h-[92vh] overflow-y-auto p-6" onMouseDown={(e) => e.stopPropagation()}>
      <div className="mb-5 flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[18px] font-extrabold"><Sparkles size={19} style={{ color: "var(--primary)" }} /> {item ? "AI katalogni tahrirlash" : "AI katalogga qo'shish"}</div><p className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>Bu katalog mijozlarga AI orqali ko'rsatiladi.</p></div><button onClick={onClose} className="icon-btn"><X size={17} /></button></div>
      <div className="grid gap-3 sm:grid-cols-2">{field("name", "Nomi", "sm:col-span-2")} {field("quantity", "Soni")} {field("volume", "Hajmi")} {field("price", "Narxi", "sm:col-span-2")} {field("image_url", "Rasm URL", "sm:col-span-2")} {field("instagram_link", "Instagram link", "sm:col-span-2")}<label className="flex flex-col gap-1.5 text-[12px] font-bold sm:col-span-2"><span style={{ color: "var(--muted)" }}>Turi</span><select className="inp" value={f.arrangement_type} onChange={(e) => setF({ ...f, arrangement_type: e.target.value })}>{TYPES.filter((x) => x.value).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label className="flex flex-col gap-1.5 text-[12px] font-bold sm:col-span-2"><span style={{ color: "var(--muted)" }}>Izoh</span><textarea className="inp min-h-[90px] resize-y" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label></div>
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] font-semibold"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" /> AI ko'rsatish uchun faol</label>
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="btn-ghost">Bekor</button><button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button></div>
    </div>
  </div>;
}

export default function AICatalogPage() {
  const { showToast } = useStore(); const { canControl } = usePerm();
  const control = canControl("catalog"); const [rows, setRows] = useState<AICatalogItem[] | null>(null); const [q, setQ] = useState(""); const [type, setType] = useState(""); const [onlyActive, setOnlyActive] = useState(true); const [edit, setEdit] = useState<AICatalogItem | null | undefined>(undefined);
  const load = () => api.aiCatalog({ ordering: "-created_at", search: q || undefined, arrangement_type: type || undefined, is_active: onlyActive ? true : undefined }).then(setRows).catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  useEffect(() => { load(); }, [q, type, onlyActive]);
  const visible = useMemo(() => rows ?? [], [rows]);
  const remove = async (x: AICatalogItem) => { if (!confirm(`«${x.name}» o'chirilsinmi?`)) return; try { await api.deleteAICatalogItem(x.id); setRows((r) => r?.filter((y) => y.id !== x.id) ?? null); showToast("✓ O'chirildi"); } catch (e) { showToast(e instanceof Error ? e.message : "O'chirib bo'lmadi"); } };
  if (rows === null) return <FlowerLoader />;
  return <>
    <div className="mb-5 flex flex-wrap items-end gap-3"><div><div className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight"><Sparkles size={21} style={{ color: "var(--primary)" }} /> AI Katalog</div><p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>AI mijozlarga ko'rsatadigan mahsulotlar vitrinası</p></div><div className="ml-auto flex flex-wrap items-center gap-2"><label className="flex h-10 items-center gap-2 rounded-[13px] border px-3" style={{ borderColor: "var(--border)" }}><Search size={15} style={{ color: "var(--muted)" }} /><input className="w-[170px] bg-transparent text-[13px] outline-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish…" /></label><select className="h-10 rounded-[13px] border bg-transparent px-3 text-[13px] font-semibold" value={type} onChange={(e) => setType(e.target.value)} style={{ borderColor: "var(--border)" }}>{TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select><button className={`h-10 rounded-[13px] border px-3 text-[12.5px] font-bold ${onlyActive ? "text-white" : ""}`} style={onlyActive ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--border)", color: "var(--text-2)" }} onClick={() => setOnlyActive((x) => !x)}>{onlyActive ? "Faol" : "Barchasi"}</button>{control && <button onClick={() => setEdit(null)} className="btn-primary !h-10 !px-4"><Plus size={17} /> Qo'shish</button>}</div></div>
    {visible.length === 0 ? <EmptyState title="AI katalog bo'sh" sub="Mijozlarga ko'rsatish uchun birinchi mahsulotni qo'shing." /> : <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>{visible.map((x) => <article key={x.id} className="glass card-hover group flex flex-col overflow-hidden !rounded-[20px]" style={{ opacity: x.is_active ? 1 : .55 }}><div className="relative h-[180px] bg-bg2">{x.image_url ? <img src={x.image_url} alt={x.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon size={30} style={{ color: "var(--muted)" }} /></div>}<span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white">{typeLabel(x.arrangement_type)}</span>{!x.is_active && <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white">NOFAOL</span>}</div><div className="flex flex-1 flex-col gap-2 p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-bold">{x.name}</h3><span className="shrink-0 text-[14px] font-extrabold" style={{ color: "var(--acc)" }}>{money(x.price)}</span></div><div className="flex flex-wrap gap-1.5 text-[11.5px] font-bold"><span className="rounded-full bg-tint px-2.5 py-1">{x.quantity} ta</span>{x.volume && <span className="rounded-full bg-tint px-2.5 py-1">{x.volume}</span>}<span className="rounded-full bg-tint px-2.5 py-1">{x.instagram_link ? "Instagram bor" : "Instagram yo'q"}</span></div>{x.note && <p className="line-clamp-3 text-[12.5px]" style={{ color: "var(--muted)" }}>{x.note}</p>}<div className="mt-auto flex gap-2 pt-2">{x.instagram_link && <a href={x.instagram_link} target="_blank" rel="noreferrer" className="icon-btn" aria-label="Instagram ochish"><ExternalLink size={15} /></a>}{control && <><button onClick={() => setEdit(x)} className="icon-btn" aria-label="Tahrirlash"><Pencil size={15} /></button><button onClick={() => remove(x)} className="icon-btn icon-btn-danger" aria-label="O'chirish"><Trash2 size={15} /></button></>}</div></div></article>)}</div>}
    {edit !== undefined && <Editor item={edit} onClose={() => setEdit(undefined)} onSaved={(x) => { setRows((r) => { const a = r ?? []; const i = a.findIndex((y) => y.id === x.id); return i >= 0 ? a.map((y) => y.id === x.id ? x : y) : [x, ...a]; }); setEdit(undefined); }} />}
  </>;
}
