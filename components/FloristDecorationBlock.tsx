"use client";
import { useState } from "react";
import { Info, Plus, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import { todayTashkent } from "@/lib/backdate";
import DatePicker from "./DatePicker";
import {
  decorationCheck, buildDecorationPayload, decorationOutcome, isOwnProfile,
} from "@/lib/decoration";
import type { FloristProfile } from "@/lib/types";

/**
 * OFORMLENIYA HAQI — qo'lda yoziladigan oformleniya (spec §1).
 *
 * ⚠️ NARX MAYDONI BU YERDA TAKRORLANMAYDI. `decoration_fee` ALLAQACHON
 * `FloristModal` da tahrirlanadi (florist yaratish/tahrirlash formasi). Ikkinchi
 * input qo'ysak ikki joyda ikki xil qiymat ko'rinib qolardi — shu bois bu blok
 * narxni faqat KO'RSATADI va o'sha yagona formaga yuboradi.
 *
 * ⚠️ FLORIST O'ZIGA YOZA OLMAYDI — server 403 (spec §7). Buni oldindan aniqlab,
 * formani UMUMAN chizmaymiz: doim xato beradigan tugma ko'rsatishdan yaxshiroq.
 */
export default function FloristDecorationBlock({
  florist, canControl, onAdded, onEditFee,
}: {
  florist: FloristProfile;
  canControl: boolean;
  /** yozuv qo'shilgach — oylik ro'yxati va statistikani QAYTA yuklash */
  onAdded: () => void;
  /** narxni o'zgartirish — mavjud florist formasini ochadi */
  onEditFee: () => void;
}) {
  const { showToast } = useStore();
  const meUserId = useStore((s) => s.user?.id ?? null);
  const own = isOwnProfile(florist, meUserId);

  const [count, setCount] = useState("");
  const [workDate, setWorkDate] = useState(todayTashkent());
  const [override, setOverride] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string[]>([]);

  const chk = decorationCheck({ florist, count, override });
  const fee = Math.round(+(florist.decoration_fee ?? 0)) || 0;

  const add = async () => {
    if (!chk.ok || busy) return;   // ⚠️ ikki marta yuborishdan himoya
    setBusy(true); setErr([]);
    try {
      const { status, data } = await api.addFloristDecoration(florist.id, buildDecorationPayload({ count, workDate, override, note }));
      // ⚠️ 200 va 201 FARQI operatorga AYTILADI (spec §4)
      showToast(decorationOutcome(status, data));
      setCount(""); setNote(""); setOverride("");
      onAdded();
    } catch (e) {
      const ae = e as ApiError;
      setErr(String(ae?.message ?? "Qo'shib bo'lmadi").split("\n"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass !rounded-[18px] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[14px] font-bold">
          <Sparkles size={15} strokeWidth={2} style={{ color: "var(--acc)" }} /> Oformleniya haqi
        </span>
      </div>

      {/* ── NARX (yagona manba: florist formasi) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
          Oformleniya narxi
          <b className="ml-2 text-[14px]" style={{ color: fee > 0 ? "var(--acc)" : "var(--danger-ink)" }}>
            {fee > 0 ? `${fmt(fee)} / dona` : "belgilanmagan"}
          </b>
        </span>
        {canControl && !own && (
          <button type="button" onClick={onEditFee} className="btn-secondary btn-sm">O&apos;zgartirish</button>
        )}
      </div>
      <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug" style={{ color: "var(--muted)" }}>
        <Info size={11} strokeWidth={2} className="mt-px shrink-0" />
        Narx o&apos;zgarsa faqat <b>keyingi</b> yozuvlarga ta&apos;sir qiladi — oldin yozilganlar o&apos;zgarmaydi.
      </p>

      {/* ⚠️ O'ZINGIZGA yoza olmaysiz — forma umuman chizilmaydi */}
      {own ? (
        <p className="mt-3 rounded-md px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
          O&apos;z profilingizga oformleniya haqi yoza olmaysiz — buni boshqa administrator yozadi.
        </p>
      ) : !canControl ? (
        <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>Yozish uchun «Floristlar» ruxsati kerak.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              Nechta qildi
              <input className="inp" inputMode="numeric" value={count} placeholder="Masalan: 3"
                onChange={(e) => { setCount(e.target.value.replace(/\D/g, "")); setErr([]); }} />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              Sana
              <DatePicker value={workDate} onChange={setWorkDate} maxDate={todayTashkent()} ariaLabel="Ish sanasi" />
            </label>
            <label className="col-span-full flex flex-col gap-1 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              Boshqa narx (ixtiyoriy)
              <input className="inp" inputMode="numeric" value={override} placeholder={fee > 0 ? `Bo'sh qolsa ${fmt(fee)}` : "Narx kiriting"}
                onChange={(e) => { setOverride(e.target.value.replace(/\D/g, "")); setErr([]); }} />
            </label>
            <label className="col-span-full flex flex-col gap-1 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              Izoh (ixtiyoriy)
              <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: Kechki smena" />
            </label>
          </div>

          {/* ⚠️ JONLI HISOB — DOIM ko'rinadi, Qo'shishdan OLDIN */}
          <div className="mt-2.5 rounded-md border px-3 py-2.5 text-center text-[15px] font-extrabold tabular-nums"
            style={{ borderColor: chk.ok ? "var(--acc)" : "var(--border)", background: "var(--surface-2)", color: chk.ok ? "var(--acc)" : "var(--muted)" }}>
            {chk.count > 0 && chk.unit > 0
              ? `${chk.count} × ${fmt(chk.unit).replace(" so'm", "")} = ${fmt(chk.total)}`
              : "— × — = —"}
          </div>

          {!chk.ok && (count !== "" || chk.unit <= 0) && (
            <p className="mt-1.5 text-[11.5px] font-bold" style={{ color: "var(--danger-ink)" }}>{chk.reason}</p>
          )}
          {err.length > 0 && (
            <p className="mt-1.5 rounded-md px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
              {err.map((l, i) => <span key={i} className="block">{l}</span>)}
            </p>
          )}

          <div className="mt-2.5 flex justify-end">
            <button type="button" onClick={add} disabled={!chk.ok || busy}
              className={`btn-primary !flex-none px-5 disabled:opacity-60 ${busy ? "btn-loading" : ""}`}>
              <Plus size={15} strokeWidth={2} /> Qo&apos;shish
            </button>
          </div>
        </>
      )}
    </div>
  );
}
