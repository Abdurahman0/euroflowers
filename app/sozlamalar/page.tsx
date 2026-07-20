"use client";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmt, fmtDate } from "@/lib/format";
import BranchModal from "@/components/BranchModal";
import FilterSelect from "@/components/FilterSelect";
import SearchInput from "@/components/SearchInput";
import type { Branch, BusinessSettings, InstagramSettings, Packaging } from "@/lib/types";

/**
 * Sozlamalar: Instagram ulanishi, narx sozlamalari (ko'p pozitsiyali
 * to'liq kenglikdagi karta-grid, narx/qoldiq tahriri) va filiallar CRUD.
 * Jamoa /xodimlar'da; interfeys rejimi login sahifasida tanlanadi.
 */

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
  const { showToast } = useStore();
  const { canControl } = usePerm();
  const control = canControl("settings");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [packaging, setPackaging] = useState<Packaging[]>([]);
  const [ig, setIg] = useState<InstagramSettings | null>(null);
  const [st, setSt] = useState<BusinessSettings | null>(null);
  const [fee, setFee] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  // o'ram/savat narx-qoldiq tahriri
  const [pkgEdit, setPkgEdit] = useState<{ id: number; price: string; qty: string } | null>(null);
  const [pkgSaving, setPkgSaving] = useState(false);
  const [pkgType, setPkgType] = useState("");
  const [pkgQ, setPkgQ] = useState("");
  // filial modali
  const [branchModal, setBranchModal] = useState<{ open: boolean; edit: Branch | null }>({ open: false, edit: null });

  useEffect(() => {
    Promise.all([api.branches(), api.packaging({ is_active: true }), api.instagramStatus(), api.settings()])
      .then(([bs, ps, igs, sts]) => {
        setBranches(bs);
        setPackaging(ps);
        setIg(igs);
        setSt(sts);
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

  const onBranchSaved = (b: Branch) => {
    setBranches((bs) => {
      const i = bs.findIndex((x) => x.id === b.id);
      return i >= 0 ? bs.map((x) => (x.id === b.id ? b : x)) : [...bs, b];
    });
    setBranchModal({ open: false, edit: null });
  };

  const fPackaging = useMemo(() => {
    const q = pkgQ.trim().toLowerCase();
    return packaging.filter((p) => {
      if (pkgType && p.packaging_type !== pkgType) return false;
      if (!q) return true;
      return [p.name_uz, p.name_ru].some((x) => (x ?? "").toLowerCase().includes(q));
    });
  }, [packaging, pkgType, pkgQ]);

  const startPkgEdit = (p: Packaging) =>
    setPkgEdit({ id: p.id, price: String(Math.round(+p.sale_price) || 0), qty: String(p.quantity) });

  return (
    <div className="flex flex-col gap-4">
      {/* ===== Narx sozlamalari — to'liq kenglik, karta-grid ===== */}
      <section className="glass p-5">
        <div className="mb-3.5 flex flex-wrap items-center gap-3">
          <div className="min-w-[200px]">
            <h2 className="text-base font-bold">Narx sozlamalari</h2>
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              {packaging.length} pozitsiya · AI savat/quti tavsiyasida shu narxlardan foydalanadi.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SearchInput value={pkgQ} onChange={setPkgQ} placeholder="Qidirish…" width={140} ariaLabel="O'ram qidirish" />
            <FilterSelect
              value={pkgType}
              onChange={setPkgType}
              label="Turi"
              options={[{ value: "", label: "Barcha turlar" }, ...Object.entries(PKG_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
            />
          </div>
        </div>

        {/* florist haqi — ajratilgan panel */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-3.5 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <span className="text-[13px] font-semibold">Florist xizmat haqi (har bir buket/savatga qo&apos;shiladi)</span>
          <span className="flex items-center gap-2">
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              aria-label="Florist xizmat haqi (so'm)"
              className="inp !h-9 !w-[110px] !px-2.5 text-right !text-[13px] font-bold"
              disabled={!control}
            />
            {control && (
              <button onClick={saveFee} disabled={savingFee} className={clsx("btn-primary !h-9 !flex-none px-3.5 !text-[12px]", savingFee && "btn-loading")}>
                Saqlash
              </button>
            )}
          </span>
        </div>

        {/* pozitsiyalar — karta-grid (ko'p bo'lsa ham tartibli) */}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(235px,1fr))" }}>
          {fPackaging.map((p) => {
            const editing = pkgEdit?.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => !editing && control && startPkgEdit(p)}
                className={clsx(
                  "group rounded-[14px] border p-3 transition-colors duration-180",
                  control && !editing && "cursor-pointer hover:border-[color:var(--primary)]"
                )}
                style={{ borderColor: editing ? "var(--primary)" : "var(--border)", background: "var(--surface-solid)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-[8px] bg-tint px-2 py-0.5 text-[11px] font-bold text-tintink">{PKG_LABEL[p.packaging_type] ?? p.packaging_type}</span>
                  {control && !editing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); startPkgEdit(p); }}
                      title="Narxni tahrirlash"
                      aria-label="Narxni tahrirlash"
                      className="icon-btn !h-7 !w-7 opacity-60 transition-opacity duration-180 group-hover:opacity-100"
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                <div className="mt-1.5 truncate text-[14px] font-semibold" title={p.name_uz || p.name_ru}>{p.name_uz || p.name_ru}</div>
                {editing && pkgEdit ? (
                  <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={pkgEdit.price}
                      onChange={(e) => setPkgEdit({ ...pkgEdit, price: e.target.value.replace(/\D/g, "") })}
                      onKeyDown={(e) => e.key === "Enter" && savePkg()}
                      inputMode="numeric"
                      autoFocus
                      aria-label="Sotuv narxi (so'm)"
                      className="inp !h-9 min-w-0 flex-1 !px-2 text-right !text-[13px] font-bold"
                    />
                    <input
                      value={pkgEdit.qty}
                      onChange={(e) => setPkgEdit({ ...pkgEdit, qty: e.target.value.replace(/\D/g, "") })}
                      onKeyDown={(e) => e.key === "Enter" && savePkg()}
                      inputMode="numeric"
                      aria-label="Qoldiq (dona)"
                      className="inp !h-9 !w-[58px] !px-2 text-right !text-[13px]"
                    />
                    <button onClick={savePkg} disabled={pkgSaving} title="Saqlash" aria-label="Saqlash" className="icon-btn !h-9 !w-9 shrink-0" style={{ color: "var(--success-ink)" }}>
                      <Check size={16} strokeWidth={2} />
                    </button>
                    <button onClick={() => setPkgEdit(null)} title="Bekor" aria-label="Bekor" className="icon-btn icon-btn-danger !h-9 !w-9 shrink-0">
                      <X size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <b className="text-[15px]" style={{ color: "var(--primary)" }}>{fmt(p.sale_price)}</b>
                    <span className="text-[11px]" style={{ color: "var(--muted)" }}>{p.quantity} dona</span>
                  </div>
                )}
              </div>
            );
          })}
          {fPackaging.length === 0 && (
            <p className="col-span-full py-3 text-[13px]" style={{ color: "var(--muted)" }}>
              {pkgQ || pkgType ? "Filtrga mos pozitsiya topilmadi." : "O'ram/savat topilmadi."}
            </p>
          )}
        </div>
      </section>

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        {/* ===== Instagram — jonli status ===== */}
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

        {/* ===== Filiallar — boshqariladigan ro'yxat ===== */}
        <section className="glass p-5">
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold">Filiallar</h2>
            {control && (
              <button onClick={() => setBranchModal({ open: true, edit: null })} className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-bold text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: "var(--primary)" }}>
                <Plus size={15} strokeWidth={1.75} /> Filial
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            {branches.map((b) => (
              <div
                key={b.id}
                onClick={() => control && setBranchModal({ open: true, edit: b })}
                className={clsx("group rounded-[14px] border bg-tint px-4 py-3 transition-colors duration-180", control && "cursor-pointer hover:border-[color:var(--primary)]")}
                style={{ borderColor: "var(--line2)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold" title={b.name}>{b.name}</span>
                  {!b.is_active && <span className="rounded-full bg-rose px-2 py-0.5 text-[10px] font-bold text-roseink">NOFAOL</span>}
                  <span className="rounded-full border bg-sfc px-2.5 py-0.5 text-[11px] font-bold" style={{ borderColor: "var(--line2)" }}>{b.code}</span>
                  {control && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setBranchModal({ open: true, edit: b }); }}
                      title="Tahrirlash"
                      aria-label={`${b.name} filialini tahrirlash`}
                      className="icon-btn !h-7 !w-7 opacity-60 transition-opacity duration-180 group-hover:opacity-100"
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                <div className="mt-1 truncate text-xs" style={{ color: "var(--mut)" }} title={`${b.address || "manzil yo'q"} · ${b.phone || "tel yo'q"}`}>
                  {b.address || "manzil yo'q"} · {b.phone || "tel yo'q"}
                </div>
              </div>
            ))}
            {branches.length === 0 && <p className="text-[13px]" style={{ color: "var(--mut)" }}>Filial topilmadi.</p>}
          </div>
        </section>
      </div>

      {branchModal.open && (
        <BranchModal branch={branchModal.edit} onClose={() => setBranchModal({ open: false, edit: null })} onSaved={onBranchSaved} />
      )}
    </div>
  );
}
