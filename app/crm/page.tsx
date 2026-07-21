"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Eski manzil: CRM ikkiga bo'lindi — buyurtmalar (/buyurtmalar) va mijozlar
    (/mijozlar). Eski havolalar (jumladan /crm?lead=ID) buzilmasin. */
export default function CrmRedirect() {
  const router = useRouter();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const lead = p.get("lead") ?? p.get("order");
    router.replace(lead ? `/buyurtmalar?order=${lead}` : "/buyurtmalar");
  }, [router]);
  return null;
}
