"use client";
import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import type { LeadStatusDef } from "@/lib/types";

/**
 * Kanban statuslarini boshqarish — statuslar backenddan keladi
 * (/api/lead-statuses/), admin/operator qo'shishi, nomi/rangi/tartibini
 * o'zgartirishi va o'chirishi mumkin. Rang ustunda va badge'larda ishlatiladi.
 */
export default function LeadStatusManager({
  statuses,
  onClose,
  onChanged,
}: {
  statuses: LeadStatusDef[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [rows, setRows] = useState<LeadStatusDef[]>(statuses.map((s) => ({ ...s })));
  const [adding, setAdding] = useState({ name_uz: "", color: "#a85d68" });
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const patchRow = (id: number, p: Partial<LeadStatusDef>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const saveAll = async () => {
    setBusy(true);
    try {
      // faqat o'zgarganlari yuboriladi
      for (const r of rows) {
        const orig = statuses.find((s) => s.id === r.id);
        if (!orig) continue;
        if (orig.name_uz !== r.name_uz || orig.name_ru !== r.name_ru || orig.color !== r.color || orig.order !== r.order || orig.is_active !== r.is_active) {
          await api.updateLeadStatus(r.id, {
            name_uz: r.name_uz,
            name_ru: r.name_ru || r.name_uz,
            color: r.color,
            order: r.order,
            is_active: r.is_active,
          });
        }
      }
      showToast("✓ Statuslar saqlandi");
      onChanged();
      onClose();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  const add = async () => {
    if (!adding.name_uz.trim()) return showToast("Status nomini kiriting");
    setBusy(true);
    try {
      const key = adding.name_uz.trim().toLowerCase().replace(/['ʼ`]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `status_${Date.now() % 10000}`;
      const created = await api.createLeadStatus({
        key,
        name_uz: adding.name_uz.trim(),
        name_ru: adding.name_uz.trim(),
        color: adding.color,
        order: (rows.reduce((mx, r) => Math.max(mx, r.order), 0) || 0) + 10,
        is_active: true,
      });
      setRows((rs) => [...rs, created]);
      setAdding({ name_uz: "", color: "#a85d68" });
      showToast(`✓ «${created.name_uz}» statusi qo'shildi`);
      onChanged();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Qo'shib bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: number) => {
    setBusy(true);
    try {
      await api.deleteLeadStatus(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
      setConfirmDel(null);
      showToast("✓ Status o'chirildi");
      onChanged();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "O'chirib bo'lmadi — statusda buyurtmalar bo'lishi mumkin");
    } finally {
      setBusy(false);
    }
  };

  const CORE = new Set(["new", "won", "lost"]); // ish jarayoni tayanadigan asosiy kalitlar

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader icon={<Icon name="crm" />} title="Kanban statuslari" sub="Ustunlar nomi, rangi va tartibi — backenddan boshqariladi" onClose={onClose} />

      <Section>Statuslar</Section>
      <div className="flex flex-col gap-2">
        {rows
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-[14px] border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)", opacity: r.is_active ? 1 : 0.55 }}>
              <GripVertical size={15} strokeWidth={1.75} className="shrink-0 opacity-40" />
              <input
                type="color"
                value={r.color}
                onChange={(e) => patchRow(r.id, { color: e.target.value })}
                aria-label={`${r.name_uz} rangi`}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-[9px] border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[9px] [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-[color:var(--border)]"
              />
              <input
                className="inp !h-9 min-w-0 flex-1 !text-[13px]"
                value={r.name_uz}
                onChange={(e) => patchRow(r.id, { name_uz: e.target.value })}
                aria-label="Status nomi"
              />
              <input
                className="inp !h-9 !w-[58px] shrink-0 text-right !text-[13px]"
                inputMode="numeric"
                value={String(r.order)}
                onChange={(e) => patchRow(r.id, { order: +e.target.value.replace(/\D/g, "") || 0 })}
                aria-label="Tartib"
                title="Tartib raqami — kichigi chapda"
              />
              <button
                type="button"
                onClick={() => patchRow(r.id, { is_active: !r.is_active })}
                className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors"
                style={r.is_active ? { borderColor: "var(--success)", color: "var(--success-ink)", background: "var(--success-soft)" } : { borderColor: "var(--border)", color: "var(--muted)" }}
                title="Faol/nofaol — nofaol status ustun sifatida ko'rinmaydi"
              >
                {r.is_active ? "Faol" : "Nofaol"}
              </button>
              {!CORE.has(r.key) &&
                (confirmDel === r.id ? (
                  <button type="button" onClick={() => del(r.id)} disabled={busy} className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: "var(--danger)" }}>
                    Aniqmi?
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirmDel(r.id)} className="icon-btn icon-btn-danger !h-8 !w-8 shrink-0" title="O'chirish" aria-label={`${r.name_uz} o'chirish`}>
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                ))}
            </div>
          ))}
      </div>

      <Section>Yangi status</Section>
      <div className="flex items-center gap-2.5">
        <input
          type="color"
          value={adding.color}
          onChange={(e) => setAdding((a) => ({ ...a, color: e.target.value }))}
          aria-label="Yangi status rangi"
          className="h-9 w-9 shrink-0 cursor-pointer rounded-[10px] border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[10px] [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-[color:var(--border)]"
        />
        <input
          className="inp min-w-0 flex-1"
          value={adding.name_uz}
          onChange={(e) => setAdding((a) => ({ ...a, name_uz: e.target.value }))}
          placeholder="Masalan: Yetkazilmoqda"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button type="button" onClick={add} disabled={busy} className="icon-btn shrink-0 border disabled:opacity-50" style={{ borderColor: "var(--border)" }} title="Status qo'shish" aria-label="Status qo'shish">
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </div>
      <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
        «Yangi», «Sotildi» va «Bekor» — tizim tayanadigan asosiy statuslar, ularni o&apos;chirib bo&apos;lmaydi (nomi va rangini o&apos;zgartirish mumkin).
      </p>

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={saveAll} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
      </ModalFooter>
    </Modal>
  );
}
