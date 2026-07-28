"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import { Icon } from "./icons";
import { fmt } from "@/lib/format";
import { VOLUME_LABEL, stems } from "@/lib/inventory";
import type { CatalogVolume, FloristVolumeRate } from "@/lib/types";

const VOLS: CatalogVolume[] = ["small", "medium", "large"];
const ARRS: ("bouquet" | "basket")[] = ["bouquet", "basket"];
const ARR_LABEL = { bouquet: "Buket", basket: "Savat" } as const;

/** Hajm tariflari MATRITSASI — qator=hajm, ustun=turi. Har katak inline tahrirlanadi.
    Katalog yaratilganda florist_fee ko'rsatilmasa shu tarif ishlatiladi. */
export default function VolumeRateMatrix() {
  const { showToast } = useStore();
  const { canControl: can } = usePerm();
  const canControl = can("settings");
  const [rates, setRates] = useState<FloristVolumeRate[] | null>(null);
  const [edit, setEdit] = useState<{ rate: FloristVolumeRate | null; volume: CatalogVolume; arr: "bouquet" | "basket" } | null>(null);

  const load = useCallback(() => {
    api.floristVolumeRates({ ordering: "volume" }).then(setRates).catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const cell = (v: CatalogVolume, a: "bouquet" | "basket") => rates?.find((r) => r.volume === v && r.arrangement_type === a);

  return (
    <>
      <p className="mb-3 text-[13px]" style={{ color: "var(--muted)" }}>
        Katalog yaratilganda florist haqi ko&apos;rsatilmasa, shu tarif avtomatik ishlatiladi.
      </p>
      <div className="glass overflow-x-auto !rounded-[18px] p-4">
        <div className="grid min-w-[420px] gap-2" style={{ gridTemplateColumns: "90px 1fr 1fr" }}>
          <div />
          {ARRS.map((a) => (
            <div key={a} className="pb-1 text-center text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{ARR_LABEL[a]}</div>
          ))}
          {VOLS.map((v) => (
            <FragmentRow key={v} label={VOLUME_LABEL[v]}>
              {ARRS.map((a) => {
                const c = cell(v, a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => canControl && setEdit({ rate: c ?? null, volume: v, arr: a })}
                    className="flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-[13px] border transition-colors duration-150 hover:border-[color:var(--primary)]"
                    style={{ borderColor: "var(--border)", background: c ? "var(--surface-2)" : "transparent", opacity: c && !c.is_active ? 0.5 : 1 }}
                  >
                    {c ? (
                      <>
                        <span className="flex items-center gap-1.5 text-[14px] font-bold" style={{ color: "var(--acc)" }}>
                          {c.is_active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success, #3d8a5f)" }} />}
                          {fmt(c.florist_fee)}
                        </span>
                        <span className="text-[11px]" style={{ color: "var(--muted)" }}>{stems(c.default_stems)}</span>
                      </>
                    ) : (
                      <span style={{ color: "var(--muted)" }}><Plus size={18} strokeWidth={2} /></span>
                    )}
                  </button>
                );
              })}
            </FragmentRow>
          ))}
        </div>
        {rates === null && <p className="mt-3 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
      </div>

      {edit && (
        <RateEditModal
          init={edit}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); }}
        />
      )}
    </>
  );
}

function FragmentRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center text-[13px] font-bold">{label}</div>
      {children}
    </>
  );
}

function RateEditModal({ init, onClose, onSaved }: { init: { rate: FloristVolumeRate | null; volume: CatalogVolume; arr: "bouquet" | "basket" }; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useStore();
  const [fee, setFee] = useState(init.rate?.florist_fee ? String(Math.round(+init.rate.florist_fee)) : "");
  const [dStems, setDStems] = useState(init.rate?.default_stems ? String(init.rate.default_stems) : "");
  const [active, setActive] = useState(init.rate?.is_active ?? true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      // single-branch: `branch` yuborilmaydi — backend default filialni qo'yadi
      const payload = {
        arrangement_type: init.arr,
        volume: init.volume,
        default_stems: +dStems || 0,
        florist_fee: fee ? String(+fee) : "0",
        is_active: active,
      };
      if (init.rate) await api.updateVolumeRate(init.rate.id, payload);
      else await api.createVolumeRate(payload);
      showToast("✓ Tarif saqlandi");
      onSaved();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={400}>
      <ModalHeader icon={<Icon name="katalog" size={20} />} title={`${VOLUME_LABEL[init.volume]} · ${ARR_LABEL[init.arr]}`} sub="Standart florist haqi" onClose={onClose} />
      <div className="grid grid-cols-1 gap-3">
        <Field label="Florist haqi (so'm)" span><input className="inp" type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Masalan: 50000" autoFocus /></Field>
        <Field label="Standart dona" span><input className="inp" type="number" value={dStems} onChange={(e) => setDStems(e.target.value)} placeholder="Masalan: 25" /></Field>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: "var(--text-2)" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Faol
        </label>
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
      </ModalFooter>
    </Modal>
  );
}
