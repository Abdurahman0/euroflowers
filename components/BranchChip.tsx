"use client";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { isBranchUser } from "@/lib/branch";

/** Filial (non-main) foydalanuvchisi uchun brend yonida kichik chip — "qaysi CRM"ni
    unutmaslik uchun. Asosiy filial foydalanuvchisiga KO'RSATILMAYDI (chalkashlik yo'q). */
export default function BranchChip() {
  const branch = useStore((s) => s.user?.profile.branch);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!isBranchUser(branch)) { setName(null); return; }
    api.branches().then((bs) => setName(bs.find((b) => b.id === branch)?.name ?? "Filial")).catch(() => setName("Filial"));
  }, [branch]);
  if (!isBranchUser(branch) || !name) return null;
  return (
    <span className="ml-2 hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline-flex" style={{ background: "var(--primary-soft)", color: "var(--primary)" }} title="Joriy filial">
      <Building2 size={11} strokeWidth={2.4} /> {name}
    </span>
  );
}
