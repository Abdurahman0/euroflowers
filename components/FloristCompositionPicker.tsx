"use client";
import { useEffect, useMemo, useState } from "react";
import { Info, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import Select from "./Select";
import { formatStemsAndBunches } from "@/lib/inventory";
import type { FloristStockBalance } from "@/lib/types";

/**
 * FLORIST KATALOGI GUL TANLAGICH — floristga CHIQARILGAN gullardan tanlanadi (skladdan emas).
 * ⚠️ Bu oqim backend'da IKKI marta o'zgardi. Butun florist-mode kompozitsiya mantiqi SHU
 * BITTA komponentda — keyingi o'zgarish kichik tahrir bo'lsin (delete-and-rebuild emas).
 *
 * Qoidalar (spec «florist katalogida gul tanlanadi, faqat soni yozilmaydi»):
 *   • gul(lar) tanlanadi — bir nechta xil gul bo'lishi mumkin (masalan qizil + oq)
 *   • SON KIRITILMAYDI, MIQDOR VALIDATSIYASI YO'Q — qoldiq faqat READ-ONLY kontekst
 *   • florist hech narsa tutmasa — bo'sh holat + chiqarish sahifasiga yo'l
 *   • florist almashsa — tanlov TOZALANADI (batch yangi floristda bo'lmasligi mumkin);
 *     baribir tutilmaydigan tanlov qolsa — ALOHIDA belgilanadi (jimgina saqlanmaydi)
 * Qiymat = tanlangan stock_batch id'lari (number[]).
 */
export default function FloristCompositionPicker({ florist, value, onChange, error }: {
  florist: number;
  value: number[];
  onChange: (ids: number[]) => void;
  error?: string;
}) {
  const [balances, setBalances] = useState<FloristStockBalance[] | null>(null);
  useEffect(() => {
    if (!florist) { setBalances([]); return; }
    setBalances(null);
    api.floristStockBalances({ florist }).then(setBalances).catch(() => setBalances([]));
  }, [florist]);

  const held = useMemo(() => new Set((balances ?? []).map((b) => b.batch)), [balances]);
  const balanceOf = (batch: number) => (balances ?? []).find((b) => b.batch === batch);
  const rows = value.length ? value : [0]; // doim kamida bitta qator (tanlash uchun)

  const setRow = (i: number, batch: number) => {
    const next = rows.map((r, j) => (j === i ? batch : r)).filter((r, j, arr) => r === 0 || arr.indexOf(r) === j); // dublikatni tashla
    onChange(next.filter((r) => r > 0));
  };
  const removeRow = (i: number) => onChange(rows.filter((_, j) => j !== i).filter((r) => r > 0));
  const addRow = () => onChange([...value.filter((r) => r > 0), 0].filter((r, j, a) => r > 0 || j === a.length - 1) as number[]);

  const options = useMemo(() => (balances ?? []).map((b) => {
    const bd = b.batch_detail;
    return {
      value: b.batch,
      label: [bd?.flower, bd?.variant, bd?.color].filter(Boolean).join(" · ") || `Partiya #${b.batch}`,
      sub: `№${bd?.batch_number ?? b.batch}${bd?.height_label ? ` · ${bd.height_label}` : ""} · qoldiq: ${formatStemsAndBunches(b.remaining_stems, bd?.stems_per_bunch)}`,
    };
  }), [balances]);

  if (balances === null) return <div className="py-4 text-center text-[12.5px]" style={{ color: "var(--muted)" }}>Floristning gullari yuklanmoqda…</div>;

  // FLORIST HECH NARSA TUTMAYDI — gul tanlab bo'lmaydi; chiqarish sahifasiga yo'l
  if (balances.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed p-4 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-[13px] font-semibold">Bu floristga hali gul chiqarilmagan</p>
        <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>Katalog florist qo&apos;lidagi guldan yasaladi — avval unga skladdan gul chiqaring.</p>
        <button type="button" onClick={() => { if (typeof window !== "undefined") window.location.assign(`/floristlarga-chiqarilgan?florist=${florist}`); }} className="btn-primary mt-3 !inline-flex">Floristga gul chiqarish</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-start gap-1.5 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
        <Info size={14} strokeWidth={2} className="mt-px shrink-0" style={{ color: "var(--primary)" }} />
        <span>Floristga chiqarilgan gulni tanlang — bitta buket ikki xil guldan bo&apos;lsa, ikkalasini ham qo&apos;shing. <b>Son yozilmaydi</b>: qaysi buket qaysi guldan yasalgani shu tanlovdan bilinadi, miqdor esa nazoratchi <b>«Chiqimni yopish»</b> qilganda hisoblanadi.</span>
      </p>
      {rows.map((batch, i) => {
        const invalid = batch > 0 && !held.has(batch); // florist almashgan bo'lsa — bu gul unda yo'q
        const bal = balanceOf(batch);
        return (
          <div key={i} className="rounded-[13px] border p-2.5" style={{ borderColor: invalid ? "var(--danger-ink)" : "var(--border)", background: invalid ? "var(--danger-soft, rgba(160,74,74,.10))" : undefined }}>
            <div className="grid grid-cols-[1fr_32px] items-center gap-2">
              <Select searchable value={batch} onChange={(v) => setRow(i, +v)} options={options} placeholder="Floristning gulini tanlang" />
              {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>}
            </div>
            <div className="mt-1 text-[11.5px]" style={{ color: invalid ? "var(--danger-ink)" : "var(--muted)" }}>
              {invalid ? "Bu florist bu gulni tutmaydi — boshqasini tanlang" : bal ? `Floristda qoldiq: ${formatStemsAndBunches(bal.remaining_stems, bal.batch_detail?.stems_per_bunch)} (faqat kontekst — bu yerga son kiritilmaydi)` : ""}
            </div>
          </div>
        );
      })}
      <button type="button" onClick={addRow} className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3.5 py-1.5 text-[12px] font-bold">
        <Plus size={15} strokeWidth={1.75} /> Yana gul
      </button>
      {error && <p className="text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{error}</p>}
    </div>
  );
}
