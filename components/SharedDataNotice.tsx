"use client";
import { Info } from "lucide-react";
import { useStore } from "@/lib/store";
import { isBranchUser, showsSharedData } from "@/lib/branch";
import type { ScreenId } from "@/lib/types";

/**
 * «Bu ro'yxat barcha filiallar uchun umumiy» — FILIAL foydalanuvchisiga, MA'LUMOTI serverda
 * filialga bo'linMAGAN sahifalarda (lib/branch.ts → GLOBAL_DATA_SCREENS).
 *
 * ⚠️ NIMA UCHUN: ilgari bu sahifalar filial foydalanuvchisidan YASHIRILARDI. Endi ruxsat hukm
 * qiladi va ular ochiq — lekin Parkent operatori bu ro'yxatni «Parkent ma'lumoti» deb
 * o'ylamasligi kerak. Yashirish qo'pol yechim edi; halol yechim — ochiq aytish.
 * Asosiy filial foydalanuvchisiga HECH QACHON ko'rsatilmaydi (unga bu ma'nosiz).
 */
export default function SharedDataNotice({ screen, className = "" }: { screen: ScreenId; className?: string }) {
  const branch = useStore((s) => s.user?.profile.branch);
  if (!showsSharedData(screen, isBranchUser(branch))) return null;
  return (
    <p
      className={`flex items-start gap-1.5 rounded-[11px] px-3 py-2 text-[12px] font-semibold leading-snug ${className}`}
      style={{ background: "var(--surface-2)", color: "var(--muted)" }}
      role="note"
    >
      <Info size={13} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--primary)" }} />
      Bu ro&apos;yxat <b style={{ color: "var(--text-2)" }}>barcha filiallar uchun umumiy</b> — faqat sizning filialingiz ma&apos;lumoti emas.
    </p>
  );
}
