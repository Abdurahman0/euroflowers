"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import FilterSelect from "@/components/FilterSelect";
import { fmtTime } from "@/lib/format";
import type { AISettings, InstagramEvent, IntegrationSettings } from "@/lib/types";

/**
 * Developer bo'limlari (kontrakt):
 *   • AI sozlamalari  — GET/PATCH /api/ai/settings/   (ai_settings ruxsati)
 *   • Integratsiyalar — GET/PATCH /api/integrations/  (integrations ruxsati)
 *   • Instagram hodisalari — GET /api/instagram/events/ (debug jadvali)
 * Audit jurnali ALOHIDA sahifada: app/audit/page.tsx (lib/audit.ts tarjimasi).
 * Ruxsat bo'lmasa bo'lim umuman ko'rinmaydi.
 */

const EVENT_TYPES = ["", "message", "story_reply", "story_send", "media_send"];

/** Maxfiy kalit maydoni — qiymat yashirin, faqat yangисi yoziladi. */
function SecretInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
      {label}
      <input
        className="rounded-[10px] border px-3 py-2 text-[13px] outline-none transition-shadow duration-200 focus:shadow-[0_0_0_3px_var(--focus)]"
        style={{ borderColor: "var(--border)", background: "var(--surface-solid)", color: "var(--text)" }}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "o'zgartirmaslik uchun bo'sh qoldiring"}
        autoComplete="new-password"
      />
    </label>
  );
}

