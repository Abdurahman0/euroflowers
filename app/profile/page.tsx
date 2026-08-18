"use client";
import { CircleUserRound } from "lucide-react";
import { useStore } from "@/lib/store";

export default function ProfilePage() {
  const user = useStore((s) => s.user); const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Florist";
  return <div className="mx-auto max-w-[720px]"><div className="mb-5"><p className="text-[12px] font-bold uppercase tracking-[2px]" style={{ color: "var(--primary)" }}>Shaxsiy maydon</p><h1 className="mt-1 text-[24px] font-extrabold">Profil</h1></div><section className="glass-lite flex items-center gap-4 p-6"><span className="flex h-14 w-14 items-center justify-center rounded-[18px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><CircleUserRound size={28} /></span><div><h2 className="text-[18px] font-extrabold">{name}</h2><p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>@{user?.username} · {user?.profile.role === "apprentice" ? "Shogird" : "Florist"}</p><p className="mt-2 text-[12.5px]" style={{ color: "var(--text-2)" }}>Bu hisobda faqat shaxsiy ish, davomat va ish haqi ma'lumotlari ko'rsatiladi.</p></div></section></div>;
}
