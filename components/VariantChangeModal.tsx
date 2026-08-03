"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Repeat2 } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import Select from "./Select";
import FlowerLoader from "./FlowerLoader";
import {
  buildVariantChangePayload, variantUsageLines,
  VARIANT_CHANGE_MISUSE, VARIANT_CHANGE_EFFECT, VARIANT_CHANGE_IRREVERSIBLE,
} from "@/lib/inventory";
import type { BatchUsage, FlowerVariant, StockBatch } from "@/lib/types";

const vLabel = (x: FlowerVariant) =>
  `${x.flower_detail?.name_uz ?? "Gul"} · ${x.name_uz ?? ""}${x.color_uz ? ` · ${x.color_uz}` : ""}`.replace(/ · $/, "");

/**
 * NAVNI ALMASHTIRISH — ishlatilgan partiya uchun (POST change-variant/).
 *
 * ⚠️ QAYTARIB BO'LMAYDI: OpenAPI'da teskari amal YO'Q. Ikkinchi marta eski navga
 * qaytarish «undo» EMAS — auditda IKKITA yozuv qoladi.
 * ⚠️ Narx/son/foyda O'ZGARMAYDI — faqat ko'rinadigan gul NOMI (sotilgan tarix ham).
 */
export default function VariantChangeModal({ batch, usage, variants, onClose, onDone }: {
  batch: StockBatch;
  /** oldindan olingan usage (tugma bosilganda GET qilinadi — taxmin qilmaymiz) */
  usage: BatchUsage | null;
  variants: FlowerVariant[];
  onClose: () => void;
  onDone: (updated: StockBatch) => void;
}) {
  const { showToast } = useStore();
  const currentId = batch.variant ?? batch.variant_detail?.id ?? 0;
  const [variant, setVariant] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState("");
  const [done, setDone] = useState<StockBatch | null>(null);

  // ⚠️ Joriy nav ro'yxatdan CHIQARILADI — «Bu nav allaqachon tanlangan» 400'i
  // UI orqali umuman qo'zg'atilmaydi.
  const options = variants.filter((x) => x.id !== currentId).map((x) => ({ value: x.id, label: vLabel(x) }));
  const payload = buildVariantChangePayload(variant, reason, currentId);
  const lines = variantUsageLines(usage);
  const oldLabel = usage?.variant || (batch.variant_detail ? vLabel(batch.variant_detail as FlowerVariant) : "—");

  const submit = async () => {
    if (!payload) {
      // sabab bo'sh bo'lsa — AYNAN reason maydoniga bog'laymiz
      if (!(variant > 0)) return setErrs({ variant: "Yangi navni tanlang" });
      return setErrs({ reason: "Sabab majburiy — audit jurnaliga yoziladi" });
    }
    setBusy(true); setErrs({}); setDetail("");
    try {
      const upd = await api.changeBatchVariant(batch.id, payload);
      setDone(upd);
      // ⚠️ Pul SILJIMASLIGI kerak — lekin buni TAXMIN qilmay, qayta yuklab ko'rsatamiz.
      notifyReportDataChanged();
    } catch (e) {
      // uchala 400 ham AYNAN ko'rsatiladi (sabab — maydon ostida, qolgani — pastda)
      if (e instanceof ApiError && e.fieldErrors) setErrs(e.fieldErrors);
      if (e instanceof ApiError && !e.fieldErrors) setDetail(e.message);
      else if (!(e instanceof ApiError)) setDetail("Navni almashtirib bo'lmadi");
      setBusy(false);
    }
  };

  // ═══ MUVAFFAQIYAT — serverning variant_change xulosasi ═══
  if (done) {
    const vc = done.variant_change;
    return (
      <Modal onClose={() => { onDone(done); onClose(); }} width={460}>
        <ModalHeader icon={<Repeat2 size={19} strokeWidth={1.8} />} title="Nav almashtirildi" sub={`№${batch.batch_number}`} onClose={() => { onDone(done); onClose(); }} />
        <div className="mt-1 rounded-[14px] border p-3.5" style={{ borderColor: "var(--primary)", background: "var(--primary-soft)" }}>
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
            <span style={{ color: "var(--muted)" }}>{vc?.old_variant ?? oldLabel}</span>
            <ArrowRight size={14} strokeWidth={2.2} style={{ color: "var(--primary)" }} />
            <span style={{ color: "var(--primary)" }}>{vc?.new_variant ?? options.find((o) => o.value === variant)?.label}</span>
          </div>
          {vc?.history_rows_updated != null && (
            <p className="mt-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              Sotuv tarixida <b>{vc.history_rows_updated} ta</b> qator yangilandi.
            </p>
          )}
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
            Narxlar, sonlar va foyda o&apos;zgarmadi.
          </p>
        </div>
        <ModalFooter>
          <button onClick={() => { onDone(done); onClose(); }} className="btn-primary">Yopish</button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} width={480}>
      <ModalHeader icon={<Repeat2 size={19} strokeWidth={1.8} />} title="Navni almashtirish" sub={`№${batch.batch_number}`} onClose={onClose} />

      {/* ESKI → YANGI */}
      <div className="mt-1 rounded-[14px] border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Hozirgi nav</div>
        <div className="mt-0.5 text-[13.5px] font-bold">{oldLabel}</div>
      </div>
      <div className="mt-2.5">
        <Field label="Yangi nav" span>
          <Select value={variant} onChange={(v) => { setVariant(+v); setErrs((x) => { const n = { ...x }; delete n.variant; return n; }); }}
            searchable placeholder="Yangi navni tanlang" options={options} />
          {errs.variant && <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.variant}</p>}
        </Field>
      </div>

      {/* ISHLATILGAN JOYLAR — HAQIQIY raqamlar (usage/ dan; taxmin YO'Q) */}
      {usage === null ? (
        <div className="mt-3"><FlowerLoader /></div>
      ) : lines.length > 0 ? (
        <div className="mt-3 rounded-[14px] border p-3" style={{ borderColor: "var(--warning-ink, #8a6d1f)", background: "color-mix(in srgb, #b3873a 10%, transparent)" }}>
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>
            <AlertTriangle size={14} strokeWidth={2.2} /> Bu partiya quyidagilarda ishlatilgan
          </div>
          <div className="mt-1.5 grid gap-1">
            {lines.map((l) => (
              <div key={l.label} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span style={{ color: "var(--text-2)" }}>{l.label}</span>
                <span className="font-bold tabular-nums">{l.value}</span>
              </div>
            ))}
          </div>
          {/* nima o'zgaradi / nima o'zgarmaydi */}
          <p className="mt-2 border-t pt-2 text-[11.5px] font-semibold leading-relaxed" style={{ borderColor: "var(--line2, var(--border))", color: "var(--text-2)" }}>
            {VARIANT_CHANGE_EFFECT}
          </p>
        </div>
      ) : null}

      {/* ⚠️ NOTO'G'RI ISHLATISH — SABAB maydonidan YUQORIDA, ko'rinadigan joyda */}
      <div className="mt-3 flex items-start gap-2.5 rounded-[13px] border-[1.5px] p-3" style={{ borderColor: "var(--danger-ink)", background: "var(--danger-soft, rgba(160,74,74,.12))" }}>
        <AlertTriangle size={17} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--danger-ink)" }} />
        <p className="text-[12px] font-bold leading-relaxed" style={{ color: "var(--danger-ink)" }}>
          {VARIANT_CHANGE_MISUSE}
          <span className="mt-1 block font-extrabold">{VARIANT_CHANGE_IRREVERSIBLE}.</span>
        </p>
      </div>

      {/* SABAB — MAJBURIY */}
      <div className="mt-3">
        <Field label="Sabab (majburiy)" span>
          <input className="inp" value={reason}
            onChange={(e) => { setReason(e.target.value); setErrs((x) => { const n = { ...x }; delete n.reason; return n; }); }}
            placeholder="Masalan: Kirimda xato nav yozilgan" />
          {errs.reason && <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.reason}</p>}
        </Field>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>Audit jurnaliga yoziladi — kim, qachon va nega almashtirgani qoladi.</p>
      </div>

      {detail && (
        <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{detail}</p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        {/* ⚠️ Sabab bo'sh bo'lsa so'rov YUBORILMAYDI (payload null), lekin tugma «o'lik»
            bo'lib qolmasin — bosilganda AYNAN nima yetishmayotgani aytiladi. */}
        <button onClick={submit} disabled={busy || !(variant > 0)} className={clsx("btn-primary disabled:opacity-60", busy && "btn-loading")}>
          Almashtirish
        </button>
      </ModalFooter>
    </Modal>
  );
}
