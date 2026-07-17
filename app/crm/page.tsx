"use client";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { dateAfterParam, fmt, fmtTime, initials } from "@/lib/format";
import DateChips from "@/components/DateChips";
import { STATUS_BADGE, STATUS_LABEL, SOURCE_BADGE } from "@/components/badges";
import LeadModal from "@/components/LeadModal";
import ClientModal from "@/components/ClientModal";
import type { Customer, Lead, LeadStatus } from "@/lib/types";

const COLS: LeadStatus[] = ["new", "qualified", "contacted", "won", "lost"];
const COL_BG: Record<LeadStatus, string> = {
  new: "var(--tint)", qualified: "var(--bg2)", contacted: "var(--peach)", won: "var(--mint)", lost: "var(--bg2)",
};

function LeadCard({ l, onOpen, onDrag, onDragEnd }: { l: Lead; onOpen: () => void; onDrag: (e: React.DragEvent) => void; onDragEnd: () => void }) {
  const name = l.customer_detail?.name || `@${l.customer_detail?.instagram_username ?? "—"}`;
  return (
    <div draggable onClick={onOpen} onDragStart={onDrag} onDragEnd={onDragEnd} className="glass cursor-grab !rounded-[15px] p-3.5 hover:!border-[var(--acc)]">
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

export default function CrmPage() {
  const { showToast, dateFilter } = useStore();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"leads" | "clients">("leads");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [selLead, setSelLead] = useState<Lead | null>(null);
  const [selClient, setSelClient] = useState<Customer | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const [ls, cs] = await Promise.all([
        // davr filtri server tomonda — created_at_after
        api.leads({ ordering: "-created_at", created_at_after: dateAfterParam(dateFilter) }),
        api.customers({ ordering: "-created_at" }),
      ]);
      setLeads(ls);
      setCustomers(cs);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [showToast, dateFilter]);

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
        <div className="ml-auto flex items-center gap-2">
          <DateChips />
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
        <div className="grid items-start gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(215px,1fr))" }}>
          {COLS.map((st) => {
            const items = fLeads.filter((l) => l.status === st);
            const isOver = overCol === st && dragId != null;
            return (
              <div key={st} onDragOver={(e) => { e.preventDefault(); setOverCol(st); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }} onDrop={(e) => { e.preventDefault(); drop(st); }} className="rounded-[18px] border-[1.5px] p-3" style={{ background: COL_BG[st], borderColor: "var(--line)" }}>
                <div className="flex items-center justify-between px-1.5 pb-2.5">
                  <span className="text-[13px] font-bold tracking-wide">{STATUS_LABEL[st].toUpperCase()}</span>
                  <span className="rounded-full px-2.5 text-[12px] font-bold text-white" style={{ background: "var(--side)" }}>{items.length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {/* drop slot — silliq ochiladi */}
                  <div className="box-border rounded-[15px] border-2 border-dashed transition-all duration-250" style={{ height: isOver ? 84 : 0, marginBottom: isOver ? 0 : -10, borderColor: isOver ? "var(--acc)" : "transparent", background: isOver ? "rgba(255,255,255,.15)" : "transparent" }} />
                  {items.map((l) => (
                    <LeadCard key={l.id} l={l} onOpen={() => setSelLead(l)} onDrag={(e) => { setDragId(l.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDragId(null); setOverCol(null); }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "leads" && view === "table" && (
        <div className="glass overflow-hidden !rounded-[20px]">
          <div className="grid grid-cols-[1.6fr_2.2fr_1fr_1.1fr_1fr_.8fr] gap-2.5 border-b-[1.5px] bg-tint px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest text-tintink" style={{ borderColor: "var(--line)" }}>
            <span>Mijoz</span><span>So&apos;rov</span><span>Manba</span><span>Taxminiy narx</span><span>Status</span><span>Vaqt</span>
          </div>
          {fLeads.map((l, ri) => (
            <button key={l.id} onClick={() => setSelLead(l)} className="row-lux grid w-full grid-cols-[1.6fr_2.2fr_1fr_1.1fr_1fr_.8fr] items-center gap-2.5 border-t px-4 py-3 text-left text-[13px]" style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(ri * 45, 500)}ms` }}>
              <span>
                <span className="block font-bold">{l.customer_detail?.name || `@${l.customer_detail?.instagram_username}`}</span>
                <span className="text-[12px]" style={{ color: "var(--mut)" }}>{l.customer_detail?.masked_phone || "tel yo'q"}</span>
              </span>
              <span style={{ color: "var(--mut)" }}>{l.request_uz || l.request_ru}</span>
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
          <div className="glass overflow-hidden !rounded-[20px]">
            <div className="grid grid-cols-[2fr_1.3fr_1.2fr_.7fr_1.1fr_1fr] gap-2.5 border-b-[1.5px] bg-tint px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest text-tintink" style={{ borderColor: "var(--line)" }}>
              <span>Mijoz</span><span>Telefon</span><span>Instagram</span><span>Xaridlar</span><span>Jami summa</span><span>Qo&apos;shilgan</span>
            </div>
            {customers.map((c, ri) => (
              <button key={c.id} onClick={() => setSelClient(c)} className="row-lux grid w-full grid-cols-[2fr_1.3fr_1.2fr_.7fr_1.1fr_1fr] items-center gap-2.5 border-t px-4 py-3.5 text-left text-[14px]" style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(ri * 45, 500)}ms` }}>
                <span className="flex items-center gap-2.5">
                  <span className="flex h-[34px] w-[34px] -rotate-3 items-center justify-center rounded-[11px] bg-tint text-[13px] font-bold text-tintink">{initials(c.name || c.instagram_username)}</span>
                  <span className="font-bold">{c.name || `@${c.instagram_username}`}</span>
                  {c.is_blocked && <span className="rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-roseink">BLOK</span>}
                </span>
                <span>{c.masked_phone || "—"}</span>
                <span className="font-semibold" style={{ color: "var(--acc)" }}>@{c.instagram_username || "—"}</span>
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
    </>
  );
}
