"use client";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import SearchInput from "@/components/SearchInput";
import ClearFilters from "@/components/ClearFilters";
import FilterSelect from "@/components/FilterSelect";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { usePerm, useStore } from "@/lib/store";
import { fmt, fmtTime, initials } from "@/lib/format";
import ClientModal from "@/components/ClientModal";
import NewClientModal from "@/components/NewClientModal";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Customer } from "@/lib/types";

/** Mijozlar — alohida sahifa (ilgari CRM ichidagi tab edi).
    Buyurtmalar endi /buyurtmalar sahifasida. */

const LANG_OPTS = [
  { value: "", label: "Barcha tillar" },
  { value: "uz", label: "O'zbekcha" },
  { value: "ru", label: "Ruscha" },
];

export default function MijozlarPage() {
  const router = useRouter();
  const { showToast } = useStore();
  const { canControl } = usePerm();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selClient, setSelClient] = useState<Customer | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [editClient, setEditClient] = useState<Customer | null>(null);
  const [confirmDel, setConfirmDel] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setCustomers(await api.customers({
        ordering: "-created_at",
        search: q || undefined,
        language: lang || undefined,
      }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [showToast, q, lang]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  const control = canControl("customers");

  // mijozni butunlay o'chirish — tasdiqdan keyin (DELETE /api/customers/{id}/)
  const doDelete = async () => {
    if (!confirmDel) return;
    const victim = confirmDel;
    setDeleting(true);
    try {
      await api.deleteCustomer(victim.id);
      setCustomers((cs) => cs.filter((c) => c.id !== victim.id));
      setSelClient((s) => (s?.id === victim.id ? null : s));
      setEditClient((s) => (s?.id === victim.id ? null : s));
      setConfirmDel(null);
      showToast("✓ Mijoz o'chirildi");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <FlowerLoader />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Mijozlar ({customers.length}) — har biri bitta yozuv, xaridlari buyurtma bo&apos;lib qo&apos;shiladi
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Mijoz qidirish" />
          <FilterSelect value={lang} options={LANG_OPTS} onChange={setLang} label="Til" />
          <ClearFilters
            show={!!(search || lang)}
            onClear={() => { setSearch(""); setLang(""); }}
          />
          {canControl("customers") && (
            <button onClick={() => setNewClient(true)} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[13.5px]">
              <Plus size={17} strokeWidth={1.75} /> Mijoz
            </button>
          )}
        </div>
      </div>

      <div className="glass overflow-hidden !rounded-[20px] max-md:overflow-x-auto">
        <div className="grid min-w-[620px] grid-cols-[2fr_1.4fr_.8fr_1.2fr_1fr] gap-2.5 border-b-[1.5px] bg-tint px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest text-tintink" style={{ borderColor: "var(--line)" }}>
          <span>Mijoz</span><span>Telefon</span><span>Xaridlar</span><span>Jami summa</span><span>Qo&apos;shilgan</span>
        </div>
        {customers.map((c, ri) => (
          <button key={c.id} onClick={() => setSelClient(c)} className="row-lux group relative grid w-full min-w-[620px] grid-cols-[2fr_1.4fr_.8fr_1.2fr_1fr] items-center gap-2.5 border-t px-4 py-3.5 text-left text-[14px]" style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(ri * 45, 500)}ms` }}>
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="avatar-lead flex h-[34px] w-[34px] shrink-0 -rotate-3 items-center justify-center rounded-[11px] text-[13px] font-bold">{initials(c.name)}</span>
              <span className="truncate font-bold" title={c.name || "Ismsiz mijoz"}>{c.name || "Ismsiz mijoz"}</span>
              {c.is_blocked && <span className="rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-roseink">BLOK</span>}
            </span>
            <span>{c.phone || c.masked_phone || "—"}</span>
            <span className="font-bold">{c.purchases_count}</span>
            <span className="font-bold">{parseFloat(c.total_spent) > 0 ? fmt(c.total_spent) : "—"}</span>
            <span style={{ color: "var(--mut)" }}>{fmtTime(c.created_at)}</span>
            {/* qator amallari — hover'da (tugma ichida tugma bo'lmasin: span role=button) */}
            {control && (
              // markazlash flex bilan — transform emas (hover'dagi translateX(2px) transformni bosib yuboradi)
              <span className="absolute inset-y-0 right-3 flex items-center opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
              <span className="flex items-center gap-1 rounded-[10px] px-1 py-0.5 backdrop-blur-sm" style={{ background: "color-mix(in srgb, var(--surface) 78%, transparent)" }}>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setEditClient(c); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setEditClient(c); } }}
                  title="Tahrirlash"
                  aria-label={`${c.name || "Mijoz"} — tahrirlash`}
                  className="icon-btn !h-7 !w-7"
                >
                  <Pencil size={13.5} strokeWidth={1.75} />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setConfirmDel(c); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setConfirmDel(c); } }}
                  title="O'chirish"
                  aria-label={`${c.name || "Mijoz"} — o'chirish`}
                  className="icon-btn icon-btn-danger !h-7 !w-7"
                >
                  <Trash2 size={13.5} strokeWidth={1.75} />
                </span>
              </span>
              </span>
            )}
          </button>
        ))}
        {customers.length === 0 && <EmptyState title="Mijoz topilmadi" sub="Filtrlarni tozalab ko'ring yoki yangi mijoz qo'shing." />}
      </div>

      {selClient != null && (
        <ClientModal
          client={selClient}
          onClose={() => setSelClient(null)}
          onOpenLead={(l) => { setSelClient(null); router.push(`/buyurtmalar?order=${l.id}`); }}
          onOpenChat={(cid) => { setSelClient(null); router.push(`/chat?conv=${cid}`); }}
          onEdit={control ? () => setEditClient(selClient) : undefined}
          onDelete={control ? () => setConfirmDel(selClient) : undefined}
        />
      )}
      {newClient && (
        <NewClientModal
          onClose={() => setNewClient(false)}
          onSaved={(c) => { setNewClient(false); setCustomers((cs) => [c, ...cs]); }}
        />
      )}
      {editClient != null && (
        <NewClientModal
          client={editClient}
          onClose={() => setEditClient(null)}
          onSaved={(c) => {
            setEditClient(null);
            setCustomers((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...c } : x)));
            setSelClient((s) => (s?.id === c.id ? { ...s, ...c } : s));
          }}
        />
      )}

      {/* o'chirish tasdig'i — qaytarib bo'lmaydigan amal. PORTAL body ostida:
          sahifa animatsiyalari stacking-context yaratadi, aks holda dialog
          drawer overlay'i (body portali) ORQASIDA qolib ketadi */}
      {confirmDel && createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-5" style={{ background: "rgba(24,17,12,.4)", backdropFilter: "blur(8px)" }} onClick={() => setConfirmDel(null)} role="dialog" aria-modal="true" data-lenis-prevent>
          <div className="glass-modal w-[min(400px,100%)] p-6 animate-[rowIn_0.22s_var(--ease)_both]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-bold">Mijozni o&apos;chirish</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-2)]">
              «{confirmDel.name || "Ismsiz mijoz"}» butunlay o&apos;chirilsinmi? Bu amalni bekor qilib bo&apos;lmaydi.
            </p>
            {confirmDel.leads_count > 0 && (
              <p className="mt-2 rounded-[11px] bg-peach px-3 py-2 text-[12.5px] font-semibold leading-snug text-peachink">
                ⚠ Bu mijozda {confirmDel.leads_count} ta buyurtma yozuvi bor — ular ham o&apos;chib ketishi mumkin.
              </p>
            )}
            <div className="mt-5 flex gap-2.5">
              <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1">Bekor qilish</button>
              <button onClick={doDelete} disabled={deleting} className={`btn-danger flex-1 ${deleting ? "btn-loading" : ""}`}>O&apos;chirish</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
