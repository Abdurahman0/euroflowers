"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmt, fmtTime, initials } from "@/lib/format";
import Modal from "./Modal";
import { STATUS_BADGE, STATUS_LABEL } from "./badges";
import type { Customer, Lead } from "@/lib/types";

export default function ClientModal({ client, onClose }: { client: Customer; onClose: () => void }) {
  const name = client.name || `@${client.instagram_username || "—"}`;
  const [leads, setLeads] = useState<Lead[] | null>(null);

  useEffect(() => {
    // to'liq tarix — sahifadagi davr filtridan mustaqil
    api.leads({ ordering: "-created_at" })
      .then((ls) => setLeads(ls.filter((l) => l.customer === client.id)))
      .catch(() => setLeads([]));
  }, [client.id]);

  const Stat = ({ v, k }: { v: string; k: string }) => (
    <div className="rounded-[14px] border border-white/25 p-3 text-center">
      <div className="text-[15px] font-extrabold">{v}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/60">{k}</div>
    </div>
  );

  return (
    <Modal onClose={onClose} width={560}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-lg font-extrabold text-white" style={{ background: "linear-gradient(135deg,var(--acc),var(--accL))" }}>{initials(name)}</div>
        <div className="min-w-[140px] flex-1">
          <div className="text-[19px] font-extrabold">{name}</div>
          <div className="text-[13px] text-white/65">
            {client.masked_phone || "telefon yo'q"} · <span style={{ color: "var(--accL)" }}>@{client.instagram_username || "—"}</span>
          </div>
        </div>
        {client.purchases_count > 0 && <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold">DOIMIY MIJOZ</span>}
        {client.is_blocked && <span className="rounded-full bg-rose px-3 py-1 text-[11px] font-extrabold text-roseink">BLOKLANGAN</span>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Stat v={String(client.purchases_count)} k="Xaridlar" />
        <Stat v={parseFloat(client.total_spent) > 0 ? fmt(client.total_spent) : "—"} k="Jami summa" />
        <Stat v={client.language.toUpperCase()} k="Til" />
      </div>

      {client.notes && (
        <div className="mt-3.5 rounded-[14px] bg-white/[.13] px-4 py-3 text-[13px] leading-relaxed">
          <b>Izoh:</b> {client.notes}
        </div>
      )}

      <div className="mt-4 text-sm font-bold">Leadlar tarixi</div>
      <div className="mt-2.5 flex flex-col gap-2">
        {leads == null && <p className="text-[13px] text-white/55">Yuklanmoqda…</p>}
        {leads?.map((l) => (
          <div key={l.id} className="flex items-center gap-3 rounded-[14px] border border-white/25 px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">{l.request_uz || l.request_ru}</div>
              <div className="text-[11.5px] text-white/55">{fmtTime(l.created_at)} · {l.source || "—"}</div>
            </div>
            <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: "var(--accL)" }}>{fmt(l.estimated_price)}</span>
            <span className={STATUS_BADGE[l.status]}>{STATUS_LABEL[l.status]}</span>
          </div>
        ))}
        {leads?.length === 0 && <p className="text-[13px] text-white/55">Hozircha lead yo&apos;q.</p>}
      </div>
    </Modal>
  );
}
