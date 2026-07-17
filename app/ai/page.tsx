"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AISettingsSection } from "@/components/DevSections";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import type { BusinessSettings } from "@/lib/types";

/**
 * AI yordamchi — barcha AI imkoniyatlari bir joyda (ilgari Sozlamalar
 * ichida sochilib yurardi):
 *   • AI qoidalari — mijoz bilan muloqot qoidalari (serverdan, o'qish)
 *   • AI sozlamalari — model/temperature/tizim prompti (faqat developer,
 *     bo'lim ruxsatni o'zi tekshiradi)
 * Jonli AI yozishmalar alohida "AI chatlar" sahifasida qoladi.
 */
export default function AiPage() {
  const showToast = useStore((s) => s.showToast);
  const [st, setSt] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    api.settings()
      .then(setSt)
      .catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  }, [showToast]);

  return (
    <div className="grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
      {/* AI qoidalari — serverdan */}
      <section className="glass p-5 text-[#F0E9FA]" style={{ background: "color-mix(in srgb, var(--side) 82%, transparent)" }}>
        <h2 className="mb-3.5 text-base font-bold">AI qoidalari</h2>
        <ul className="flex flex-col gap-2 text-[13px] leading-relaxed opacity-90">
          <li>• {st?.approximate_price_wording_uz || "Narxlar taxminiy beriladi."}</li>
          <li>• {st?.min_sale_reminder_uz || "Minimal sotuv soni eslatiladi."}</li>
          <li>• {st?.handoff_rules_uz || "Mijoz tayyor bo'lganda suhbat operatorga uzatiladi."}</li>
          <li>• Buket/savat narxiga florist haqi qo&apos;shiladi: <b>{st ? fmt(st.default_florist_fee) : "—"}</b></li>
        </ul>
      </section>

      {/* AI model sozlamalari — faqat developer (bo'lim o'zi gate qiladi) */}
      <AISettingsSection />
    </div>
  );
}
