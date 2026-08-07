"use client";
import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import PasswordCard from "@/components/PasswordCard";
import type { BusinessSettings } from "@/lib/types";
import { OPERATOR_FIELDS, operatorPayload, operatorDirty, type OperatorContact } from "@/lib/aiAlbum";
import { Headset } from "lucide-react";

/**
 * Sozlamalar: Florist xizmat haqi (single-branch rejim — filiallar yo'q) va
 * o'z parolini almashtirish. O'ram/savat narxlari BU YERDA EMAS — ular
 * Sklad → Material sklad'da boshqariladi. Jamoa /xodimlar'da.
 */

export default function SozlamalarPage() {
  const { showToast } = useStore();
  const { canControl, canView } = usePerm();
  const control = canControl("settings");
  const seeSettings = canView("settings");
  const [st, setSt] = useState<BusinessSettings | null>(null);
  const [fee, setFee] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  const [feeEditing, setFeeEditing] = useState(false);
  // ⚠️ OPERATOR ALOQASI — uchta ERKIN MATN maydoni (vaqtga maska/format YO'Q:
  // «har kuni 08:00 - 00:00» ham to'g'ri, AI uni o'zgartirmasdan aytadi).
  const [op, setOp] = useState<OperatorContact>({ operator_phone: "", operator_hours: "", operator_hours_ru: "" });
  const [savingOp, setSavingOp] = useState(false);

  useEffect(() => {
    if (!seeSettings) return; // ruxsat yo'q — faqat parol bo'limi ko'rinadi
    api.settings()
      .then((sts) => {
        setSt(sts);
        setFee(String(Math.round(parseFloat(sts.default_florist_fee) || 0)));
        setOp({
          operator_phone: sts.operator_phone ?? "",
          operator_hours: sts.operator_hours ?? "",
          operator_hours_ru: sts.operator_hours_ru ?? "",
        });
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  }, [showToast, seeSettings]);

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

  const opDirty = operatorDirty(st, op);
  const saveOperator = async () => {
    if (!st || !opDirty) return;
    setSavingOp(true);
    try {
      // ⚠️ FAQAT O'ZGARGAN kalitlar (lib/aiAlbum.ts — operatorPayload)
      const upd = await api.updateSettings(operatorPayload(st, op));
      setSt(upd);
      setOp({
        operator_phone: upd.operator_phone ?? "",
        operator_hours: upd.operator_hours ?? "",
        operator_hours_ru: upd.operator_hours_ru ?? "",
      });
      showToast("✓ Operator aloqasi yangilandi");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSavingOp(false);
    }
  };

  return (
    <div className="grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
      {/* ===== Florist xizmat haqi — yagona narx sozlamasi ===== */}
      <section className="glass p-5" hidden={!seeSettings}>
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

      {/* ===== Parol — har bir foydalanuvchi o'ziniki ===== */}
      {/* ===== OPERATOR ALOQASI — AI mijozni operatorga ulaganda aytadigan ma'lumot =====
          ⚠️ Bu «Do'kon ish vaqti» (working_hours) va do'kon telefoni (shop_phone) BILAN
          BIR XIL EMAS. Jonli ma'lumot buni ochiq ko'rsatadi:
            working_hours  = «24/7, kunu tun ochiq»   ← do'kon ochiq bo'lgan vaqt
            operator_hours = «08:00 dan 00:00 gacha»  ← admin telefonga javob beradigan vaqt
          Hozir shop_phone bilan operator_phone qiymati TASODIFAN bir xil — shuning uchun
          kimdir «takror» deb o'ylab birlashtirib yubormasligi kerak. AI ularni ATAYLAB
          ajratib ishlatadi. */}
      <section className="glass p-5" hidden={!seeSettings}>
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Headset size={17} strokeWidth={1.9} style={{ color: "var(--primary)" }} /> Operator aloqasi
        </h2>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
          AI mijozni operatorga ulaganda shu raqamni va vaqtni aytadi. <b>Do&apos;kon ish vaqtidan alohida</b> —
          do&apos;kon ochiq bo&apos;lgan vaqt boshqa, administrator telefonga javob beradigan vaqt boshqa.
        </p>

        <div className="mt-3 flex flex-col gap-3">
          {([
            ["operator_phone", "Aloqa raqami", "+998 88 009 33 30"],
            ["operator_hours", "Navbatchilik", "08:00 dan 00:00 gacha"],
            ["operator_hours_ru", "Navbatchilik (RU)", "с 08:00 до 00:00"],
          ] as const).map(([k, label, ph]) => (
            <label key={k} className="flex flex-col gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              {label}
              {control ? (
                /* ⚠️ ERKIN MATN — vaqt tanlagich ham, maska ham YO'Q (spec talabi) */
                <input className="inp" value={op[k]} onChange={(e) => setOp({ ...op, [k]: e.target.value })}
                  placeholder={ph} maxLength={64} inputMode="text" />
              ) : (
                /* ruxsatsiz foydalanuvchi — FAQAT KO'RISH (GET hammaga ochiq) */
                <div className="inp flex items-center" style={{ background: "var(--surface-2)", color: op[k] ? "var(--text)" : "var(--muted)" }}>
                  {op[k] || "—"}
                </div>
              )}
            </label>
          ))}
        </div>

        {control && (
          <div className="mt-3 flex items-center justify-end gap-2">
            {opDirty && (
              <button type="button" onClick={() => setOp({
                operator_phone: st?.operator_phone ?? "", operator_hours: st?.operator_hours ?? "", operator_hours_ru: st?.operator_hours_ru ?? "",
              })} className="btn-ghost">Bekor</button>
            )}
            <button type="button" onClick={saveOperator} disabled={!opDirty || savingOp}
              className={clsx("btn-primary !flex-none px-5 disabled:opacity-60", savingOp && "btn-loading")}>
              Saqlash
            </button>
          </div>
        )}
        {!control && (
          <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>Tahrirlash uchun «Sozlamalar» ruxsati kerak.</p>
        )}
      </section>

      <PasswordCard />
    </div>
  );
}
