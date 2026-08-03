"use client";

/**
 * «TEKIN» yorlig'i — partiya tekin kelganini bildiradi, shunda 0 tannarx
 * «ma'lumot yo'q» kabi o'qilmaydi. YAGONA manba: nom yonida turadigan hamma joyda shu ishlatiladi
 * (partiya ro'yxati, yuk detali, partiya drawer'i va BARCHA tanlagichlar — StockLine orqali).
 *
 * Mavjud chip oilasidan (rounded-full · 10.5px · bold), tint sifatida `--acc` —
 * yangi rang o'ylab topilmadi.
 */
export default function FreeBatchChip({ className = "" }: { className?: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-bold leading-[1.5] ${className}`}
      style={{ background: "color-mix(in srgb, var(--acc) 16%, transparent)", color: "var(--acc)" }}
      title="Postavshik tekinga qo'shib bergan — tannarx 0, «Umumiy sotib olingan»ga qo'shilmagan"
    >
      TEKIN
    </span>
  );
}
