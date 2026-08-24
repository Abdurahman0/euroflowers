"use client";
import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { SecretInput } from "@/components/DevSections";
import type { Branch } from "@/lib/types";

/**
 * FILIAL SOTUV GURUHLARI — FRONTEND_SOTUV_RASM.md §7.
 *
 * ⚠️ Filialga biriktirilgan katalog sotilsa O'SHA filialning boti ishlatiladi.
 *    Filial guruhi sozlanmagan bo'lsa xabar BOSHQA guruhga tushmaydi — shunchaki
 *    yuborilmaydi (sotuvning o'zi baribir amalga oshadi). Shu sabab holat ochiq
 *    ko'rsatiladi: operator xabar kelmasa sababini shu yerdan biladi.
 *
 * ⚠️ Tokenlar javobda QAYTMAYDI (write-only) — faqat `sale_group_configured`.
 *    Shuning uchun maydonlar bo'sh ko'rinadi va bo'sh yuborilmaydi.
 *
 * ⚠️ Yozuv yo'li JONLI SINALMAGAN (loyiha qoidasi: faqat GET).
 */
export default function BranchSaleGroups() {
  const { showToast } = useStore();
  const { canView, canControl } = usePerm();
  const visible = canView("integrations");
  const control = canControl("integrations");
  const [rows, setRows] = useState<Branch[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [form, setForm] = useState<{ sale_bot_token?: string; sale_group_chat_id?: string }>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!visible) return;
    api.branches({ is_active: true })
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Filiallarni yuklab bo'lmadi"));
  }, [visible]);
  if (!visible) return null;

  const save = async (b: Branch) => {
    const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => (v ?? "").trim() !== ""));
    if (!Object.keys(payload).length) return showToast("Token va chat ID ni kiriting");
    setBusy(true);
    try {
      const saved = await api.updateBranch(b.id, payload);
      setRows((rs) => (rs ?? []).map((x) => (x.id === b.id ? { ...x, ...saved } : x)));
      setForm({}); setOpen(null);
      showToast(`✓ ${b.name} — sotuv guruhi saqlandi`);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass p-5">
      <h2 className="mb-1 flex items-center gap-1.5 text-base font-bold">
        <Send size={15} strokeWidth={2} style={{ color: "var(--primary)" }} /> Filial sotuv guruhlari
      </h2>
      <p className="mb-3.5 text-[12px]" style={{ color: "var(--muted)" }}>
        Filial katalogi sotilganda rasm va xabar o&apos;sha filialning guruhiga boradi.
        Ulanmagan bo&apos;lsa sotuv o&apos;tadi, faqat xabar yuborilmaydi.
      </p>
      {err && <p className="text-[13px] font-semibold" style={{ color: "var(--danger-ink)" }}>{err}</p>}

      <div className="flex flex-col gap-1.5">
        {(rows ?? []).map((b) => (
          <div key={b.id} className="rounded-[13px] border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold">{b.name}{b.is_main && <span className="ml-1.5 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>(asosiy)</span>}</span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={b.sale_group_configured
                  ? { background: "var(--success-soft)", color: "var(--success-ink, #3d8a5f)" }
                  : { background: "var(--warning-soft)", color: "var(--warning-ink, #8a6d1f)" }}>
                {b.sale_group_configured ? "guruh ulangan" : "guruh ulanmagan"}
              </span>
              {control && (
                <button type="button" onClick={() => { setOpen(open === b.id ? null : b.id); setForm({}); }}
                  className="ml-auto rounded-full border px-3 py-1 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
                  {open === b.id ? "Yopish" : b.sale_group_configured ? "Almashtirish" : "Ulash"}
                </button>
              )}
            </div>

            {control && open === b.id && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SecretInput label="Sotuv bot token" value={form.sale_bot_token ?? ""} onChange={(v) => setForm((f) => ({ ...f, sale_bot_token: v }))} />
                <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Sotuv guruh chat ID
                  <input
                    className="rounded-[10px] border px-3 py-2 text-[13px] normal-case tracking-normal outline-none focus:shadow-[0_0_0_3px_var(--focus)]"
                    style={{ borderColor: "var(--border)", background: "var(--surface-solid)", color: "var(--text)" }}
                    value={form.sale_group_chat_id ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, sale_group_chat_id: e.target.value }))}
                    placeholder="Masalan: -1001234567890"
                  />
                </label>
                <div className="sm:col-span-2 flex items-center justify-between gap-2">
                  {/* ⚠️ Tokenlar javobda qaytmaydi — shu sabab maydonlar doim bo'sh boshlanadi */}
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>Tokenlar xavfsizlik uchun qaytarilmaydi — o&apos;zgartirish uchun qaytadan kiriting</span>
                  <button onClick={() => save(b)} disabled={busy} className={`btn-primary !flex-none px-5 ${busy ? "btn-loading" : ""}`}>Saqlash</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {rows !== null && rows.length === 0 && (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>Filial yo&apos;q — sotuv xabarlari umumiy guruhga boradi.</p>
        )}
      </div>
    </section>
  );
}
