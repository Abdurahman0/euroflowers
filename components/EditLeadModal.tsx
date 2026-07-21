"use client";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import DatePicker from "./DatePicker";
import { StockUsagePicker, MaterialUsagePicker, type PackRow, type StockRow } from "./UsagePicker";
import { fmtTime } from "@/lib/format";
import { Icon } from "./icons";
import type { Lead, Packaging, StockBatch } from "@/lib/types";

/**
 * Buyurtmani TO'LIQ tahrirlash — kanban kartadagi qalam orqali.
 * Hamma narsa shu yerda o'zgaradi: so'rov, turi, gul/material sarfi,
 * florist haqi, narx, sana, filial (backend PATCH /api/leads/{id}/).
 * Sklad allaqachon yechilgan bo'lsa (stock_deducted_at) sarf qulflanadi —
 * o'zgartirish qayta chiqim qilmaydi, chalkashlik bo'lmasin.
 */
export default function EditLeadModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: Lead;
  onClose: () => void;
  onSaved: (l: Lead) => void;
}) {
  const { user, showToast } = useStore();
  const branches = user?.profile.branches ?? [];
  const deducted = !!lead.stock_deducted_at;
  const [f, setF] = useState({
    request_uz: lead.request_uz || "",
    arrangement_type: lead.arrangement_type || "",
    estimated_price: lead.estimated_price ? String(Math.round(+lead.estimated_price)) : "",
    florist_fee: lead.florist_fee ? String(Math.round(+lead.florist_fee)) : "",
    desired_date: lead.desired_date ? lead.desired_date.slice(0, 10) : "",
    branch: lead.branch,
  });
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [materials, setMaterials] = useState<Packaging[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>(
    (lead.stock_usage ?? []).map((u) => ({ stock_batch: u.stock_batch, quantity_stems: u.quantity_stems }))
  );
  const [packRows, setPackRows] = useState<PackRow[]>(
    (lead.packaging_usage ?? []).map((u) => ({ packaging: u.packaging, quantity: u.quantity }))
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // to'liq ro'yxat: sarf qatorlari nomlari uchun ham kerak (tugagan partiya bo'lishi mumkin)
    api.stockBatches({ is_active: true }).then(setBatches).catch(() => {});
    api.materials({ is_active: true }).then(setMaterials).catch(() => {});
  }, []);

  // sklad narxlari bo'yicha jami — "qo'llash" tugmasi uchun
  const suggested = useMemo(() => {
    const flowersSum = stockRows.reduce((s, r) => {
      const b = batches.find((x) => x.id === r.stock_batch);
      return s + (b ? Math.round(+b.sale_price_per_stem) * r.quantity_stems : 0);
    }, 0);
    const packSum = packRows.reduce((s, r) => {
      const m = materials.find((x) => x.id === r.packaging);
      return s + (m ? Math.round(+m.sale_price) * r.quantity : 0);
    }, 0);
    return flowersSum + packSum + (+f.florist_fee || 0);
  }, [stockRows, packRows, batches, materials, f.florist_fee]);

  const save = async () => {
    if (!f.request_uz.trim()) return showToast("So'rov matnini kiriting");
    setBusy(true);
    try {
      let upd = await api.updateLead(lead.id, {
        request_uz: f.request_uz.trim(),
        arrangement_type: (f.arrangement_type || "") as Lead["arrangement_type"],
        estimated_price: f.estimated_price ? String(+f.estimated_price) : null,
        florist_fee: f.florist_fee ? String(+f.florist_fee) : null,
        desired_date: f.desired_date || null,
        branch: f.branch,
        // sklad yechilgandan keyin sarf o'zgartirilmaydi
        ...(deducted
          ? {}
          : {
              stock_usage_input: stockRows.map((r) => {
                const b = batches.find((x) => x.id === r.stock_batch);
                const perBunch = b?.stems_per_bunch || 0;
                return {
                  stock_batch: r.stock_batch,
                  quantity_stems: r.quantity_stems,
                  ...(perBunch > 0 ? { quantity_bunches: (r.quantity_stems / perBunch).toFixed(2) } : {}),
                };
              }),
              packaging_usage_input: packRows,
            }),
      });
      // javob sarf qatorlarisiz kelsa — leadni qayta o'qib, bo'lmasa lokal tiklaymiz
      if ((stockRows.length && !upd.stock_usage?.length) || (packRows.length && !upd.packaging_usage?.length)) {
        upd = await api.lead(lead.id).catch(() => upd);
      }
      if (stockRows.length && !upd.stock_usage?.length) {
        upd = {
          ...upd,
          stock_usage: stockRows.map((r) => ({
            stock_batch: r.stock_batch,
            quantity_stems: r.quantity_stems,
            batch_detail: batches.find((b) => b.id === r.stock_batch),
          })),
        };
      }
      if (packRows.length && !upd.packaging_usage?.length) {
        upd = {
          ...upd,
          packaging_usage: packRows.map((r) => ({
            packaging: r.packaging,
            quantity: r.quantity,
            packaging_detail: materials.find((m) => m.id === r.packaging),
          })),
        };
      }
      showToast("✓ Buyurtma yangilandi");
      onSaved(upd);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  const name = lead.customer_detail?.name || `@${lead.customer_detail?.instagram_username ?? "—"}`;

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader icon={<Icon name="crm" />} title="Buyurtmani tahrirlash" sub={`${name} · #${lead.id}`} onClose={onClose} />
      <Section>Lead ma&apos;lumotlari</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="So'rov" span>
          <textarea
            className="inp min-h-[90px] resize-y"
            value={f.request_uz}
            onChange={(e) => setF({ ...f, request_uz: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Turi" span>
          <Select
            value={f.arrangement_type}
            onChange={(v) => setF({ ...f, arrangement_type: String(v) })}
            placeholder="Tanlang"
            options={[
              { value: "bouquet", label: "Buket" },
              { value: "basket", label: "Savat" },
              { value: "stems", label: "Donalab" },
              { value: "catalog", label: "Katalog" },
            ]}
          />
        </Field>
      </div>

      <Section>Sklad sarfi (sotilganda avtomatik kamayadi)</Section>
      {deducted ? (
        <div className="rounded-[13px] bg-mint px-3.5 py-2.5 text-[12.5px] font-semibold leading-snug text-mintink">
          ✓ Sklad {fmtTime(lead.stock_deducted_at)} da yechib bo&apos;lingan — sarf endi o&apos;zgartirilmaydi.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <Field label="Gullar (sklad partiyasidan)" span>
            <StockUsagePicker batches={batches.filter((b) => b.remaining_stems > 0)} rows={stockRows} onChange={setStockRows} />
          </Field>
          <Field label="Material / savat" span>
            <MaterialUsagePicker materials={materials} rows={packRows} onChange={setPackRows} />
          </Field>
        </div>
      )}

      <Section>Narx va yetkazish</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Florist haqi (so'm)">
          <input className="inp" type="number" value={f.florist_fee} onChange={(e) => setF({ ...f, florist_fee: e.target.value })} placeholder="50000" />
        </Field>
        <Field label="Taxminiy narx (so'm)">
          <input className="inp" type="number" value={f.estimated_price} onChange={(e) => setF({ ...f, estimated_price: e.target.value })} placeholder="750000" />
        </Field>
        <Field label="Kerakli sana">
          <DatePicker value={f.desired_date} onChange={(v) => setF({ ...f, desired_date: v })} disablePast placeholder="Yetkazish sanasi" ariaLabel="Kerakli sana" />
        </Field>
        <Field label="Filial">
          <Select
            value={f.branch}
            onChange={(v) => setF({ ...f, branch: +v })}
            options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.code }))}
          />
        </Field>
      </div>
      {!deducted && (stockRows.length > 0 || packRows.length > 0) && suggested > 0 && (
        <button
          type="button"
          onClick={() => setF((prev) => ({ ...prev, estimated_price: String(suggested) }))}
          className="mt-2 self-start text-[12px] font-semibold underline-offset-2 hover:underline"
          style={{ color: "var(--primary)" }}
        >
          Sklad narxi bo&apos;yicha: {suggested.toLocaleString("ru")} so&apos;m{+f.florist_fee ? " (florist haqi bilan)" : ""} — qo&apos;llash
        </button>
      )}
      <ModalFooter>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
        <button onClick={onClose} className="rounded-[14px] border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-5 py-3 text-sm font-bold">Bekor</button>
      </ModalFooter>
    </Modal>
  );
}
