"use client";
import { IntegrationsSection, InstagramEventsSection } from "@/components/DevSections";
import { usePerm } from "@/lib/store";
import EmptyState from "@/components/EmptyState";

/**
 * Integratsiyalar — alohida sahifa (ilgari Sozlamalar ichida edi).
 * Kalitlar/tokenlar boshqaruvi + Instagram webhook hodisalari.
 * Bo'limlar o'z ruxsatini o'zi tekshiradi (integrations).
 */
export default function IntegratsiyalarPage() {
  const { canView } = usePerm();
  const visible = canView("integrations");

  if (!visible) {
    return <EmptyState title="Ruxsat yo'q" sub="Bu sahifa uchun sizda ko'rish huquqi yo'q." />;
  }

  return (
    <div className="grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
      <IntegrationsSection />
      <InstagramEventsSection />
    </div>
  );
}
