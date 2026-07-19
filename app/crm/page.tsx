"use client";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { dateAfterParam, fmt, fmtTime, initials } from "@/lib/format";
import DateChips from "@/components/DateChips";
import { STATUS_BADGE, STATUS_LABEL, SOURCE_BADGE } from "@/components/badges";
import LeadModal from "@/components/LeadModal";
import ClientModal from "@/components/ClientModal";
import NewLeadModal from "@/components/NewLeadModal";
import NewClientModal from "@/components/NewClientModal";
import { Plus } from "lucide-react";
import type { Customer, Lead, LeadStatus } from "@/lib/types";

const COLS: LeadStatus[] = ["new", "qualified", "contacted", "won", "lost"];
const COL_BG: Record<LeadStatus, string> = {
  new: "var(--tint)", qualified: "var(--bg2)", contacted: "var(--peach)", won: "var(--mint)", lost: "var(--bg2)",
};

function LeadCard({ l, dragging, onOpen, onDrag, onDragEnd }: { l: Lead; dragging: boolean; onOpen: () => void; onDrag: (e: React.DragEvent) => void; onDragEnd: () => void }) {
  const name = l.customer_detail?.name || `@${l.customer_detail?.instagram_username ?? "—"}`;
  return (
    <div
      draggable
      onClick={onOpen}
      onDragStart={onDrag}
      onDragEnd={onDragEnd}
      className="glass cursor-grab !rounded-[15px] p-3.5 transition-[opacity] duration-150 animate-[rowIn_0.18s_var(--ease)] hover:!border-[var(--acc)]"
      // sudralayotgan kartaning ASL o'RNI — 15% sharpa + shtrixli chegara:
      // karta ikki nusxada ko'rinmaydi, ustun balandligi saqlanadi
      style={dragging ? { opacity: 0.15, borderStyle: "dashed", borderColor: "var(--primary)" } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold">{name}</span>
        <span className={SOURCE_BADGE(l.source)}>{l.source || "—"}</span>
      </div>
      <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--mut)" }}>{l.request_uz || l.request_ru}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[14px] font-bold" style={{ color: "var(--acc)" }}>{fmt(l.estimated_price)}</span>
        <span className="text-[11px]" style={{ color: "var(--mut)" }}>{fmtTime(l.created_at)}</span>
      </div>
      <div className="mt-0.5 text-xs" style={{ color: "var(--mut)" }}>{l.customer_detail?.masked_phone || l.customer_detail?.phone || "tel yo'q"}</div>
    </div>
  );
}

const ARR_OPTS = [
  { value: "", label: "Barcha turlar" },
  { value: "bouquet", label: "Buket" },
  { value: "basket", label: "Savat" },
  { value: "stems", label: "Donalab" },
  { value: "catalog", label: "Katalog" },
];

const LANG_OPTS = [
  { value: "", label: "Barcha tillar" },
  { value: "uz", label: "O'zbekcha" },
  { value: "ru", label: "Ruscha" },
];

