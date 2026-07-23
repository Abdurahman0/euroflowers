"use client";
import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fmt, fmtDate, fmtTime, initials } from "@/lib/format";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import Modal from "./Modal";
import { StockUsagePicker, MaterialUsagePicker, batchLabel, type PackRow, type StockRow } from "./UsagePicker";
import { ARRANGEMENT_LABEL, statusBadgeProps, statusName, SOURCE_BADGE } from "./badges";
import type { Lead, LeadStatus, LeadStatusDef, Packaging, StockBatch } from "@/lib/types";

// zaxira amallar — statuslar prop kelmasa (eski chaqiruvlar uchun)
const FALLBACK_ACTIONS: { key: string; name_uz: string }[] = [
  { key: "contacted", name_uz: "Aloqada" },
  { key: "won", name_uz: "Sotildi" },
  { key: "lost", name_uz: "Bekor" },
];

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

export default function LeadModal({
  lead,
  statuses,
  onClose,
  onStatus,
  onUpdated,
  onEdit,
  onDelete,
}: {
  lead: Lead;
  /** dinamik statuslar (backend) — amal tugmalari shulardan chiziladi */
  statuses?: LeadStatusDef[];
  onClose: () => void;
  onStatus: (st: LeadStatus) => void;
  onUpdated?: (l: Lead) => void;
  /** to'liq tahrirlash oynasini ochadi (sahifa boshqaradi) */
  onEdit?: () => void;
  /** o'chirish tasdig'ini ochadi (sahifa boshqaradi) */
  onDelete?: () => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const { canControl } = usePerm();
  const control = canControl("crm");
  const name = lead.customer_detail?.name || `@${lead.customer_detail?.instagram_username ?? "—"}`;

  const stockUsage = lead.stock_usage ?? [];
  const packUsage = lead.packaging_usage ?? [];
  const hasUsage = stockUsage.length > 0 || packUsage.length > 0;
  const deducted = !!lead.stock_deducted_at;

  // sarfni tahrirlash — «Sotildi»gacha; backend won'da shu qatorlar bo'yicha kamaytiradi
  const [editing, setEditing] = useState(false);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [materials, setMaterials] = useState<Packaging[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [packRows, setPackRows] = useState<PackRow[]>([]);
  const [fee, setFee] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmWon, setConfirmWon] = useState(false);

  // ro'yxatlar tahrirlash uchun ham, detail'siz kelgan sarf qatorlari nomini
  // ko'rsatish uchun ham kerak (backend batch_detail bermasa — o'zimiz topamiz)
  const needLists = editing || stockUsage.some((u) => !u.batch_detail) || packUsage.some((u) => !u.packaging_detail);
  useEffect(() => {
    if (!needLists) return;
    api.stockBatches({ is_active: true }).then(setBatches).catch(() => {});
    api.materials({ is_active: true }).then(setMaterials).catch(() => {});
  }, [needLists]);

  const stockLabel = (u: (typeof stockUsage)[number]) => {
    if (u.batch_detail) return batchLabel(u.batch_detail);
    const b = batches.find((x) => x.id === u.stock_batch);
    return b ? batchLabel(b) : `Partiya #${u.stock_batch}`;
  };
  const packLabel = (u: (typeof packUsage)[number]) => {
    const d = u.packaging_detail ?? materials.find((x) => x.id === u.packaging);
    return d ? d.name_uz || d.name_ru : `Material #${u.packaging}`;
  };

  const startEdit = () => {
    setStockRows(stockUsage.map((u) => ({ stock_batch: u.stock_batch, quantity_stems: u.quantity_stems })));
    setPackRows(packUsage.map((u) => ({ packaging: u.packaging, quantity: u.quantity })));
    setFee(lead.florist_fee ? String(Math.round(+lead.florist_fee)) : "");
    setEditing(true);
  };

  const saveUsage = async () => {
    setSaving(true);
    try {
      let upd = await api.updateLead(lead.id, {
        florist_fee: fee ? String(+fee) : null,
        stock_usage_input: stockRows.map((r) => {
          const b = batches.find((x) => x.id === r.stock_batch);
          const perBunch = b?.stems_per_bunch || 0;
          return {
            stock_batch: r.stock_batch,
            quantity_stems: r.quantity_stems,
            ...(perBunch > 0 ? { quantity_bunches: (r.quantity_stems / perBunch).toFixed(2) } : {}),
          };
        }),
        packaging_usage_input: packRows,
      });
      // ba'zi javoblarda sarf qatorlari kelmasligi mumkin — leadni qayta o'qiymiz,
      // u ham bermasa lokal qatorlardan tiklaymiz: qo'shilgan sarf DARHOL ko'rinsin
      if ((stockRows.length && !upd.stock_usage?.length) || (packRows.length && !upd.packaging_usage?.length)) {
        upd = await api.lead(lead.id).catch(() => upd);
      }
      if (stockRows.length && !upd.stock_usage?.length) {
        upd = {
          ...upd,
          stock_usage: stockRows.map((r) => ({
            stock_batch: r.stock_batch,
            quantity_stems: r.quantity_stems,
            batch_detail: batches.find((b) => b.id === r.stock_batch),
          })),
        };
      }
      if (packRows.length && !upd.packaging_usage?.length) {
        upd = {
          ...upd,
          packaging_usage: packRows.map((r) => ({
            packaging: r.packaging,
            quantity: r.quantity,
            packaging_detail: materials.find((m) => m.id === r.packaging),
          })),
        };
      }
      showToast("✓ Sklad sarfi saqlandi");
      setEditing(false);
      onUpdated?.(upd);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Sarfni saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const clickStatus = (st: LeadStatus) => {
    // «Sotildi»da backend skladdan avtomatik yechadi — sarf bo'sh bo'lsa ogohlantirib,
    // ikkinchi bosishda davom etamiz
    if (st === "won" && lead.status !== "won" && !hasUsage && !confirmWon) {
      setConfirmWon(true);
      showToast("Diqqat: sarf kiritilmagan — sklad kamaymaydi. Davom etish uchun yana bosing");
      return;
    }
    setConfirmWon(false);
    onStatus(st);
  };

  const Row = ({ k, v, accent }: { k: string; v: string; accent?: boolean }) => (
    <div className="flex justify-between gap-3.5 border-t border-[color:var(--border)] px-4 py-3 first:border-t-0">
      <span className="text-[13px] text-[color:var(--text-2)]">{k}</span>
      <span className={clsx("text-right text-[13px] font-semibold", accent && "font-extrabold")} style={accent ? { color: "var(--primary)" } : undefined}>{v}</span>
    </div>
  );

  return (
    <Modal onClose={onClose} width={560}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="avatar-lead flex h-[52px] w-[52px] shrink-0 -rotate-3 items-center justify-center rounded-2xl text-lg font-bold">{initials(name)}</div>
        <div className="min-w-[140px] flex-1">
          <div className="text-[18px] font-extrabold">{name}</div>
          <div className="text-[13px] text-[color:var(--text-2)]">{lead.customer_detail?.phone || lead.customer_detail?.masked_phone || "telefon yo'q"}</div>
        </div>
        <span className={SOURCE_BADGE(lead.source)}>{lead.source || "—"}</span>
        {(() => {
          const det = lead.status_detail ?? statuses?.find((s) => s.key === lead.status);
          const bp = statusBadgeProps(lead.status, det);
          return <span className={bp.className} style={bp.style}>{statusName(lead.status, det)}</span>;
        })()}
      </div>

      {/* so'rov — to'liq matn / mini-app tuzilishi */}
      <div className="mt-4 rounded-2xl border border-[color:var(--border)] px-4 py-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--primary)" }}>So&apos;rov</div>
        <NoteBlock text={lead.request_uz || lead.request_ru || "—"} />
      </div>

      {/* sklad sarfi — won bo'lganda backend shu qatorlar bo'yicha kamaytiradi */}
      <div className="mt-3 rounded-2xl border border-[color:var(--border)] px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--primary)" }}>Sklad sarfi</span>
          {deducted ? (
            <span className="rounded-full bg-mint px-2.5 py-0.5 text-[11px] font-bold text-mintink">✓ Skladdan yechildi · {fmtTime(lead.stock_deducted_at)}</span>
          ) : control && !editing ? (
            <button type="button" onClick={startEdit} className="text-[12px] font-semibold underline-offset-2 hover:underline" style={{ color: "var(--primary)" }}>
              {hasUsage ? "Tahrirlash" : "Sarf kiritish"}
            </button>
          ) : null}
        </div>

        {!editing && (
          <>
            {hasUsage ? (
              <div className="flex flex-col gap-1">
                {stockUsage.map((u, i) => (
                  <div key={`s${i}`} className="flex justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate">🌸 {stockLabel(u)}</span>
                    <span className="shrink-0 font-semibold">{u.quantity_stems} dona</span>
                  </div>
                ))}
                {packUsage.map((u, i) => (
                  <div key={`p${i}`} className="flex justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate">🧺 {packLabel(u)}</span>
                    <span className="shrink-0 font-semibold">{u.quantity} dona</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px]" style={{ color: "var(--muted)" }}>Sarf kiritilmagan.</p>
            )}
            {!deducted && !hasUsage && lead.status !== "won" && (
              <p className="mt-2 rounded-[11px] bg-peach px-3 py-2 text-[12.5px] font-semibold leading-snug text-peachink">
                ⚠ «Sotildi» qilishdan oldin gul/material sarfini kiriting — sklad qoldig&apos;i avtomatik kamayishi uchun.
              </p>
            )}
          </>
        )}

        {editing && (
          <div className="flex flex-col gap-3">
            <StockUsagePicker batches={batches.filter((b) => b.remaining_stems > 0)} rows={stockRows} onChange={setStockRows} />
            <MaterialUsagePicker materials={materials} rows={packRows} onChange={setPackRows} />
            <label className="flex items-center justify-between gap-3 text-[13px]">
              <span style={{ color: "var(--text-2)" }}>Florist haqi (so&apos;m)</span>
              <input className="inp !w-[130px] text-right" type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="50000" />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={saveUsage} disabled={saving} className="btn-primary !flex-none !px-4 !py-2 text-[13px] disabled:opacity-60">
                {saving ? "Saqlanmoqda…" : "Sarfni saqlash"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-[12px] border border-[color:var(--border-strong)] px-4 py-2 text-[13px] font-bold">
                Bekor
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-[color:var(--border)]">
        <Row k="Taxminiy narx" v={fmt(lead.estimated_price)} accent />
        {lead.florist_fee != null && +lead.florist_fee > 0 && <Row k="Florist haqi" v={fmt(lead.florist_fee)} />}
        <Row k="Turi" v={lead.arrangement_type ? ARRANGEMENT_LABEL[lead.arrangement_type] ?? lead.arrangement_type : "—"} />
        <Row k="Instagram" v={lead.customer_detail?.instagram_username ? `@${lead.customer_detail.instagram_username}` : "—"} />
        <Row k="Yetkazish vaqti" v={lead.delivery_at ? fmtTime(lead.delivery_at) : fmtDate(lead.desired_date)} accent={!!lead.delivery_at} />
        {lead.recall_at && (
          <Row
            k="Qo'ng'iroq eslatmasi"
            v={`${fmtTime(lead.recall_at)}${lead.recall_sent_at ? ` · yuborildi ${fmtTime(lead.recall_sent_at)}` : ""}`}
          />
        )}
        <Row k="Tushgan vaqti" v={fmtTime(lead.created_at)} />
      </div>

      {lead.conversation != null && (
        <div className="mt-3.5 rounded-[14px] bg-[color:var(--surface-2)] px-4 py-3 text-[13px] leading-relaxed">
          Bu buyurtma #{lead.conversation}-suhbatdan tushgan — AI chatlar bo&apos;limida to&apos;liq yozishmani ko&apos;rish mumkin.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(statuses?.filter((s) => s.key !== "new") ?? FALLBACK_ACTIONS).map((sdef) => {
          const st = sdef.key;
          const color = "color" in sdef ? (sdef as LeadStatusDef).color : undefined;
          const active = lead.status === st;
          return (
            <button
              key={st}
              onClick={() => clickStatus(st)}
              className="min-w-[100px] flex-1 rounded-xl border-[1.5px] border-[color:var(--border-strong)] py-2.5 text-[13px] font-bold"
              style={
                active
                  ? { background: color ?? "var(--acc)", borderColor: color ?? "var(--acc)", color: "#fff" }
                  : st === "won" && confirmWon
                    ? { borderColor: "var(--acc)", color: "var(--acc)" }
                    : color
                      ? { borderColor: `color-mix(in srgb, ${color} 45%, var(--border-strong))` }
                      : undefined
              }
            >
              {st === "won" && confirmWon && lead.status !== "won" ? "Baribir sotildi?" : sdef.name_uz}
            </button>
          );
        })}
      </div>

      {/* tahrirlash / o'chirish — faqat boshqarish ruxsati bilan */}
      {control && (onEdit || onDelete) && (
        <div className="mt-3 flex gap-2 border-t border-[color:var(--border)] pt-3">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[color:var(--border-strong)] py-2.5 text-[13px] font-bold transition-colors duration-150 hover:border-[color:var(--acc)]"
            >
              <Pencil size={14} strokeWidth={1.75} /> Tahrirlash
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] py-2.5 text-[13px] font-bold transition-colors duration-150 hover:bg-[color:var(--hover)]"
              style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 40%, var(--border-strong))", color: "var(--danger-ink)" }}
            >
              <Trash2 size={14} strokeWidth={1.75} /> O&apos;chirish
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
