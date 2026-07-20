"use client";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import BranchModal from "@/components/BranchModal";
import FilterSelect from "@/components/FilterSelect";
import SearchInput from "@/components/SearchInput";
import type { Branch, BusinessSettings, Packaging } from "@/lib/types";

/**
 * Sozlamalar: narx sozlamalari (florist haqi kartasi + ko'p pozitsiyali
 * karta-grid, narx/qoldiq tahriri) va filiallar CRUD.
 * Jamoa /xodimlar'da; interfeys rejimi login sahifasida tanlanadi.
 */

const PKG_LABEL: Record<string, string> = { wrap: "O'ram", basket: "Savat", box: "Quti", accessory: "Aksessuar" };

export default function SozlamalarPage() {
  const { showToast } = useStore();
  const { canControl } = usePerm();
  const control = canControl("settings");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [packaging, setPackaging] = useState<Packaging[]>([]);
  const [st, setSt] = useState<BusinessSettings | null>(null);
  const [fee, setFee] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  const [feeEditing, setFeeEditing] = useState(false);
  // o'ram/savat narx-qoldiq tahriri
  const [pkgEdit, setPkgEdit] = useState<{ id: number; price: string } | null>(null);
  const [pkgSaving, setPkgSaving] = useState(false);
  const [pkgType, setPkgType] = useState("");
  const [pkgQ, setPkgQ] = useState("");
  // filial modali
  const [branchModal, setBranchModal] = useState<{ open: boolean; edit: Branch | null }>({ open: false, edit: null });

  useEffect(() => {
    Promise.all([api.branches(), api.packaging({ is_active: true }), api.settings()])
      .then(([bs, ps, sts]) => {
        setBranches(bs);
        setPackaging(ps);
        setSt(sts);
        setFee(String(Math.round(parseFloat(sts.default_florist_fee) || 0)));
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  }, [showToast]);

  const savePkg = async () => {
    if (!pkgEdit) return;
    setPkgSaving(true);
    try {
      const upd = await api.updatePackaging(pkgEdit.id, {
        sale_price: String(+pkgEdit.price || 0),
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
      setFeeEditing(false);
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
    setPkgEdit({ id: p.id, price: String(Math.round(+p.sale_price) || 0) });

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

        {/* pozitsiyalar — karta-grid (ko'p bo'lsa ham tartibli) */}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(235px,1fr))" }}>
          {/* florist xizmat haqi — xuddi shu uslubdagi alohida karta */}
          <div
            onClick={() => !feeEditing && control && setFeeEditing(true)}
            className={clsx("group rounded-[14px] border p-3 transition-colors duration-180", control && !feeEditing && "cursor-pointer hover:border-[color:var(--primary)]")}
            style={{ borderColor: feeEditing ? "var(--primary)" : "var(--border)", background: "var(--primary-soft)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-[8px] px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: "var(--primary)" }}>Xizmat haqi</span>
              {control && !feeEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFeeEditing(true); }}
                  title="Tahrirlash"
                  aria-label="Florist haqini tahrirlash"
                  className="icon-btn !h-7 !w-7 opacity-60 transition-opacity duration-180 group-hover:opacity-100"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                </button>
              )}
            </div>
            <div className="mt-1.5 truncate text-[14px] font-semibold">Florist xizmat haqi</div>
            {feeEditing ? (
              <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <input
                  value={fee}
                  onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && saveFee()}
                  inputMode="numeric"
                  autoFocus
                  aria-label="Florist xizmat haqi (so'm)"
                  className="inp !h-9 min-w-0 flex-1 !px-2 text-right !text-[13px] font-bold"
                />
                <button onClick={saveFee} disabled={savingFee} title="Saqlash" aria-label="Saqlash" className="icon-btn !h-9 !w-9 shrink-0" style={{ color: "var(--success-ink)" }}>
                  <Check size={16} strokeWidth={2} />
                </button>
                <button onClick={() => setFeeEditing(false)} title="Bekor" aria-label="Bekor" className="icon-btn icon-btn-danger !h-9 !w-9 shrink-0">
                  <X size={16} strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <b className="text-[15px]" style={{ color: "var(--primary-strong)" }}>{st ? fmt(st.default_florist_fee) : "—"}</b>
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>har buketga</span>
              </div>
            )}
          </div>
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
                    <button onClick={savePkg} disabled={pkgSaving} title="Saqlash" aria-label="Saqlash" className="icon-btn !h-9 !w-9 shrink-0" style={{ color: "var(--success-ink)" }}>
                      <Check size={16} strokeWidth={2} />
                    </button>
                    <button onClick={() => setPkgEdit(null)} title="Bekor" aria-label="Bekor" className="icon-btn icon-btn-danger !h-9 !w-9 shrink-0">
                      <X size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-1">
                    <b className="text-[15px]" style={{ color: "var(--primary)" }}>{fmt(p.sale_price)}</b>
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
