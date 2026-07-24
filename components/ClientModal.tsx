"use client";
import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmt, fmtTime, initials } from "@/lib/format";
import Modal from "./Modal";
import { SourceBadge, statusBadgeProps, statusName } from "./badges";
import type { Conversation, Customer, Lead } from "@/lib/types";

export default function ClientModal({
  client,
  onClose,
  onOpenLead,
  onEdit,
  onDelete,
  onOpenChat,
}: {
  client: Customer;
  onClose: () => void;
  /** lead qatori bosilganda — CRM o'sha kanban kartasining panelini ochadi */
  onOpenLead?: (l: Lead) => void;
  /** tahrirlash oynasini ochadi (sahifa boshqaradi, ruxsat bilan) */
  onEdit?: () => void;
  /** o'chirish tasdig'ini ochadi (sahifa boshqaradi, ruxsat bilan) */
  onDelete?: () => void;
  /** «Chatga o'tish» — AI chatlar sahifasida shu mijoz suhbatini ochadi */
  onOpenChat?: (conversationId: number) => void;
}) {
  const name = client.name || "Ismsiz mijoz";
  const [leads, setLeads] = useState<Lead[] | null>(null);
  // mijozning suhbati bor-yo'qligi — «Chatga o'tish» tugmasi shunga qarab chiziladi
  const [conv, setConv] = useState<Conversation | null | undefined>(undefined);

  useEffect(() => {
    // to'liq tarix — sahifadagi davr filtridan mustaqil
    api.leads({ ordering: "-created_at" })
      .then((ls) => setLeads(ls.filter((l) => l.customer === client.id)))
      .catch(() => setLeads([]));
    api.conversations({ ordering: "-last_message_at" })
      .then((cs) => setConv(cs.find((c) => c.customer === client.id) ?? null))
      .catch(() => setConv(null));
  }, [client.id]);

  const Stat = ({ v, k }: { v: string; k: string }) => (
    <div className="rounded-[14px] border border-[color:var(--border)] p-3 text-center">
      <div className="text-[14px] font-extrabold">{v}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-2)]">{k}</div>
    </div>
  );

  return (
    <Modal onClose={onClose} width={560}>
      <div className="flex flex-wrap items-center gap-3 pt-6">
        <div className="avatar-lead flex h-[52px] w-[52px] shrink-0 -rotate-3 items-center justify-center rounded-2xl text-lg font-bold">{initials(name)}</div>
        <div className="min-w-[140px] flex-1">
          <div className="text-[18px] font-extrabold">{name}</div>
          <div className="text-[13px] text-[color:var(--text-2)]">{client.phone || client.masked_phone || "telefon yo'q"}</div>
        </div>
        {client.purchases_count > 0 && <span className="rounded-full bg-[color:var(--surface-2)] px-3 py-1 text-[11px] font-extrabold">DOIMIY MIJOZ</span>}
        {client.is_blocked && <span className="rounded-full bg-rose px-3 py-1 text-[11px] font-extrabold text-roseink">BLOKLANGAN</span>}
        {onEdit && (
          <button type="button" onClick={onEdit} title="Tahrirlash" aria-label="Mijozni tahrirlash" className="icon-btn !h-8 !w-8">
            <Pencil size={14.5} strokeWidth={1.75} />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} title="O'chirish" aria-label="Mijozni o'chirish" className="icon-btn icon-btn-danger !h-8 !w-8">
            <Trash2 size={14.5} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* CHATGA O'TISH — mijozning AI suhbati bo'lsa, bir bosishda ochiladi */}
      {onOpenChat && conv !== undefined && (
        conv ? (
          <button
            type="button"
            onClick={() => onOpenChat(conv.id)}
            className="mt-4 flex w-full items-center gap-3 rounded-[14px] border p-3 text-left transition-colors duration-150 hover:border-[color:var(--primary)] hover:bg-[var(--hover)]"
            style={{ borderColor: "var(--border)", background: "var(--primary-soft)" }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: "var(--primary)" }}>
              <MessageCircle size={16} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold">Chatga o&apos;tish</span>
              <span className="block truncate text-[12px]" style={{ color: "var(--muted)" }}>
                {conv.last_message?.text || "Suhbatni ochish"}
              </span>
            </span>
            <SourceBadge source={conv.source || conv.channel} />
          </button>
        ) : (
          <p className="mt-4 rounded-[14px] border border-dashed px-3.5 py-2.5 text-[12.5px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            Bu mijoz bilan hali suhbat yo&apos;q — Instagram yoki Telegramdan yozganda shu yerda ko&apos;rinadi.
          </p>
        )
      )}

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Stat v={String(client.purchases_count)} k="Xaridlar" />
        <Stat v={parseFloat(client.total_spent) > 0 ? fmt(client.total_spent) : "—"} k="Jami summa" />
        <Stat v={client.language.toUpperCase()} k="Til" />
      </div>

      {client.notes && (
        <div className="mt-3.5 rounded-[14px] bg-[color:var(--surface-2)] px-4 py-3 text-[13px] leading-relaxed">
          <b>Izoh:</b> {client.notes}
        </div>
      )}

      <div className="mt-4 text-sm font-bold">Buyurtmalar tarixi</div>
      <div className="mt-2.5 flex flex-col gap-2">
        {leads == null && <p className="text-[13px] text-[color:var(--muted)]">Yuklanmoqda…</p>}
        {leads?.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onOpenLead?.(l)}
            className="flex w-full items-center gap-3 rounded-[14px] border border-[color:var(--border)] px-3.5 py-2.5 text-left transition-colors duration-150 hover:border-[color:var(--acc)] hover:bg-[var(--hover)]"
            title="Kanban kartasini ochish"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold" title={l.request_uz || l.request_ru}>{l.request_uz || l.request_ru}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[color:var(--muted)]">
                {fmtTime(l.created_at)} <SourceBadge source={l.source} />
              </div>
            </div>
            <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: "var(--primary)" }}>{fmt(l.estimated_price)}</span>
            {(() => { const bp = statusBadgeProps(l.status, l.status_detail); return <span className={bp.className} style={bp.style}>{statusName(l.status, l.status_detail)}</span>; })()}
          </button>
        ))}
        {leads?.length === 0 && <p className="text-[13px] text-[color:var(--muted)]">Hozircha buyurtma yo&apos;q.</p>}
      </div>
    </Modal>
  );
}
