"use client";
import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Popover from "./Popover";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import type { LeadStatusDef } from "@/lib/types";

/** Tayyor ranglar palitras — ikkala temada ham chiroyli o'qiladigan,
    ilova ohangiga mos yumshoq to'plam. Erkin rang tanlash YO'Q. */
const PALETTE: { hex: string; nomi: string }[] = [
  { hex: "#c2703f", nomi: "Terrakota" },
  { hex: "#b3873a", nomi: "Amber" },
  { hex: "#7d8a3d", nomi: "Zaytun" },
  { hex: "#3d8a5f", nomi: "Yashil" },
  { hex: "#3a8a8a", nomi: "Teal" },
  { hex: "#4a7ab5", nomi: "Ko'k" },
  { hex: "#6a6ac2", nomi: "Indigo" },
  { hex: "#8a5fa8", nomi: "Binafsha" },
  { hex: "#b054a1", nomi: "Magenta" },
  { hex: "#d16d7f", nomi: "Pushti" },
  { hex: "#a04a4a", nomi: "Qizil" },
  { hex: "#8a8a8a", nomi: "Kulrang" },
];

/** Palitradan rang tanlagich — swatch bosilganda kichik popover ochiladi. */
function ColorPick({ value, onChange, ariaLabel }: { value: string; onChange: (hex: string) => void; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        title="Rang tanlash"
        className="h-8 w-8 shrink-0 rounded-[9px] border transition-transform hover:scale-105"
        style={{ background: value, borderColor: "color-mix(in srgb, var(--text) 18%, transparent)" }}
      />
      <Popover
        anchor={ref}
        open={open}
        onClose={() => setOpen(false)}
        width={196}
        ariaLabel="Rang palitras"
        className="rounded-[14px] border p-2 shadow-lg"
        style={{ background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
      >
        <div className="grid grid-cols-4 gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => { onChange(c.hex); setOpen(false); }}
              title={c.nomi}
              aria-label={c.nomi}
              className="flex h-10 w-10 items-center justify-center rounded-[10px] transition-transform hover:scale-110"
              style={{ background: c.hex }}
            >
              {value.toLowerCase() === c.hex && <Check size={16} strokeWidth={3} className="text-white drop-shadow" />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

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
  const [adding, setAdding] = useState({ name_uz: "", color: "#d16d7f" });
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const patchRow = (id: number, p: Partial<LeadStatusDef>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  /** Yuqoriga/pastga surish — order qiymatlari AVTOMATIK qayta taqsimlanadi
      (foydalanuvchiga hech qanday raqam ko'rsatilmaydi). */
  const move = (id: number, dir: -1 | 1) => {
    setRows((rs) => {
      const list = rs.slice().sort((a, b) => a.order - b.order);
      const i = list.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return rs;
      [list[i], list[j]] = [list[j], list[i]];
      return list.map((r, idx) => ({ ...r, order: (idx + 1) * 10 }));
    });
  };

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
      setAdding({ name_uz: "", color: "#d16d7f" });
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
          .map((r, i, arr) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-[14px] border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)", opacity: r.is_active ? 1 : 0.55 }}>
              {/* tartib — faqat o'q tugmalari, raqam ko'rsatilmaydi */}
              <span className="flex shrink-0 flex-col">
                <button type="button" onClick={() => move(r.id, -1)} disabled={i === 0} className="flex h-4 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--hover)] disabled:opacity-20" title="Yuqoriga (chapga) surish" aria-label={`${r.name_uz} — yuqoriga`}>
                  <ChevronUp size={13} strokeWidth={2} />
                </button>
                <button type="button" onClick={() => move(r.id, 1)} disabled={i === arr.length - 1} className="flex h-4 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--hover)] disabled:opacity-20" title="Pastga (o'ngga) surish" aria-label={`${r.name_uz} — pastga`}>
                  <ChevronDown size={13} strokeWidth={2} />
                </button>
              </span>
              <ColorPick value={r.color} onChange={(hex) => patchRow(r.id, { color: hex })} ariaLabel={`${r.name_uz} rangi`} />
              <input
                className="inp !h-9 min-w-0 flex-1 !text-[13px]"
                value={r.name_uz}
                onChange={(e) => patchRow(r.id, { name_uz: e.target.value })}
                aria-label="Status nomi"
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
        <ColorPick value={adding.color} onChange={(hex) => setAdding((a) => ({ ...a, color: hex }))} ariaLabel="Yangi status rangi" />
        <input
          className="inp min-w-0 flex-1"
          value={adding.name_uz}
          onChange={(e) => setAdding((a) => ({ ...a, name_uz: e.target.value }))}
          placeholder="Masalan: Yetkazilmoqda"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button type="button" onClick={add} disabled={busy} className="icon-btn shrink-0 border disabled:opacity-50" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }} title="Status qo'shish" aria-label="Status qo'shish">
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </div>
      <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
        Tartib — o&apos;q tugmalari bilan: yuqoridagi status kanbanda chapda turadi. «Yangi», «Sotildi» va «Bekor» — tizim tayanadigan asosiy statuslar, ularni o&apos;chirib bo&apos;lmaydi (nomi va rangini o&apos;zgartirish mumkin).
      </p>

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={saveAll} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
      </ModalFooter>
    </Modal>
  );
}
