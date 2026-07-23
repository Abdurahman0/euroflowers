"use client";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import SearchInput from "@/components/SearchInput";
import ClearFilters from "@/components/ClearFilters";
import FilterSelect from "@/components/FilterSelect";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { usePerm, useStore } from "@/lib/store";
import { fmt, fmtTime, initials } from "@/lib/format";
import ClientModal from "@/components/ClientModal";
import NewClientModal from "@/components/NewClientModal";
import { Plus } from "lucide-react";
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
        <div className="grid min-w-[680px] grid-cols-[2fr_1.3fr_1.2fr_.7fr_1.1fr_1fr] gap-2.5 border-b-[1.5px] bg-tint px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest text-tintink" style={{ borderColor: "var(--line)" }}>
          <span>Mijoz</span><span>Telefon</span><span>Instagram</span><span>Xaridlar</span><span>Jami summa</span><span>Qo&apos;shilgan</span>
        </div>
        {customers.map((c, ri) => (
          <button key={c.id} onClick={() => setSelClient(c)} className="row-lux grid w-full min-w-[680px] grid-cols-[2fr_1.3fr_1.2fr_.7fr_1.1fr_1fr] items-center gap-2.5 border-t px-4 py-3.5 text-left text-[14px]" style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(ri * 45, 500)}ms` }}>
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="avatar-lead flex h-[34px] w-[34px] shrink-0 -rotate-3 items-center justify-center rounded-[11px] text-[13px] font-bold">{initials(c.name || c.instagram_username)}</span>
              <span className="truncate font-bold" title={c.name || `@${c.instagram_username}`}>{c.name || `@${c.instagram_username}`}</span>
              {c.is_blocked && <span className="rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-roseink">BLOK</span>}
            </span>
            <span>{c.phone || c.masked_phone || "—"}</span>
            <span className="min-w-0 truncate font-semibold" style={{ color: "var(--acc)" }} title={`@${c.instagram_username || "—"}`}>@{c.instagram_username || "—"}</span>
            <span className="font-bold">{c.purchases_count}</span>
            <span className="font-bold">{parseFloat(c.total_spent) > 0 ? fmt(c.total_spent) : "—"}</span>
            <span style={{ color: "var(--mut)" }}>{fmtTime(c.created_at)}</span>
          </button>
        ))}
        {customers.length === 0 && <EmptyState title="Mijoz topilmadi" sub="Filtrlarni tozalab ko'ring yoki yangi mijoz qo'shing." />}
      </div>

      {selClient != null && (
        <ClientModal
          client={selClient}
          onClose={() => setSelClient(null)}
          onOpenLead={(l) => { setSelClient(null); router.push(`/buyurtmalar?order=${l.id}`); }}
        />
      )}
      {newClient && (
        <NewClientModal
          onClose={() => setNewClient(false)}
          onSaved={(c) => { setNewClient(false); setCustomers((cs) => [c, ...cs]); }}
        />
      )}
    </>
  );
}
