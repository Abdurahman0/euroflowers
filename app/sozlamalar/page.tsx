"use client";
import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmt, fmtDate, initials } from "@/lib/format";
import { Icon } from "@/components/icons";
import UiModeSwitch from "@/components/UiModeSwitch";
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
  const { canControl } = usePerm();
  const usersControlSafe = canControl("settings");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [packaging, setPackaging] = useState<Packaging[]>([]);
  const [ig, setIg] = useState<InstagramSettings | null>(null);
  const [st, setSt] = useState<BusinessSettings | null>(null);
  const [fee, setFee] = useState("");
  // o'ram/savat narx-qoldiq tahriri: qaysi qator ochiq + qiymatlar
  const [pkgEdit, setPkgEdit] = useState<{ id: number; price: string; qty: string } | null>(null);
  const [pkgSaving, setPkgSaving] = useState(false);
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

  const savePkg = async () => {
    if (!pkgEdit) return;
    setPkgSaving(true);
    try {
      const upd = await api.updatePackaging(pkgEdit.id, {
        sale_price: String(+pkgEdit.price || 0),
        quantity: +pkgEdit.qty || 0,
      });
      setPackaging((ps) => ps.map((x) => (x.id === upd.id ? { ...x, ...upd } : x)));
      showToast("✓ Narx yangilandi");
      setPkgEdit(null);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
    } finally {
      setPkgSaving(false);
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
      {/* Interfeys rejimi — login'dagi tanlov bilan bitta kalit (ef_uimode) */}
      <section className="glass p-5">
        <h2 className="mb-1 text-base font-bold">Interfeys rejimi</h2>
        <p className="mb-3 text-[13px]" style={{ color: "var(--muted)" }}>
          Darhol qo&apos;llanadi — qayta yuklash shart emas.
        </p>
        <UiModeSwitch />
      </section>

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

      {/* Narx sozlamalari — narx va qoldiq shu yerda tahrirlanadi */}
      <section className="glass p-5">
        <h2 className="mb-1 text-base font-bold">Narx sozlamalari</h2>
        <p className="mb-3 text-[13px]" style={{ color: "var(--muted)" }}>
          AI savat/quti tavsiyasida shu narxlardan foydalanadi.
        </p>

        {/* florist haqi — alohida ajratilgan qator */}
        <div className="flex items-center justify-between gap-3 rounded-[12px] border px-3.5 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <span className="text-[13px] font-semibold">Florist xizmat haqi</span>
          <span className="flex items-center gap-2">
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              aria-label="Florist xizmat haqi (so'm)"
              className="inp !h-9 !w-[110px] !px-2.5 text-right !text-[13px] font-bold"
            />
            <button onClick={saveFee} disabled={savingFee} className={`btn-primary !h-9 !flex-none px-3.5 !text-[12px] ${savingFee ? "btn-loading" : ""}`}>
              Saqlash
            </button>
          </span>
        </div>

        {/* o'ram/savat/quti — har bir qator tahrirlanadi */}
        <div className="mt-3 flex flex-col">
          {packaging.map((p) => {
            const editing = pkgEdit?.id === p.id;
            return (
              <div key={p.id} className="row-lux group flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--line2)" }}
                onClick={() => !editing && usersControlSafe && setPkgEdit({ id: p.id, price: String(Math.round(+p.sale_price) || 0), qty: String(p.quantity) })}
              >
                <span className="rounded-[9px] bg-tint px-2 py-1 text-[11px] font-bold text-tintink">{PKG_LABEL[p.packaging_type] ?? p.packaging_type}</span>
                <span className="min-w-[90px] flex-1 truncate text-[14px] font-medium" title={p.name_uz || p.name_ru}>{p.name_uz || p.name_ru}</span>
                {editing ? (
                  <span className="flex w-full items-center justify-end gap-1.5 sm:w-auto" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={pkgEdit.price}
                      onChange={(e) => setPkgEdit({ ...pkgEdit, price: e.target.value.replace(/\D/g, "") })}
                      onKeyDown={(e) => e.key === "Enter" && savePkg()}
                      inputMode="numeric"
                      autoFocus
                      aria-label="Sotuv narxi (so'm)"
                      className="inp !h-9 !w-[96px] !px-2 text-right !text-[13px] font-bold"
                    />
                    <input
                      value={pkgEdit.qty}
                      onChange={(e) => setPkgEdit({ ...pkgEdit, qty: e.target.value.replace(/\D/g, "") })}
                      onKeyDown={(e) => e.key === "Enter" && savePkg()}
                      inputMode="numeric"
                      aria-label="Qoldiq (dona)"
                      className="inp !h-9 !w-[64px] !px-2 text-right !text-[13px]"
                    />
                    <button onClick={savePkg} disabled={pkgSaving} title="Saqlash" aria-label="Saqlash" className="icon-btn !h-9 !w-9" style={{ color: "var(--success-ink)" }}>
                      <Check size={16} strokeWidth={2} />
                    </button>
                    <button onClick={() => setPkgEdit(null)} title="Bekor" aria-label="Bekor" className="icon-btn icon-btn-danger !h-9 !w-9">
                      <X size={16} strokeWidth={1.75} />
                    </button>
                  </span>
                ) : (
                  <>
                    <span className="text-right">
                      <b className="text-sm">{fmt(p.sale_price)}</b>
                      <span className="block text-[11px]" style={{ color: "var(--muted)" }}>{p.quantity} dona bor</span>
                    </span>
                    {usersControlSafe && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPkgEdit({ id: p.id, price: String(Math.round(+p.sale_price) || 0), qty: String(p.quantity) }); }}
                        title="Narxni tahrirlash"
                        aria-label="Narxni tahrirlash"
                        className="row-actions icon-btn"
                      >
                        <Pencil size={16} strokeWidth={1.75} />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {packaging.length === 0 && <p className="py-2 text-[13px]" style={{ color: "var(--muted)" }}>O&apos;ram/savat topilmadi.</p>}
        </div>
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
          <div className="avatar-lead flex h-11 w-11 -rotate-3 items-center justify-center rounded-xl text-[14px] font-bold">{user ? initials(fullName(user)) : "…"}</div>
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


    </div>
  );
}
