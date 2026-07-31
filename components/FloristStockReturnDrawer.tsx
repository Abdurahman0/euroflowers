"use client";
import { useState } from "react";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import DualQtyInput, { type QtyMode } from "./DualQtyInput";
import StockLine, { lineFromBatchDetail } from "./StockLine";
import { formatStemsAndBunches } from "@/lib/inventory";
import { fmt } from "@/lib/format";
import type { FloristStockBalance } from "@/lib/types";

/**
 * Floristdan QAYTARISH yoki CHIQIT — bitta drawer, `kind` DOIM aniq yuboriladi
 * (waste destruktiv, server default'iga tayanmaymiz). Qaytarish = sklad tiklanadi
 * (sage), chiqit = yo'qoladi (rose) + tasdiq. Sabab chiqitda ko'zga tashlanadi.
 * POST /api/florist-stock-issues/return/ — quantity_stems (butun) yuboriladi.
 */
export default function FloristStockReturnDrawer({
  balance,
  initialKind = "return",
  onClose,
  onDone,
}: {
  balance: FloristStockBalance;
  initialKind?: "return" | "waste";
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useStore();
  const [kind, setKind] = useState<"return" | "waste">(initialKind);
  const [mode, setMode] = useState<QtyMode>("stems");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [confirmWaste, setConfirmWaste] = useState(false);
  const [busy, setBusy] = useState(false);

  const bd = balance.batch_detail;
  const spb = bd?.stems_per_bunch || 1;
  const remaining = balance.remaining_stems;
  const stems = mode === "bunches" ? Math.round((parseFloat(qty) || 0) * spb) : Math.round(parseFloat(qty) || 0);
  const after = remaining - stems;
  const over = stems > remaining;
  const isWaste = kind === "waste";

  const save = async () => {
    if (stems <= 0) return showToast("Miqdorni kiriting");
    if (over) return showToast(`Floristda atigi ${formatStemsAndBunches(remaining, spb)} bor`);
    // CHIQIT qaytarib bo'lmaydi — avval tasdiq
    if (isWaste && !confirmWaste) { setConfirmWaste(true); return; }
    setBusy(true);
    try {
      // ⚠️ kind DOIM yuboriladi
      await api.floristStockReturn({ florist: balance.florist, batch: balance.batch, quantity_stems: stems, kind, reason: reason.trim() || undefined });
      showToast(isWaste ? `✓ Chiqit yozildi: ${stems} dona` : `✓ Skladga qaytdi: ${stems} dona`);
      onDone();
      onClose();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  const hue = isWaste ? "var(--danger-ink)" : "var(--success-ink, #3d8a5f)";

  return (
    <Modal onClose={onClose} width={440}>
      <ModalHeader
        icon={isWaste ? <Trash2 size={19} strokeWidth={1.8} /> : <RotateCcw size={19} strokeWidth={1.8} />}
        title={isWaste ? "Chiqit (so'lgan gul)" : "Skladga qaytarish"}
        sub={balance.florist_name}
        onClose={onClose}
      />

      <div className="mt-2 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
        <StockLine data={lineFromBatchDetail(bd)} right={<span className="text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{formatStemsAndBunches(remaining, spb)}</span>} />
      </div>

      {/* KIND — sage(qaytarish) / rose(chiqit); semantik farq ko'zga tashlanadi */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {([
          { k: "return" as const, label: "Qaytarish", icon: RotateCcw, hint: "Sklad tiklanadi" },
          { k: "waste" as const, label: "Chiqit", icon: Trash2, hint: "Skladga qaytmaydi" },
        ]).map((o) => {
          const on = kind === o.k;
          const oh = o.k === "waste" ? "var(--danger-ink)" : "var(--success-ink, #3d8a5f)";
          const Ico = o.icon;
          return (
            <button key={o.k} type="button" onClick={() => { setKind(o.k); setConfirmWaste(false); }} aria-pressed={on}
              className="flex flex-col items-start gap-0.5 rounded-[13px] border-[1.5px] px-3 py-2 text-left transition-colors"
              style={on ? { borderColor: oh, background: `color-mix(in srgb, ${oh} 12%, transparent)` } : { borderColor: "var(--border)" }}>
              <span className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: on ? oh : "var(--text-2)" }}><Ico size={14} strokeWidth={2} /> {o.label}</span>
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>{o.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <DualQtyInput mode={mode} value={qty} stemsPerBunch={spb} onMode={setMode} onValue={(v) => { setQty(v); setConfirmWaste(false); }} label="Miqdor" autoFocus />
        <div className="rounded-[12px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: over ? "var(--danger-soft, rgba(160,74,74,.12))" : "var(--surface-2)", color: over ? "var(--danger-ink)" : "var(--text-2)" }}>
          {stems > 0
            ? over
              ? `Floristda atigi ${formatStemsAndBunches(remaining, spb)} bor`
              : <>Qoldiq: {remaining.toLocaleString("ru")} → <b style={{ color: hue }}>{after.toLocaleString("ru")}</b> dona</>
            : `Joriy: ${formatStemsAndBunches(remaining, spb)}`}
        </div>

        {/* SABAB — chiqitda ko'zga tashlanadi (qaytarib bo'lmaydigan yo'qotish) */}
        <Field label={isWaste ? "Sabab (chiqit sababi — keyin kerak bo'ladi)" : "Sabab (ixtiyoriy)"} span>
          <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={isWaste ? "Masalan: so'lib qoldi, sindi" : "Masalan: ortib qoldi"}
            style={isWaste ? { borderColor: "color-mix(in srgb, var(--danger-ink) 45%, var(--border))" } : undefined} />
        </Field>

        {isWaste && confirmWaste && (
          <div className="flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
            <AlertTriangle size={16} strokeWidth={2} className="mt-px shrink-0" />
            <span>Chiqit qaytarib bo&apos;lmaydi — {stems} dona yo&apos;qotilgan deb yoziladi. Tasdiqlaysizmi?</span>
          </div>
        )}
      </div>

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy || over || stems <= 0}
          className={clsx("disabled:opacity-60", isWaste ? "btn-primary !bg-[var(--danger-ink)]" : "btn-primary")}>
          {busy ? "Saqlanmoqda…" : isWaste ? (confirmWaste ? "Ha, chiqit qilish" : "Chiqit") : "Qaytarish"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
