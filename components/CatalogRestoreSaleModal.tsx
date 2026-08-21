"use client";
import { useState } from "react";
import { RotateCcw, Info } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalHeader, ModalFooter, Field } from "./Modal";
import { fmt } from "@/lib/format";
import type { CatalogSaleRow } from "@/lib/types";

/**
 * SOTUVNI QAYTARISH — POST /api/catalog/{id}/restore-sale/ (backend 21.08.2026).
 *
 * ⚠️ NIMA QAYTADI: katalogning `quantity_sold` kamayadi va qoldiq bo'lsa yozuv yana
 *    «Sotuvda» bo'ladi; sotuvda ishlatilgan QO'SHIMCHA material skladga qaytadi;
 *    florist/oformleniya haqi va qarz PROPORSIONAL kamayadi; hisob-kitob raqamlari
 *    o'zi to'g'rilanadi.
 * ⚠️ GUL SKLADIGA TEGMAYDI — gul katalog YARATILGANDA yechilgan, sotuvda emas.
 *    Shu bois «qaytarish» gul qoldig'ini oshirmaydi (spec «Muhim eslatma»).
 *
 * ⚠️ Yozuv yo'li JONLI SINALMAGAN (loyiha qoidasi: faqat GET).
 */
export default function CatalogRestoreSaleModal({
  sale, onClose, onDone,
}: { sale: CatalogSaleRow; onClose: () => void; onDone: () => void }) {
  const { showToast } = useStore();
  const sold = Math.max(Number(sale.quantity) || 1, 1);
  const [qty, setQty] = useState(String(sold));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const n = Math.floor(+qty || 0);
  const unit = sold > 0 ? Math.round(+(sale.sale_total ?? 0) / sold) : 0;
  const back = Math.max(Math.min(n, sold), 0) * unit;

  const submit = async () => {
    setErr("");
    if (n < 1 || n > sold) return setErr(`Bu sotuvda ${sold} ta bor — 1 dan ${sold} gacha kiriting`);
    setBusy(true);
    try {
      await api.restoreCatalogSale(sale.catalog_item, {
        // ⚠️ AYNAN SHU sotuv qaytariladi: `sale_history` berilmasa server OXIRGISINI qaytarardi
        sale_history: sale.id,
        quantity: n,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      showToast(`✓ ${n} ta sotuv qaytarildi`);
      onDone();
    } catch (e) {
      // backend `detail` matni aniq: «Qaytariladigan sotuv topilmadi» / «Bu sotuvda atigi 1 ta bor»
      const msg = e instanceof ApiError ? e.message : "Qaytarib bo'lmadi";
      setErr(msg);
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={440}>
      <ModalHeader
        icon={<RotateCcw size={19} strokeWidth={1.8} />}
        title="Sotuvni qaytarish"
        sub={`${sale.catalog_name} · ${sold} ta · ${fmt(sale.sale_total)}`}
        onClose={onClose}
      />

      <p className="mt-2 flex items-start gap-1.5 rounded-[11px] px-3 py-2 text-[12px] font-semibold leading-snug"
        style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
        <Info size={13} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--primary)" }} />
        <span>
          Mahsulot yana sotuvga qaytadi, hisob-kitobdan bu summa chiqadi.
          {" "}<b>Gul skladiga tegmaydi</b> — gul katalog yaratilganda yechilgan.
        </span>
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {/* ⚠️ Faqat bittalik sotuvda son so'ralmaydi (spec: quantity > 1 bo'lsa) */}
        {sold > 1 ? (
          <Field label={`Nechta qaytariladi (1–${sold})`}>
            <input className="inp" type="number" min={1} max={sold} value={qty}
              onChange={(e) => { setQty(e.target.value); setErr(""); }} autoFocus />
          </Field>
        ) : (
          <Field label="Nechta qaytariladi">
            <div className="inp flex items-center" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>1 ta (butun sotuv)</div>
          </Field>
        )}
        <Field label="Qaytadigan summa">
          <div className="inp flex items-center font-bold tabular-nums" style={{ background: "var(--surface-2)", color: "var(--acc)" }}>
            {fmt(back)}
          </div>
        </Field>
        <Field label="Sabab (tavsiya etiladi)" span>
          <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: operator xato bosgan" autoFocus={sold === 1} />
        </Field>
      </div>

      {err && (
        <p className="mt-2 rounded-md px-3 py-2 text-[12px] font-semibold"
          style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={submit} disabled={busy} className={`btn-primary disabled:opacity-60 ${busy ? "btn-loading" : ""}`}>
          Qaytarish
        </button>
      </ModalFooter>
    </Modal>
  );
}
