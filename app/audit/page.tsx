"use client";
import { AuditSection } from "@/components/DevSections";
import { usePerm } from "@/lib/store";
import EmptyState from "@/components/EmptyState";

/**
 * Audit jurnali — alohida sahifa (ilgari Sozlamalar ichida edi).
 * Kim nima qilgani tarixi. Bo'lim o'z ruxsatini o'zi tekshiradi (audit).
 */
export default function AuditPage() {
  const { canView } = usePerm();
  const visible = canView("audit");

  if (!visible) {
    return <EmptyState title="Ruxsat yo'q" sub="Bu sahifa uchun sizda ko'rish huquqi yo'q." />;
  }

  return (
    <div className="grid items-start gap-4">
      <AuditSection />
    </div>
  );
}
