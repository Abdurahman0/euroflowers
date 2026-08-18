"use client";
import { Bell, CheckCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import EmptyState from "@/components/EmptyState";
import { fmtTime } from "@/lib/format";

export default function FloristNotificationsPage() {
  const { notifs, markNotifRead, markAllNotifsRead } = useStore();
  return <div className="flex flex-col gap-5"><div className="flex flex-wrap items-end gap-3"><div><p className="text-[12px] font-bold uppercase tracking-[2px]" style={{ color: "var(--primary)" }}>Shaxsiy maydon</p><h1 className="mt-1 text-[24px] font-extrabold">Bildirishnomalar</h1><p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>Ish, davomat va ish haqi haqida</p></div><button onClick={markAllNotifsRead} className="btn-ghost ml-auto !flex items-center gap-2"><CheckCheck size={16} /> Barchasini o'qish</button></div>{notifs.length === 0 ? <EmptyState title="Bildirishnoma yo'q" sub="Yangi ish yoki ish haqi yozilganda xabar beramiz." /> : <section className="glass-lite p-4">{notifs.map((n) => <button key={n.id} onClick={() => !n.is_read && markNotifRead(n.id)} className="flex w-full items-start gap-3 border-b p-3 text-left last:border-0" style={{ borderColor: "var(--line2)", opacity: n.is_read ? .62 : 1 }}><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><Bell size={16} /></span><span className="min-w-0 flex-1"><span className="block text-[13.5px] font-bold">{n.title_uz || n.title_ru}</span><span className="mt-1 block text-[12.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>{n.body_uz || n.body_ru}</span><span className="mt-1.5 block text-[11px]" style={{ color: "var(--muted)" }}>{fmtTime(n.created_at)}</span></span>{!n.is_read && <span className="mt-2 h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />}</button>)}</section>}</div>;
}
