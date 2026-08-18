"use client";
import { useEffect, useState } from "react";
import { WalletCards } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { fmt, fmtDate } from "@/lib/format";
import type { FloristSalaryEntry } from "@/lib/types";

export default function FloristSalaryPage() {
  const showToast = useStore((s) => s.showToast); const [rows, setRows] = useState<FloristSalaryEntry[] | null>(null); const [period, setPeriod] = useState<"oy" | "30">("oy");
  useEffect(() => { setRows(null); const to = new Date().toISOString().slice(0, 10); const d = new Date(); d.setDate(d.getDate() - (period === "30" ? 30 : 365)); const from = d.toISOString().slice(0, 10); api.floristSalary({ date_from: from, date_to: to, ordering: "-work_date" }).then(setRows).catch((e) => showToast(e instanceof Error ? e.message : "Ish haqi yuklanmadi")); }, [period, showToast]);
  if (!rows) return <FlowerLoader />;
  const total = rows.reduce((a, x) => a + (+x.amount || 0), 0);
  return <div className="flex flex-col gap-5"><div className="flex flex-wrap items-end gap-3"><div><p className="text-[12px] font-bold uppercase tracking-[2px]" style={{ color: "var(--primary)" }}>Shaxsiy maydon</p><h1 className="mt-1 text-[24px] font-extrabold">Ish haqi tarixi</h1><p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>Faqat sizga tegishli ish haqi yozuvlari</p></div><div className="ml-auto flex rounded-[13px] border p-1" style={{ borderColor: "var(--line)" }}>{[["30", "30 kun"], ["oy", "12 oy"]].map(([v, l]) => <button key={v} onClick={() => setPeriod(v as "oy" | "30")} className="rounded-[10px] px-3 py-1.5 text-[12px] font-bold" style={period === v ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>{l}</button>)}</div></div><div className="glass-lite flex items-center gap-3 p-5"><span className="flex h-11 w-11 items-center justify-center rounded-[14px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><WalletCards size={22} /></span><div><div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Jami yozilgan</div><div className="text-[23px] font-extrabold">{fmt(total)} so'm</div></div><span className="ml-auto text-[12.5px]" style={{ color: "var(--muted)" }}>{rows.length} ta yozuv</span></div>{rows.length === 0 ? <EmptyState title="Ish haqi yozuvi yo'q" sub="Yozuv qo'shilganda shu yerda ko'rinadi." /> : <section className="glass-lite overflow-hidden p-5"><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[13px]"><thead><tr style={{ color: "var(--muted)" }}><th className="pb-3 font-semibold">Sana</th><th className="pb-3 font-semibold">Sabab</th><th className="pb-3 font-semibold">Izoh</th><th className="pb-3 text-right font-semibold">Summa</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id} className="border-t" style={{ borderColor: "var(--line2)" }}><td className="py-3 font-semibold">{fmtDate(x.work_date)}</td><td className="py-3">{x.source}</td><td className="max-w-[300px] truncate py-3" style={{ color: "var(--muted)" }}>{x.note || "—"}</td><td className="py-3 text-right font-bold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(x.amount)}</td></tr>)}</tbody></table></div></section>}</div>;
}
