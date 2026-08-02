"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Ban, Tag, Truck, MapPin, Info } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Drawer, { useDrawerClose } from "./Drawer";
import ConfirmDialog from "./ConfirmDialog";
import PaymentProgressBar from "./PaymentProgressBar";
import { ARRANGEMENT_LABEL } from "./badges";
import { fmt, fmtDate, fmtTime } from "@/lib/format";
import { RESERVATION_STATUS_LABEL, PAYMENT_STATUS_LABEL, FULFILLMENT_LABEL, PAYMENT_METHOD_LABEL, paymentProgress } from "@/lib/reservation";
import type { PaymentMethod, Reservation } from "@/lib/types";

const STATUS_HUE: Record<string, string> = { active: "var(--primary)", fulfilled: "var(--success-ink, #3d8a5f)", cancelled: "var(--muted)" };
const custName = (r: Reservation) => r.customer_detail?.name || r.customer_name || "Mijoz ko'rsatilmagan";
const actor = (u?: { first_name?: string; last_name?: string; username?: string } | null) => u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "" : "Tizim";

const SectionHead = ({ children }: { children: React.ReactNode }) => <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--primary)" }}>{children}</div>;

export default function ReservationDetailDrawer({ reservation, onClose, onChanged }: { reservation: Reservation; onClose: () => void; onChanged: (r: Reservation) => void }) {
  const { showToast } = useStore();
  const router = useRouter();
  const closeAnim = useDrawerClose() ?? onClose;
  const [r, setR] = useState<Reservation>(reservation);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const prog = paymentProgress(r.paid_amount, r.estimated_price);
  const cancelled = r.status === "cancelled";
  // to'lovlar eng yangisi tepada + yugurib boruvchi balans (eskidan yangiga)
  const paysAsc = [...(r.payments ?? [])].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  let run = 0;
  const ledger = paysAsc.map((p) => { run += Math.round(+p.amount || 0); return { p, balance: run }; }).reverse();

  const refresh = async () => { const fresh = await api.reservation(r.id); setR(fresh); onChanged(fresh); return fresh; };

  const doCancel = async () => {
    setCancelBusy(true);
    try { const updated = await api.cancelReservation(r.id); setR(updated); onChanged(updated); showToast("Bron bekor qilindi"); setConfirmCancel(false); }
    catch (e) { showToast(e instanceof ApiError ? e.message : "Bekor qilib bo'lmadi"); }
    finally { setCancelBusy(false); }
  };

  const sellHref = `/katalog?reservation=${r.id}${r.catalog_item ? `&item=${r.catalog_item}` : ""}`;

  return (
    <Drawer onClose={onClose} width={520} title={custName(r)}
      sub={r.customer_detail?.masked_phone || r.customer_phone || undefined}
      badges={
        <>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${STATUS_HUE[r.status]} 15%, transparent)`, color: STATUS_HUE[r.status] }}>{RESERVATION_STATUS_LABEL[r.status]}</span>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--hover)", color: "var(--text-2)" }}>{PAYMENT_STATUS_LABEL[r.payment_status]}</span>
          {r.fulfillment && <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--hover)", color: "var(--text-2)" }}>{r.fulfillment === "delivery" ? <Truck size={11} /> : <Tag size={11} />}{FULFILLMENT_LABEL[r.fulfillment as "delivery" | "pickup"]}</span>}
        </>
      }>
      {/* PAYMENT PROGRESS — imzo element */}
      <div className="rounded-[14px] border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>Bron summasi</span>
          <span className="text-[16px] font-extrabold" style={{ color: "var(--acc)" }}>{fmt(r.estimated_price)}</span>
        </div>
        <PaymentProgressBar paid={r.paid_amount} total={r.estimated_price} />
      </div>

      {/* KEY DATES */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
        <div className="rounded-[11px] border px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Yetkazish sanasi</div>
          <div className="mt-0.5 font-bold tabular-nums">{r.desired_date ? fmtDate(r.desired_date) : "—"}{r.desired_time ? ` · ${r.desired_time.slice(0, 5)}` : ""}</div>
        </div>
        <div className="rounded-[11px] border px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Turi</div>
          <div className="mt-0.5 font-bold">{r.arrangement_type ? ARRANGEMENT_LABEL[r.arrangement_type as "bouquet"] ?? r.arrangement_type : "—"}</div>
        </div>
      </div>

      <SectionHead>So&apos;rov matni</SectionHead>
      <p className="rounded-[12px] px-3.5 py-2.5 text-[13px] leading-relaxed" style={{ background: "var(--surface-2)", color: "var(--text)" }}>{r.request_uz || "—"}</p>
      {r.note && <p className="mt-1.5 text-[12px] italic" style={{ color: "var(--muted)" }}>✎ {r.note}</p>}

      {r.fulfillment === "delivery" && r.delivery_address && (
        <>
          <SectionHead>Yetkazish ma&apos;lumotlari</SectionHead>
          <p className="flex items-start gap-1.5 rounded-[12px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}><MapPin size={14} className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }} /> {r.delivery_address}</p>
        </>
      )}

      {/* PAYMENT HISTORY LEDGER */}
      <SectionHead>To&apos;lovlar tarixi</SectionHead>
      {ledger.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>Hali to&apos;lov qilinmagan. «To&apos;lov qo&apos;shish» orqali zaklad yozing.</p>
      ) : (
        <div className="flex flex-col">
          {ledger.map(({ p, balance }) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--line2)" }}>
              <div className="min-w-0">
                <div className="text-[13px] font-bold tabular-nums">{fmt(p.amount)} <span className="ml-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold align-middle" style={{ background: "var(--hover)", color: "var(--text-2)" }}>{PAYMENT_METHOD_LABEL[p.method]}</span></div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>{fmtTime(p.paid_at || p.created_at)} · {actor(p.created_by_detail)}{p.note ? ` · ${p.note}` : ""}</div>
              </div>
              <div className="shrink-0 text-right text-[11.5px]" style={{ color: "var(--muted)" }}>jami: <b style={{ color: "var(--text-2)" }}>{fmt(balance)}</b></div>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t pt-2 text-[12.5px] font-bold" style={{ borderColor: "var(--border)" }}>
            <span style={{ color: "var(--text-2)" }}>Qolgan</span>
            <span style={{ color: prog.remaining > 0 ? "var(--text)" : "var(--success-ink, #3d8a5f)" }}>{fmt(prog.remaining)}</span>
          </div>
        </div>
      )}

      {/* ACTIONS */}
      {!cancelled && (
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setPayOpen(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold text-white" style={{ background: "var(--primary)" }}><Plus size={15} strokeWidth={2.2} /> To&apos;lov qo&apos;shish</button>
          <button onClick={() => { router.push(sellHref); closeAnim(); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] py-2.5 text-[13px] font-bold" style={{ borderColor: "var(--border-strong)", color: "var(--primary)" }}><Tag size={14} strokeWidth={1.9} /> Katalogdan sotish</button>
          <button onClick={() => setConfirmCancel(true)} className="flex items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 40%, var(--border-strong))", color: "var(--danger-ink)" }}><Ban size={14} strokeWidth={1.9} /> Bekor</button>
        </div>
      )}
      {cancelled && <p className="mt-5 flex items-center gap-1.5 rounded-[12px] border-t pt-4 text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}><Info size={13} /> Bron bekor qilingan — to&apos;lovlar tarixi cashflow&apos;da saqlanib qoladi.</p>}

      {payOpen && <AddPaymentDrawer reservation={r} onClose={() => setPayOpen(false)} onAdded={async () => { setPayOpen(false); await refresh(); showToast("✓ To'lov qo'shildi"); }} />}
      {confirmCancel && (
        <ConfirmDialog
          title="Bronni bekor qilish"
          body={`«${custName(r)}» broni bekor qilinadi (holat → Bekor qilingan). Yozilgan ${(r.payments ?? []).length} ta to'lov TARIXDA saqlanadi — ular cashflow'da qoladi; pulni qaytarish alohida amalga oshiriladi.`}
          confirmLabel="Ha, bekor qilish"
          danger
          busy={cancelBusy}
          onConfirm={doCancel}
          onCancel={() => setConfirmCancel(false)}
        />
      )}
    </Drawer>
  );
}

/** TO'LOV QO'SHISH — nested drawer: summa, usul, izoh. amount>0 majburiy; qoldiqdan oshsa OGOHLANTIRADI (bloklamaydi). */
function AddPaymentDrawer({ reservation, onClose, onAdded }: { reservation: Reservation; onClose: () => void; onAdded: () => void }) {
  const { showToast } = useStore();
  const closeAnim = useDrawerClose() ?? onClose;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const prog = paymentProgress(reservation.paid_amount, reservation.estimated_price);
  const n = Math.round(+amount || 0);
  const exceeds = prog.total > 0 && n > prog.remaining;

  const submit = async () => {
    if (n <= 0) { setErr("Summani kiriting"); return; }
    setBusy(true); setErr(null);
    try { await api.addReservationPayment(reservation.id, { amount: String(n), method, note: note.trim() || undefined }); onAdded(); }
    catch (e) { const d = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : null; setErr(d || (e instanceof ApiError ? e.message : "Yozib bo'lmadi")); setBusy(false); showToast(e instanceof ApiError ? e.message : "Yozib bo'lmadi"); }
  };

  return (
    <Drawer onClose={onClose} width={420} title="To'lov qo'shish" sub={`Qolgan: ${fmt(prog.remaining)}`}>
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>Summa (so&apos;m)</div>
          <input className="inp" type="number" autoFocus value={amount} onChange={(e) => { setAmount(e.target.value); setErr(null); }} placeholder="Masalan: 200000" />
          {exceeds && <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>⚠ Qoldiqdan ({fmt(prog.remaining)}) oshib ketdi — ortiqcha to&apos;lov yoziladi.</p>}
        </div>
        <div>
          <div className="mb-1 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>Usul</div>
          <div className="flex gap-1.5">
            {(["cash", "card", "transfer"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m} className="flex-1 rounded-[11px] border-[1.5px] py-2 text-[13px] font-bold transition-colors" style={method === m ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-2)" }}>{PAYMENT_METHOD_LABEL[m]}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>Izoh (ixtiyoriy)</div>
          <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: Zaklad" />
        </div>
        {err && <p className="whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}
        <div className="mt-1 flex justify-end gap-2.5 max-sm:[&>*]:flex-1">
          <button onClick={() => closeAnim()} className="btn-ghost">Bekor</button>
          <button onClick={submit} disabled={busy || n <= 0} className="btn-primary disabled:opacity-60">{busy ? "Yozilmoqda…" : "Qo'shish"}</button>
        </div>
      </div>
    </Drawer>
  );
}
