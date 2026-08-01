"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Send } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import Select from "./Select";
import { fmt } from "@/lib/format";
import type { Branch, CatalogItem } from "@/lib/types";

/**
 * Katalog nusxasini FILIALGA yuborish (asosiy → Parkent). Qisman yuborish mumkin.
 * ⚠️ QAYTARIB BO'LMAYDI — backend'da bekor/qaytar yo'li YO'Q (OpenAPI: catalog-transfers
 * faqat GET, transfer faqat POST). Shu bois yuborishdan oldin aniq ogohlantiriladi.
 * Max = sotilmagan qism (quantity_total − quantity_sold). POST /catalog/{id}/transfer/.
 */
export default function CatalogTransferDrawer({ item, onClose, onDone }: { item: CatalogItem; onClose: () => void; onDone: () => void }) {
  const { showToast } = useStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState<number>(0);
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.branches({ is_active: true }).then((bs) => {
      const targets = bs.filter((b) => b.is_active && !b.is_main);
      setBranches(targets);
      if (targets[0]) setBranch(targets[0].id);
    }).catch(() => {});
  }, []);

  const total = item.quantity_total ?? 1;
  const sold = item.quantity_sold ?? (item.status === "sold" ? total : 0);
  const unsold = Math.max(total - sold, 0); // MAX yuboriladigan son
  const listPrice = Math.round(+item.price || 0);
  const n = Math.min(Math.max(Math.round(+qty || 0), 0), unsold);
  const remaining = unsold - n;
  const priceNum = price.trim() ? Math.round(+price || 0) : listPrice;
  const markup = useMemo(() => Math.max(priceNum - listPrice, 0) * n, [priceNum, listPrice, n]);

  const submit = async () => {
    if (!branch) return showToast("Filialni tanlang");
    if (n <= 0) return showToast("Sonni kiriting");
    if (n > unsold) return showToast(`Yuborish uchun atigi ${unsold} dona bor`);
    setBusy(true); setErr(null);
    try {
      const t = await api.transferCatalog(item.id, { branch, quantity: n, ...(price.trim() ? { price: String(priceNum) } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
      showToast(`✓ ${t.branch_name}ga ${n} dona yuborildi`);
      onDone(); // katalog ro'yxatini yangilaymiz (asosiy filialda soni kamaydi)
      onClose();
    } catch (e) {
      // 400 "Yuborish uchun atigi 3 dona bor" — o'qiladigan blok
      const msg = e instanceof ApiError ? (e.fieldErrors ? Object.values(e.fieldErrors).join("\n") : e.message) : "Yuborib bo'lmadi";
      setErr(msg);
      showToast(e instanceof ApiError ? e.message : "Yuborib bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={460}>
      <ModalHeader icon={<Send size={18} strokeWidth={1.9} />} title="Filialga yuborish" sub={`${item.name_uz || item.name_ru} · sotuvda ${unsold} dona`} onClose={onClose} />

      {/* ⚠️ §5 IKKI YO'LNI AJRATISH: bu MAVJUD asosiy katalogni filialga ko'chiradi. Yangi filial
          katalogi yaratish uchun — «Katalog qo'shish»da yuqoridagi «Qaysi filial uchun» tanlagichi. */}
      <p className="mb-3 rounded-[11px] px-3 py-2 text-[11.5px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
        Bu <b>mavjud</b> katalogdan filialga ko&apos;chiradi. Yangi filial katalogini noldan yaratish → «Katalog qo&apos;shish» → <b>«Qaysi filial uchun»</b>.
      </p>

      <Field label="Filial" span>
        <Select value={branch} onChange={(v) => setBranch(+v)} placeholder={branches.length ? "Filialni tanlang" : "Faol filial yo'q"} options={branches.map((b) => ({ value: b.id, label: b.name }))} />
      </Field>

      <Field label={`Soni (maks: ${unsold})`} span>
        <input className="inp" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="1" />
      </Field>

      <Field label="Filial narxi (ixtiyoriy)" span>
        <input className="inp" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder={String(listPrice)} />
        <span className="mt-1 block text-[11.5px]" style={{ color: "var(--muted)" }}>Bo&apos;sh qoldirilsa asl narx ({fmt(listPrice)})</span>
      </Field>

      <Field label="Izoh (ixtiyoriy)" span>
        <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: Parkentga" />
      </Field>

      {/* JONLI ko'rinish */}
      <div className="mt-3 rounded-[14px] border px-4 py-3 text-[13px]" style={{ borderColor: "var(--border)" }}>
        {n > 0 ? (
          <>
            <div className="font-semibold">{unsold} tadan <b style={{ color: "var(--primary)" }}>{n} tasi</b> ketadi, <b>{remaining} tasi</b> qoladi</div>
            {price.trim() && markup > 0 && (
              <div className="mt-1" style={{ color: "var(--text-2)" }}>Ustama (asl narxdan): <b style={{ color: "var(--acc)" }}>{fmt(markup)}</b> <span style={{ color: "var(--muted)" }}>({fmt(priceNum)} × {n} − asl {fmt(listPrice)} × {n})</span></div>
            )}
          </>
        ) : <span style={{ color: "var(--muted)" }}>Sonni kiriting</span>}
      </div>

      {/* QAYTARIB BO'LMAYDI — aniq ogohlantirish */}
      <div className="mt-3 flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--warning-soft, rgba(179,135,58,.12))", color: "var(--warning-ink)" }}>
        <AlertTriangle size={16} strokeWidth={2} className="mt-px shrink-0" />
        <span>Yuborilgach bu yerdan <b>qaytarib bo&apos;lmaydi</b> — mahsulot filial hisobiga o&apos;tadi.</span>
      </div>

      {err && <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={submit} disabled={busy || n <= 0 || !branch} className="btn-primary disabled:opacity-60">{busy ? "Yuborilmoqda…" : `${n} dona yuborish`}</button>
      </ModalFooter>
    </Modal>
  );
}
