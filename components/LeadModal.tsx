"use client";
import clsx from "clsx";
import { fmt, fmtTime, initials } from "@/lib/format";
import Modal from "./Modal";
import { ARRANGEMENT_LABEL, STATUS_LABEL, STATUS_BADGE, SOURCE_BADGE } from "./badges";
import type { Lead, LeadStatus } from "@/lib/types";

const ACTIONS: LeadStatus[] = ["qualified", "contacted", "won", "lost"];

export default function LeadModal({ lead, onClose, onStatus }: { lead: Lead; onClose: () => void; onStatus: (st: LeadStatus) => void }) {
  const name = lead.customer_detail?.name || `@${lead.customer_detail?.instagram_username ?? "—"}`;

  const Row = ({ k, v, accent }: { k: string; v: string; accent?: boolean }) => (
    <div className="flex justify-between gap-3.5 border-t border-[color:var(--border)] px-4 py-3 first:border-t-0">
      <span className="text-[13px] text-[color:var(--text-2)]">{k}</span>
      <span className={clsx("text-right text-[13px] font-semibold", accent && "font-extrabold")} style={accent ? { color: "var(--primary)" } : undefined}>{v}</span>
    </div>
  );

  return (
    <Modal onClose={onClose} width={560}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-lg font-extrabold text-white" style={{ background: "linear-gradient(135deg,var(--acc),var(--accL))" }}>{initials(name)}</div>
        <div className="min-w-[140px] flex-1">
          <div className="text-[18px] font-extrabold">{name}</div>
          <div className="text-[13px] text-[color:var(--text-2)]">{lead.customer_detail?.masked_phone || "telefon yo'q"}</div>
        </div>
        <span className={SOURCE_BADGE(lead.source)}>{lead.source || "—"}</span>
        <span className={STATUS_BADGE[lead.status]}>{STATUS_LABEL[lead.status]}</span>
      </div>

      <div className="mt-4 rounded-2xl border border-[color:var(--border)]">
        <Row k="So'rov" v={lead.request_uz || lead.request_ru || "—"} />
        <Row k="Taxminiy narx" v={fmt(lead.estimated_price)} accent />
        <Row k="Turi" v={lead.arrangement_type ? ARRANGEMENT_LABEL[lead.arrangement_type] ?? lead.arrangement_type : "—"} />
        <Row k="Instagram" v={lead.customer_detail?.instagram_username ? `@${lead.customer_detail.instagram_username}` : "—"} />
        <Row k="Filial" v={lead.branch_detail?.name ?? "—"} />
        <Row k="Kerakli sana" v={lead.desired_date ?? "—"} />
        <Row k="Tushgan vaqti" v={fmtTime(lead.created_at)} />
      </div>

      {lead.conversation != null && (
        <div className="mt-3.5 rounded-[14px] bg-[color:var(--surface-2)] px-4 py-3 text-[13px] leading-relaxed">
          Bu lead #{lead.conversation}-suhbatdan tushgan — AI chatlar bo&apos;limida to&apos;liq yozishmani ko&apos;rish mumkin.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {ACTIONS.map((st) => (
          <button key={st} onClick={() => onStatus(st)} className="min-w-[100px] flex-1 rounded-xl border-[1.5px] border-[color:var(--border-strong)] py-2.5 text-[13px] font-bold" style={lead.status === st ? { background: "var(--acc)", borderColor: "var(--acc)", color: "#fff" } : undefined}>
            {STATUS_LABEL[st]}
          </button>
        ))}
      </div>
    </Modal>
  );
}