export function AISettingsSection() {
  const { canView, canControl } = usePerm();
  const showToast = useStore((s) => s.showToast);
  const [st, setSt] = useState<AISettings | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [temp, setTemp] = useState("0.7");
  const [activeAi, setActiveAi] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [err, setErr] = useState("");

  const visible = canView("ai_settings");
  useEffect(() => {
    if (!visible) return;
    api.aiSettings()
      .then((a) => {
        setSt(a); setPrompt(a.system_prompt); setModel(a.openai_model);
        setTemp(String(a.temperature)); setActiveAi(a.is_active);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    api.aiGlobalSettings()
      .then((a) => setActiveAi(a.is_active))
      .catch((e) => setErr(e instanceof Error ? e.message : "AI holatini yuklab bo'lmaydi"))
      .finally(() => setGlobalLoading(false));
  }, [visible]);
  if (!visible) return null;

  const save = async () => {
    setSaving(true);
    try {
      const upd = await api.updateAiSettings({
        openai_model: model.trim(),
        system_prompt: prompt,
        temperature: Math.min(2, Math.max(0, parseFloat(temp) || 0)),
      });
      setSt(upd);
      showToast("✓ AI sozlamalari saqlandi");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const toggleGlobalAi = async (next: boolean) => {
    if (globalSaving || globalLoading) return;
    const previous = activeAi;
    setActiveAi(next);
    setGlobalSaving(true);
    try {
      const updated = await api.updateAiGlobalSettings({ is_active: next });
      setActiveAi(updated.is_active);
      setSt((current) => current ? { ...current, is_active: updated.is_active } : current);
      showToast(updated.is_active ? "✓ AI yoqildi" : "✓ AI o'chirildi");
    } catch (e) {
      setActiveAi(previous);
      showToast(e instanceof ApiError ? e.message : "AI holatini saqlab bo'lmadi");
    } finally {
      setGlobalSaving(false);
    }
  };

  return (
    <section className="glass p-5">
      <h2 className="mb-1 text-base font-bold">AI sozlamalari</h2>
      <p className="mb-3.5 text-[12px]" style={{ color: "var(--muted)" }}>Faqat developer — model va tizim prompti</p>
      {err && <p className="text-[13px] font-semibold" style={{ color: "var(--danger-ink)" }}>{err}</p>}
      {st && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Model
              <input className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:shadow-[0_0_0_3px_var(--focus)]" style={{ borderColor: "var(--border)", background: "var(--surface-solid)", color: "var(--text)" }} value={model} onChange={(e) => setModel(e.target.value)} disabled={!canControl("ai_settings")} />
            </label>
            <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Temperature (0–2)
              <input className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:shadow-[0_0_0_3px_var(--focus)]" style={{ borderColor: "var(--border)", background: "var(--surface-solid)", color: "var(--text)" }} inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value.replace(/[^\d.]/g, ""))} disabled={!canControl("ai_settings")} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Tizim prompti
            <textarea className="min-h-[110px] rounded-[10px] border px-3 py-2 text-[13px] leading-relaxed outline-none focus:shadow-[0_0_0_3px_var(--focus)]" style={{ borderColor: "var(--border)", background: "var(--surface-solid)", color: "var(--text)" }} value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={!canControl("ai_settings")} />
          </label>
          <div className="rounded-[13px] border px-3.5 py-3" style={{ borderColor: activeAi ? "var(--border)" : "var(--warning)", background: activeAi ? "var(--surface-2)" : "var(--warning-soft)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0"><div className="text-[13px] font-bold">AI javoblari</div><div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{activeAi ? "AI barcha mijozlarga javob beradi" : "AI to'liq o'chadi, faqat operatorlar javob beradi"}</div></div>
              <button type="button" role="switch" aria-checked={activeAi} aria-label="AI javoblarini yoqish yoki o'chirish" onClick={() => toggleGlobalAi(!activeAi)} disabled={!canControl("ai_settings") || globalLoading || globalSaving} className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: activeAi ? "var(--primary)" : "var(--border-strong)" }}><span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: activeAi ? "translateX(24px)" : "translateX(4px)" }} /></button>
            </div>
            {!activeAi && <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--warning-ink)" }}>AI o'chirilgan. Mijoz xabarlari qabul qilinadi, lekin AI javob bermaydi.</p>}
          </div>
          <div className="flex justify-end">
            {canControl("ai_settings") && (
              <button onClick={save} disabled={saving} className={clsx("btn-primary !flex-none px-6", saving && "btn-loading")}>Saqlash</button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function IntegrationsSection() {
  const { canView, canControl } = usePerm();
  const showToast = useStore((s) => s.showToast);
  const [data, setData] = useState<IntegrationSettings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const visible = canView("integrations");
  useEffect(() => {
    if (!visible) return;
    api.integrations()
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
  }, [visible]);
  if (!visible) return null;

  const save = async () => {
    // faqat kiritilgan (bo'sh bo'lmagan) kalitlar yuboriladi — qolganlari o'zgarmaydi
    const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ""));
    if (!Object.keys(payload).length) return showToast("O'zgartirish kiritilmadi");
    setSaving(true);
    try {
      setData(await api.updateIntegrations(payload));
      setForm({});
      showToast("✓ Integratsiya kalitlari yangilandi");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const has = (v?: string) => (v && v.length ? "● o'rnatilgan" : "○ yo'q");

  return (
    <section className="glass p-5">
      <h2 className="mb-1 text-base font-bold">Integratsiyalar</h2>
      <p className="mb-3.5 text-[12px]" style={{ color: "var(--muted)" }}>
        Instagram / Telegram kalitlari — qiymatlar xavfsizlik uchun ko&apos;rsatilmaydi
      </p>
      {err && <p className="text-[13px] font-semibold" style={{ color: "var(--danger-ink)" }}>{err}</p>}
      {data && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
            <span>Instagram token: <b style={{ color: "var(--text-2)" }}>{has(data.instagram_access_token)}</b> · Akkaunt ID: <b style={{ color: "var(--text-2)" }}>{data.instagram_account_id || "—"}</b></span>
            <span>Telegram bot: <b style={{ color: "var(--text-2)" }}>{has(data.telegram_bot_token)}</b> · Business ID: <b style={{ color: "var(--text-2)" }}>{data.instagram_business_id || "—"}</b></span>
          </div>
          {canControl("integrations") && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SecretInput label="Instagram access token" value={form.instagram_access_token ?? ""} onChange={(v) => setForm((f) => ({ ...f, instagram_access_token: v }))} />
                <SecretInput label="Instagram verify token" value={form.instagram_verify_token ?? ""} onChange={(v) => setForm((f) => ({ ...f, instagram_verify_token: v }))} />
                <SecretInput label="Telegram bot token" value={form.telegram_bot_token ?? ""} onChange={(v) => setForm((f) => ({ ...f, telegram_bot_token: v }))} />
                <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Instagram akkaunt ID
                  <input className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:shadow-[0_0_0_3px_var(--focus)]" style={{ borderColor: "var(--border)", background: "var(--surface-solid)", color: "var(--text)" }} value={form.instagram_account_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, instagram_account_id: e.target.value }))} placeholder={data.instagram_account_id || "Masalan: 17800…"} />
                </label>
                <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Telegram guruh chat ID
                  <input
                    className="rounded-[10px] border px-3 py-2 text-[13px] normal-case tracking-normal outline-none focus:shadow-[0_0_0_3px_var(--focus)]"
                    style={{ borderColor: "var(--border)", background: "var(--surface-solid)", color: "var(--text)" }}
                    value={form.telegram_group_chat_id ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, telegram_group_chat_id: e.target.value }))}
                    placeholder={data.telegram_group_chat_id || "Masalan: -1001234567890"}
                  />
                  <span className="text-[10.5px] font-medium normal-case tracking-normal" style={{ color: "var(--muted)" }}>
                    Recall eslatmalari shu guruhga boradi; bo&apos;sh bo&apos;lsa .env qiymati ishlatiladi
                  </span>
                </label>
              </div>
              <button onClick={save} disabled={saving} className={clsx("btn-primary !flex-none self-end px-6", saving && "btn-loading")}>Saqlash</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function InstagramEventsSection() {
  const { canView } = usePerm();
  const [events, setEvents] = useState<InstagramEvent[] | null>(null);
  const [type, setType] = useState("");
  const [err, setErr] = useState("");

  const visible = canView("integrations") || canView("ai_settings");
  useEffect(() => {
    if (!visible) return;
    setEvents(null);
    api.instagramEvents(type ? { event_type: type, page_size: 30 } : { page_size: 30 })
      .then((e) => setEvents(e.slice(0, 30)))
      .catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
  }, [visible, type]);
  if (!visible) return null;

  return (
    <section className="glass col-span-full p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">Instagram hodisalari</h2>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>Webhook debug jadvali — oxirgi 30 ta hodisa</p>
        </div>
        <FilterSelect
          value={type}
          onChange={setType}
          label="Turi"
          options={EVENT_TYPES.map((t) => ({ value: t, label: t || "Barcha turlar" }))}
        />
      </div>
      {err && <p className="text-[13px] font-semibold" style={{ color: "var(--danger-ink)" }}>{err}</p>}
      {!err && events === null && <p className="text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
      {events && events.length === 0 && <p className="text-[13px]" style={{ color: "var(--muted)" }}>Hodisa topilmadi.</p>}
      {events && events.length > 0 && (
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid min-w-[600px] grid-cols-[110px_1fr_130px_130px_90px] gap-2 border-b px-3 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              <span>Turi</span><span>Matn / media</span><span>Yuboruvchi</span><span>Media/Story ID</span><span>Vaqt</span>
            </div>
            {events.map((e) => (
              <div key={e.id} className="row-lux grid min-w-[600px] grid-cols-[110px_1fr_130px_130px_90px] items-center gap-2 border-b px-3 py-2 text-[13px]" style={{ borderColor: "var(--line2)" }}>
                <span className="font-semibold" style={{ color: "var(--text-2)" }}>{e.event_type}</span>
                <span className="truncate" title={e.text || e.story_url || undefined}>{e.text || e.story_url || "—"}</span>
                <span className="truncate" style={{ color: "var(--muted)" }}>{e.sender_id || "—"}</span>
                <span className="truncate" style={{ color: "var(--muted)" }}>{e.media_id || e.story_id || "—"}</span>
                <span style={{ color: "var(--muted)" }}>{fmtTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