export default function CrmPage() {
  const { user, showToast, dateFilter } = useStore();
  const { canControl } = usePerm();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"leads" | "clients">("leads");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [selLead, setSelLead] = useState<Lead | null>(null);
  const [selClient, setSelClient] = useState<Customer | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);
  const [newLead, setNewLead] = useState(false);
  const [newClient, setNewClient] = useState(false);
  const kanbanRef = useRef<HTMLDivElement>(null);
  const [kanbanH, setKanbanH] = useState<number | null>(null);
  // server tomonda ishlaydigan filtrlar
  const [search, setSearch] = useState("");
  const [q, setQ] = useState(""); // debounce qilingan qiymat
  const [branch, setBranch] = useState("");
  const [arrType, setArrType] = useState("");
  const [lang, setLang] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const branchOpts = [
    { value: "", label: "Barcha filiallar" },
    ...(user?.profile.branches ?? []).map((b) => ({ value: String(b.id), label: b.name })),
  ];

  // kanban pastki chegarasi ham sidebar bilan bir chiziqda (chat kabi):
  // viewport − ustki joylashuv − 14px (Shell tashqi paddingi)
  useEffect(() => {
    const measure = () => {
      const top = kanbanRef.current?.getBoundingClientRect().top ?? 0;
      setKanbanH(Math.max(window.innerHeight - top - 14, 420));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [loading, tab, view]);

  const load = useCallback(async () => {
    try {
      const [ls, cs] = await Promise.all([
        // barcha filtrlar server tomonda
        api.leads({
          ordering: "-created_at",
          created_at_after: dateAfterParam(dateFilter),
          search: q || undefined,
          branch: branch || undefined,
          arrangement_type: arrType || undefined,
        }),
        api.customers({
          ordering: "-created_at",
          search: q || undefined,
          branch: branch || undefined,
          language: lang || undefined,
        }),
      ]);
      setLeads(ls);
      setCustomers(cs);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [showToast, dateFilter, q, branch, arrType, lang]);

  useEffect(() => { load(); }, [load]);

  const fLeads = leads;

  const setLeadStatus = async (id: number, st: LeadStatus) => {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: st } : l)));
    try {
      const upd = await api.updateLead(id, { status: st });
      setLeads((ls) => ls.map((l) => (l.id === id ? upd : l)));
      showToast(`Lead «${STATUS_LABEL[st]}» ustuniga ko'chirildi`);
    } catch (e) {
      setLeads(prev);
      showToast(e instanceof Error ? e.message : "Statusni saqlab bo'lmadi");
    }
  };

  const drop = (st: LeadStatus) => {
    if (dragId != null) setLeadStatus(dragId, st);
    setDragId(null); setOverCol(null);
  };

  if (loading) return <FlowerLoader />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["leads", "clients"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx("rounded-full border-[1.5px] px-5 py-2 text-[13px] font-bold", tab === t ? "text-white" : "bg-sfc")} style={tab === t ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}>
            {t === "leads" ? `Leadlar (${fLeads.length})` : `Mijozlar (${customers.length})`}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Lead/mijoz qidirish" />
          <FilterSelect value={branch} options={branchOpts} onChange={setBranch} label="Filial" />
          {tab === "leads" && <FilterSelect value={arrType} options={ARR_OPTS} onChange={setArrType} label="Turi" />}
          {tab === "clients" && <FilterSelect value={lang} options={LANG_OPTS} onChange={setLang} label="Til" />}
          <DateChips />
          {tab === "leads" && canControl("crm") && (
            <button onClick={() => setNewLead(true)} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[13.5px]">
              <Plus size={17} strokeWidth={1.75} /> Lead
            </button>
          )}
          {tab === "clients" && canControl("customers") && (
            <button onClick={() => setNewClient(true)} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[13.5px]">
              <Plus size={17} strokeWidth={1.75} /> Mijoz
            </button>
          )}
          {tab === "leads" && (
            <div className="glass flex gap-1 !rounded-xl p-1">
              {(["kanban", "table"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={clsx("rounded-[9px] px-4 py-1.5 text-xs font-bold", view === v ? "text-white" : "")} style={view === v ? { background: "var(--acc)" } : { color: "var(--mut)" }}>
                  {v === "kanban" ? "Kanban" : "Jadval"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {tab === "leads" && view === "kanban" && (
        <div
          ref={kanbanRef}
          className="mb-[-40px] gap-3.5 max-lg:flex max-lg:snap-x max-lg:snap-mandatory max-lg:overflow-x-auto max-lg:overscroll-x-contain lg:grid"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(215px,1fr))", height: kanbanH ?? "calc(100dvh - 220px)" }}
        >
          {COLS.map((st) => {
            const items = fLeads.filter((l) => l.status === st);
            const isOver = overCol === st && dragId != null;
            return (
              <div key={st} onDragOver={(e) => { e.preventDefault(); setOverCol(st); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }} onDrop={(e) => { e.preventDefault(); drop(st); }} className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border-[1.5px] p-3 max-lg:w-[85vw] max-lg:min-w-[85vw] max-lg:max-w-[420px] max-lg:shrink-0 max-lg:snap-center" style={{ background: COL_BG[st], borderColor: "var(--line)" }}>
                <div className="kanban-head flex shrink-0 items-center justify-between px-1.5 pb-2.5">
                  <span className="text-[13px] font-bold tracking-wide">{STATUS_LABEL[st].toUpperCase()}</span>
                  <span className="rounded-full px-2.5 text-[12px] font-bold text-white" style={{ background: "var(--side)" }}>{items.length}</span>
                </div>
                {/* har ustun o'z ichida skrollanadi */}
                <div data-lenis-prevent className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain pr-0.5">
                  {/* drop slot — silliq ochiladi */}
                  <div className="box-border rounded-[15px] border-2 border-dashed transition-all duration-250" style={{ height: isOver ? 84 : 0, marginBottom: isOver ? 0 : -10, borderColor: isOver ? "var(--acc)" : "transparent", background: isOver ? "rgba(255,255,255,.15)" : "transparent" }} />
                  {items.map((l) => (
                    <LeadCard
                      key={l.id}
                      l={l}
                      dragging={dragId === l.id}
                      onOpen={() => setSelLead(l)}
                      onDrag={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        // ko'tarilgan nusxa: yengil qiyalik + soya + 1.03 masshtab
                        const el = e.currentTarget as HTMLElement;
                        const r = el.getBoundingClientRect();
                        const clone = el.cloneNode(true) as HTMLElement;
                        clone.style.cssText = `position:fixed;top:-1200px;left:-1200px;width:${r.width}px;box-sizing:border-box;transform:rotate(2.5deg) scale(1.03);box-shadow:0 18px 44px rgba(30,15,10,.3);border-radius:15px;background:var(--surface-solid);pointer-events:none;`;
                        document.body.appendChild(clone);
                        e.dataTransfer.setDragImage(clone, e.clientX - r.left, e.clientY - r.top);
                        setTimeout(() => clone.remove(), 0);
                        // sharpa uslubi brauzer snapshot olganidan KEYIN qo'llanadi —
                        // aks holda ko'tarilgan nusxaning o'zi xira chiqib qoladi
                        setTimeout(() => setDragId(l.id), 0);
                      }}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "leads" && view === "table" && (
        <div className="glass overflow-hidden !rounded-[20px] max-md:overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-[1.6fr_2.2fr_1fr_1.1fr_1fr_.8fr] gap-2.5 border-b-[1.5px] bg-tint px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest text-tintink" style={{ borderColor: "var(--line)" }}>
            <span>Mijoz</span><span>So&apos;rov</span><span>Manba</span><span>Taxminiy narx</span><span>Status</span><span>Vaqt</span>
          </div>
          {fLeads.map((l, ri) => (
            <button key={l.id} onClick={() => setSelLead(l)} className="row-lux grid w-full min-w-[720px] grid-cols-[1.6fr_2.2fr_1fr_1.1fr_1fr_.8fr] items-center gap-2.5 border-t px-4 py-3 text-left text-[13px]" style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(ri * 45, 500)}ms` }}>
              <span className="min-w-0">
                <span className="block truncate font-bold" title={l.customer_detail?.name || `@${l.customer_detail?.instagram_username}`}>{l.customer_detail?.name || `@${l.customer_detail?.instagram_username}`}</span>
                <span className="block truncate text-[12px]" style={{ color: "var(--mut)" }}>{l.customer_detail?.masked_phone || "tel yo'q"}</span>
              </span>
              <span className="min-w-0 truncate" style={{ color: "var(--mut)" }} title={l.request_uz || l.request_ru}>{l.request_uz || l.request_ru}</span>
              <span><span className={SOURCE_BADGE(l.source)}>{l.source || "—"}</span></span>
              <span className="font-bold" style={{ color: "var(--acc)" }}>{fmt(l.estimated_price)}</span>
              <span><span className={STATUS_BADGE[l.status]}>{STATUS_LABEL[l.status]}</span></span>
              <span className="text-xs" style={{ color: "var(--mut)" }}>{fmtTime(l.created_at)}</span>
            </button>
          ))}
          {fLeads.length === 0 && <EmptyState title="Tanlangan davrda lead yo&apos;q" sub="Davr filtrini kengaytiring yoki yangi suhbatlarni kuting — AI leadlarni avtomatik yaratadi." />}
        </div>
      )}

      {tab === "clients" && (
        <>
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
                <span>{c.masked_phone || "—"}</span>
                <span className="min-w-0 truncate font-semibold" style={{ color: "var(--acc)" }} title={`@${c.instagram_username || "—"}`}>@{c.instagram_username || "—"}</span>
                <span className="font-bold">{c.purchases_count}</span>
                <span className="font-bold">{parseFloat(c.total_spent) > 0 ? fmt(c.total_spent) : "—"}</span>
                <span style={{ color: "var(--mut)" }}>{fmtTime(c.created_at)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[13px]" style={{ color: "var(--mut)" }}>
            Mijoz CRM&apos;ga client sifatida 1 marta tushadi; har yangi xarid istagi alohida lead bo&apos;lib qo&apos;shiladi.
          </p>
        </>
      )}

      {selLead != null && (
        <LeadModal
          lead={selLead}
          onClose={() => setSelLead(null)}
          onStatus={(st) => { setLeadStatus(selLead.id, st); setSelLead({ ...selLead, status: st }); }}
        />
      )}
      {selClient != null && <ClientModal client={selClient} onClose={() => setSelClient(null)} />}
      {newLead && (
        <NewLeadModal
          customers={customers}
          onClose={() => setNewLead(false)}
          onSaved={(l) => { setNewLead(false); setLeads((ls) => [l, ...ls]); }}
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
