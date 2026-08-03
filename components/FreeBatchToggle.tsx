"use client";
import { Gift } from "lucide-react";

/**
 * TEKIN GUL belgisi — partiya formasining TEPASIDA (create va edit ikkalasida AYNAN bir xil).
 * Yoqilganda chaqiruvchi tannarx maydonlarini BUTUNLAY yashiradi (disable emas) va payload'ga
 * tannarx qo'ymaydi; sotuv narxi joyida qoladi va majburiy bo'lib qolaveradi.
 *
 * ⚠️ Yozilgan tannarx qiymati formada SAQLANADI (o'chirilmaydi) — belgini qaytarib olib
 * tashlash odatda noto'g'ri bosishni tuzatish, shuning uchun operator yozganini yo'qotmaydi.
 */
export default function FreeBatchToggle({ checked, onChange, retroactive = false }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** edit rejimi — mavjud partiyada bu RETROAKTIV o'zgarish (tannarx asosi qayta yoziladi) */
  retroactive?: boolean;
}) {
  return (
    <label
      className="mt-1 flex cursor-pointer items-start gap-2.5 rounded-[13px] border px-3.5 py-3 transition-colors"
      style={checked
        ? { borderColor: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" }
        : { borderColor: "var(--border)" }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--acc)]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13px] font-bold">
          <Gift size={14} strokeWidth={2.1} style={{ color: checked ? "var(--acc)" : "var(--muted)" }} />
          Postavshik tekinga qo&apos;shib bergan
        </span>
        <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--muted)" }}>
          {checked
            ? "Tannarx yozilmaydi (0) va postavshik qarziga qo'shilmaydi. Sotuv narxi majburiy."
            : "Belgilansa tannarx maydonlari yashiriladi — bu gul uchun pul to'lanmagan."}
        </span>
        {checked && retroactive && (
          <span className="mt-1 block text-[11.5px] font-bold" style={{ color: "var(--danger-ink)" }}>
            ⚠️ Mavjud partiyada bu RETROAKTIV — shu guldan yasalgan kataloglar tannarxi qayta hisoblanadi.
          </span>
        )}
      </span>
    </label>
  );
}
