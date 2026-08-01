"use client";

/**
 * PARTIYA NARXI — pochka-asosiy narx qatorining PREVIEW qismi (yaratish VA tahrirlashda
 * BIR XIL ishlatiladi, takror-kod bo'lmasin uchun bitta joyda). Pochka narxi maydonini
 * chaqiruvchi o'zi chizadi; bu komponent uning ostidagi «→ dona narxi» ni ko'rsatadi:
 *   • yaxlitlangan dona narxi (muted) + «(yaxlitlandi, aniq hisob 998)» izohi
 *   • 0 ga tushsa LOUD ogohlantirish
 *   • «qo'lda kiritish» — operator dona narxini aniq yozib ketishi mumkin (server verbatim)
 */
export function PriceHint({ label, perStem, note, manual, manualVal, onManualToggle, onManualChange }: {
  label: string;
  perStem: number;
  note: { exact: number; changed: boolean; zeroed: boolean };
  manual: boolean;
  manualVal: string;
  onManualToggle: () => void;
  onManualChange: (v: string) => void;
}) {
  return (
    <div className="mt-1.5">
      {manual ? (
        <div className="flex items-center gap-2">
          <input className="inp" type="number" value={manualVal} onChange={(e) => onManualChange(e.target.value)} placeholder={`${label} (qo'lda)`} aria-label={`${label} qo'lda`} />
          <button type="button" onClick={onManualToggle} className="shrink-0 text-[11.5px] font-bold" style={{ color: "var(--muted)" }}>← avto</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-1 text-[12px]" style={{ color: "var(--muted)" }}>
          <span>→ {label}: <b style={{ color: "var(--text-2)" }}>{perStem.toLocaleString("ru")} so&apos;m</b></span>
          {note.changed && <span style={{ color: "var(--mut)" }}>(yaxlitlandi, aniq hisob {note.exact.toLocaleString("ru", { maximumFractionDigits: 2 })})</span>}
          <button type="button" onClick={onManualToggle} className="text-[11px] font-bold" style={{ color: "var(--primary)" }}>qo&apos;lda kiritish</button>
        </div>
      )}
      {note.zeroed && !manual && (
        <p className="mt-1 flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12px] font-bold" style={{ background: "var(--danger-soft, rgba(160,74,74,.14))", color: "var(--danger-ink)" }}>
          ⚠ {label} 0 ga yaxlitlanadi (aniq hisob {note.exact.toLocaleString("ru", { maximumFractionDigits: 2 })}) — tannarx asosi yo&apos;qoladi
        </p>
      )}
    </div>
  );
}
