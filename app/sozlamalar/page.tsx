"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { AISettingsSection } from "@/components/DevSections";
import { fmt, fmtDate, initials } from "@/lib/format";
import { Icon } from "@/components/icons";
import { ROLE_LABEL } from "@/components/badges";
import type { Branch, BusinessSettings, InstagramSettings, Packaging, User } from "@/lib/types";

const PKG_LABEL: Record<string, string> = { wrap: "O'ram", basket: "Savat", box: "Quti", accessory: "Aksessuar" };

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={clsx("relative h-[22px] w-[40px] rounded-full border transition-colors", on ? "" : "bg-bg2")}
      style={on ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)" }}
    >
      <span className={clsx("absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[20px]" : "left-[2px]")} />
    </button>
  );
}

export default function SozlamalarPage() {
  const { user, showToast } = useStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [packaging, setPackaging] = useState<Packaging[]>([]);
  const [ig, setIg] = useState<InstagramSettings | null>(null);
  const [st, setSt] = useState<BusinessSettings | null>(null);
  const [fee, setFee] = useState("");
  const [savingFee, setSavingFee] = useState(false);

  useEffect(() => {
    Promise.all([
      api.branches(),
      api.packaging({ is_active: true }),
      api.instagramStatus(),
      api.settings(),
    ])
      .then(([bs, ps, igs, sts]) => {
        setBranches(bs); setPackaging(ps); setIg(igs); setSt(sts);
        setFee(String(Math.round(parseFloat(sts.default_florist_fee) || 0)));
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  }, [showToast]);

  const toggleIg = async (key: "auto_reply_dm" | "auto_reply_post_reply" | "auto_reply_story_reply", v: boolean) => {
    if (!ig) return;
    const prev = ig;
    setIg({ ...ig, [key]: v });
    try {
      setIg(await api.updateInstagramStatus({ [key]: v }));
    } catch {
      setIg(prev);
      showToast("Saqlab bo'lmadi");
    }
  };

  const saveFee = async () => {
    if (!st) return;
    setSavingFee(true);
    try {
      const upd = await api.updateSettings({ default_florist_fee: String(+fee || 0) });
      setSt(upd);
      showToast("✓ Florist haqi yangilandi");
    } catch {
      showToast("Saqlab bo'lmadi");
    } finally {
      setSavingFee(false);
    }
  };

  const fullName = (u: User) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username;

  return (
    <div className="grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
      {/* Instagram — jonli status */}
      <section className="glass p-5">
        <h2 className="text-base font-bold">Instagram ulanishi</h2>
        <p className="mb-3.5 text-[13px]" style={{ color: "var(--mut)" }}>AI shu akkaunt orqali DM va reply&apos;larga javob beradi</p>
        <div className="flex items-center gap-3 rounded-[14px] border bg-tint px-4 py-3" style={{ borderColor: "var(--line)" }}>
          <div className="flex h-[42px] w-[42px] -rotate-3 items-center justify-center rounded-[13px] font-bold text-white" style={{ background: "var(--acc)" }}>EF</div>
          <div className="flex-1">
            <div className="text-[14px] font-bold">@{ig?.account_username || "—"}</div>
            {ig?.connected ? (
              <div className="text-xs font-bold text-mintink">
                ● Ulangan{ig.token_expires_at ? ` · token ${fmtDate(ig.token_expires_at)} gacha` : ""}
              </div>
            ) : (
              <div className="text-xs font-bold text-roseink">○ Ulanmagan — access token yo&apos;q</div>
            )}
          </div>
        </div>
        {ig && (
          <>
            {([
              ["DM'larga avtomatik javob", "auto_reply_dm"],
              ["Post reply'larga javob", "auto_reply_post_reply"],
              ["Story reply'larga javob", "auto_reply_story_reply"],
            ] as const).map(([label, key]) => (
              <div key={key} className="mt-3 flex items-center justify-between text-[13px]">
                <span style={{ color: "var(--mut)" }}>{label}</span>
                <Toggle on={ig[key]} onChange={(v) => toggleIg(key, v)} />
              </div>
            ))}
          </>
        )}
      </section>

      {/* Narx sozlamalari */}
      <section className="glass p-5">
        <h2 className="mb-3.5 text-base font-bold">Narx sozlamalari</h2>
        <div className="flex items-center justify-between gap-3 border-b py-2.5" style={{ borderColor: "var(--line2)" }}>
          <span className="text-[14px]">Florist xizmat haqi</span>
          <span className="flex items-center gap-2">
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))}
              className="w-[110px] rounded-[10px] border bg-sfc px-2.5 py-1.5 text-right text-[14px] font-bold outline-none"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
            <button onClick={saveFee} disabled={savingFee} className="rounded-[10px] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60" style={{ background: "var(--acc)" }}>
              {savingFee ? "…" : "Saqlash"}
            </button>
          </span>
        </div>
        {packaging.map((p) => (
          <div key={p.id} className="flex items-center justify-between border-b py-2.5" style={{ borderColor: "var(--line2)" }}>
            <span className="text-[14px]">
              {p.name_uz || p.name_ru}
              <span className="ml-2 rounded-full bg-tint px-2 py-0.5 text-[11px] font-bold text-tintink">{PKG_LABEL[p.packaging_type] ?? p.packaging_type}</span>
            </span>
            <span className="text-right">
              <b className="text-sm">{fmt(p.sale_price)}</b>
              <span className="block text-[11px]" style={{ color: "var(--mut)" }}>{p.quantity} dona bor</span>
            </span>
          </div>
        ))}
        <p className="mt-2.5 text-xs" style={{ color: "var(--mut)" }}>AI savat/quti tavsiyasida shu narxlardan foydalanadi.</p>
      </section>

      {/* AI qoidalari — serverdan */}
      <section className="glass p-5 text-[#F0E9FA]" style={{ background: "color-mix(in srgb, var(--side) 82%, transparent)" }}>
        <h2 className="mb-3.5 text-base font-bold">AI qoidalari</h2>
        <ul className="flex flex-col gap-2 text-[13px] leading-relaxed opacity-90">
          <li>• {st?.approximate_price_wording_uz || "Narxlar taxminiy beriladi."}</li>
          <li>• {st?.min_sale_reminder_uz || "Minimal sotuv soni eslatiladi."}</li>
          <li>• {st?.handoff_rules_uz || "Mijoz tayyor bo'lganda suhbat operatorga uzatiladi."}</li>
          <li>• Buket/savat narxiga florist haqi qo&apos;shiladi: <b>{st ? fmt(st.default_florist_fee) : "—"}</b></li>
        </ul>
      </section>

      {/* Jamoa endi alohida sahifada — /xodimlar */}
      <section className="glass p-5">
        <h2 className="text-base font-semibold">Jamoa</h2>
        <p className="mb-3 mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
          Xodimlar, rollar va ruxsatlar boshqaruvi alohida sahifaga ko&apos;chdi.
        </p>
        <a href="/xodimlar" className="btn-secondary !flex-none inline-flex px-5">
          <Icon name="xodimlar" size={16} /> Xodimlar sahifasi →
        </a>
      </section>

      {/* Filiallar */}
      <section className="glass p-5">
        <h2 className="mb-3.5 text-base font-bold">Filiallar</h2>
        <div className="flex flex-col gap-3">
          {branches.map((b) => (
            <div key={b.id} className="rounded-[14px] border bg-tint px-4 py-3" style={{ borderColor: "var(--line2)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold">{b.name}</span>
                <span className="rounded-full border bg-sfc px-2.5 py-0.5 text-[11px] font-bold" style={{ borderColor: "var(--line2)" }}>{b.code}</span>
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--mut)" }}>{b.address || "manzil yo'q"} · {b.phone || "tel yo'q"}</div>
              {!b.is_active && <div className="mt-1 text-[11px] font-bold text-roseink">Nofaol</div>}
            </div>
          ))}
          {branches.length === 0 && <p className="text-[13px]" style={{ color: "var(--mut)" }}>Filial topilmadi.</p>}
        </div>
      </section>

      {/* Hisob */}
      <section className="glass p-5">
        <h2 className="mb-3.5 text-base font-bold">Hisob</h2>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 -rotate-3 items-center justify-center rounded-xl bg-tint text-[14px] font-bold text-tintink">{user ? initials(fullName(user)) : "…"}</div>
          <div className="flex-1">
            <div className="text-[14px] font-bold">{user ? fullName(user) : "…"}</div>
            <div className="text-xs" style={{ color: "var(--mut)" }}>{user?.email || user?.username}</div>
          </div>
          <span className="rounded-full border bg-tint px-3 py-0.5 text-[11px] font-bold text-tintink" style={{ borderColor: "var(--line2)" }}>
            {user ? ROLE_LABEL[user.profile.role] ?? user.profile.role : "…"}
          </span>
        </div>
        <div className="mt-3 flex justify-between border-t pt-3 text-[13px]" style={{ borderColor: "var(--line2)" }}>
          <span style={{ color: "var(--mut)" }}>Til</span>
          <b className="uppercase">{user?.profile.language ?? "—"}</b>
        </div>
        <div className="mt-2 flex justify-between text-[13px]">
          <span style={{ color: "var(--mut)" }}>Filiallar</span>
          <b>{user?.profile.branches.map((b) => b.code).join(", ") || "—"}</b>
        </div>
      </section>

      {/* Developer bo'limi — ruxsatga qarab ko'rinadi; integratsiyalar va
          audit jurnali alohida sahifalarga ko'chdi */}
      <AISettingsSection />

    </div>
  );
}
