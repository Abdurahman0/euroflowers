"use client";
import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import type { BusinessSettings } from "@/lib/types";

/**
 * Sozlamalar: faqat Florist xizmat haqi (single-branch rejim — filiallar yo'q).
 * O'ram/savat narxlari BU YERDA EMAS — ular Sklad → Material sklad'da
 * boshqariladi (foydalanuvchi talabi). Jamoa /xodimlar'da.
 */

export default function SozlamalarPage() {
  const { showToast } = useStore();
  const { canControl } = usePerm();
  const control = canControl("settings");
  const [st, setSt] = useState<BusinessSettings | null>(null);
  const [fee, setFee] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  const [feeEditing, setFeeEditing] = useState(false);

  useEffect(() => {
    api.settings()
      .then((sts) => {
        setSt(sts);
        setFee(String(Math.round(parseFloat(sts.default_florist_fee) || 0)));
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  }, [showToast]);

  const saveFee = async () => {
    if (!st) return;
    setSavingFee(true);
    try {
      const upd = await api.updateSettings({ default_florist_fee: String(+fee || 0) });
      setSt(upd);
      showToast("✓ Florist haqi yangilandi");
      setFeeEditing(false);
    } catch {
      showToast("Saqlab bo'lmadi");
    } finally {
      setSavingFee(false);
    }
  };

  return (
    <div className="grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
      {/* ===== Florist xizmat haqi — yagona narx sozlamasi ===== */}
      <section className="glass p-5">
        <h2 className="text-base font-bold">Florist xizmat haqi</h2>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
          Har bir buket/savatga qo&apos;shiladigan standart xizmat haqi — yangi buyurtma formasi va AI tavsiyalari shu qiymatdan boshlanadi.
        </p>
        <div
          onClick={() => !feeEditing && control && setFeeEditing(true)}
          className={clsx(
            "group mt-4 rounded-[16px] border p-4 transition-colors duration-180",
            control && !feeEditing && "cursor-pointer hover:border-[color:var(--primary)]"
          )}
          style={{ borderColor: feeEditing ? "var(--primary)" : "var(--border)", background: "var(--primary-soft)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-[8px] px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: "var(--primary)" }}>Xizmat haqi</span>
            {control && !feeEditing && (
              <button
                onClick={(e) => { e.stopPropagation(); setFeeEditing(true); }}
                title="Tahrirlash"
                aria-label="Florist haqini tahrirlash"
                className="icon-btn !h-7 !w-7 opacity-60 transition-opacity duration-180 group-hover:opacity-100"
              >
                <Pencil size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
          {feeEditing ? (
            <div className="mt-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                value={fee}
                onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && saveFee()}
                inputMode="numeric"
                autoFocus
                aria-label="Florist xizmat haqi (so'm)"
                className="inp !h-10 min-w-0 flex-1 !px-3 text-right !text-[15px] font-bold"
              />
              <button onClick={saveFee} disabled={savingFee} title="Saqlash" aria-label="Saqlash" className="icon-btn !h-10 !w-10 shrink-0" style={{ color: "var(--success-ink)" }}>
                <Check size={17} strokeWidth={2} />
              </button>
              <button onClick={() => setFeeEditing(false)} title="Bekor" aria-label="Bekor" className="icon-btn icon-btn-danger !h-10 !w-10 shrink-0">
                <X size={17} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <b className="text-[22px] tracking-tight" style={{ color: "var(--primary-strong)" }}>{st ? fmt(st.default_florist_fee) : "—"}</b>
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>har buketga</span>
            </div>
          )}
        </div>
        <p className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>
          O&apos;ram, savat va boshqa material narxlari Sklad → Material sklad bo&apos;limida boshqariladi.
        </p>
      </section>
    </div>
  );
}
