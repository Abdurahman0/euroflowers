"use client";
import clsx from "clsx";
import { fmt, fmtTime, initials } from "@/lib/format";
import Modal from "./Modal";
import { ARRANGEMENT_LABEL, STATUS_LABEL, STATUS_BADGE, SOURCE_BADGE } from "./badges";
import type { Lead, LeadStatus } from "@/lib/types";

const ACTIONS: LeadStatus[] = ["qualified", "contacted", "won", "lost"];

/**
 * Mini-app buyurtma eslatmasi ma'lum tuzilishga ega (📅/📍/🗺/💳/💌 qatorlar) —
 * uni tartibli belgilangan qatorlarga ajratamiz. Yandex havolasi matn sifatida
 * KO'RSATILMAYDI — "Xaritada ochish" tugmasi bo'ladi. Ajratib bo'lmasa null.
 */
const NOTE_ICONS: [string, string][] = [
  ["📅", "Yetkazish"],
  ["📍", "Manzil"],
  ["🗺", "Lokatsiya"],
  ["💳", "To'lov"],
  ["💌", "Kartochka"],
  ["🌸", "Gullar"],
];

function parseMiniAppNote(text: string): { rows: { icon: string; label: string; value: string; href?: string }[]; extra: string } | null {
  if (!/📅|📍|🌸/.test(text)) return null;
  const rows: { icon: string; label: string; value: string; href?: string }[] = [];
  const extra: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const hit = NOTE_ICONS.find(([ic]) => line.startsWith(ic));
    if (!hit) {
      extra.push(line);
      continue;
    }
    const [icon, label] = hit;
    // yorliq qismini olib tashlaymiz: "📅 Yetkazish: ..." -> "..."
    let value = line.slice(icon.length).replace(/^[^:]*:\s*/, "").trim() || line.slice(icon.length).trim();
    let href: string | undefined;
    if (icon === "🗺") {
      href = value.match(/https?:\/\/\S+/)?.[0];
      value = value.replace(/\s*[—–-]?\s*https?:\/\/\S+/, "").trim();
    }
    rows.push({ icon, label, value, href });
  }
  return rows.length ? { rows, extra: extra.join("\n") } : null;
}

/** So'rov matni: mini-app tuzilishi bo'lsa — belgilangan qatorlar, aks holda o'raladigan matn. */
function NoteBlock({ text }: { text: string }) {
  const parsed = parseMiniAppNote(text);
  if (!parsed) {
    return <p className="wrap-anywhere text-[13px] font-semibold leading-relaxed">{text}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {parsed.rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className="w-5 shrink-0 text-center text-[13px]" aria-hidden>{r.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">{r.label}</span>
            {r.icon === "🗺" && r.href ? (
              <a
                href={r.href}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold underline-offset-2 hover:underline"
                style={{ color: "var(--primary)" }}
              >
                Xaritada ochish ↗{r.value ? <span className="font-normal text-[color:var(--muted)]"> · {r.value}</span> : null}
              </a>
            ) : (
              <span className="wrap-anywhere block text-[13px] font-semibold">{r.value}</span>
            )}
          </span>
        </div>
      ))}
      {parsed.extra && <p className="wrap-anywhere text-[13px] leading-relaxed text-[color:var(--text-2)]">{parsed.extra}</p>}
    </div>
  );
}

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
          <div className="text-[13px] text-[color:var(--text-2)]">{lead.customer_detail?.phone || lead.customer_detail?.masked_phone || "telefon yo'q"}</div>
        </div>
        <span className={SOURCE_BADGE(lead.source)}>{lead.source || "—"}</span>
        <span className={STATUS_BADGE[lead.status]}>{STATUS_LABEL[lead.status]}</span>
      </div>

      {/* so'rov — to'liq matn / mini-app tuzilishi */}
      <div className="mt-4 rounded-2xl border border-[color:var(--border)] px-4 py-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--primary)" }}>So&apos;rov</div>
        <NoteBlock text={lead.request_uz || lead.request_ru || "—"} />
      </div>

      <div className="mt-3 rounded-2xl border border-[color:var(--border)]">
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
