"use client";
import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import TimePicker from "./TimePicker";
import GeofenceMap from "./GeofenceMap";
import { STAFF_LABEL } from "@/lib/inventory";
import type { FloristProfile, StaffType, User } from "@/lib/types";

/** Florist profili — yaratish/tahrirlash, geofence xarita bilan (backend: /api/florists/). */
export default function FloristModal({ florist, onClose, onSaved }: { florist: FloristProfile | null; onClose: () => void; onSaved: (f: FloristProfile) => void }) {
  const { showToast } = useStore();
  const [users, setUsers] = useState<User[]>([]);
  const [f, setF] = useState({
    user: florist?.user ?? 0,
    staff_type: (florist?.staff_type ?? "florist") as StaffType,
    phone: florist?.phone ?? "",
    daily_pay: florist?.daily_pay ? String(Math.round(+florist.daily_pay)) : "",
    work_start_time: florist?.work_start_time ?? "",
    work_end_time: florist?.work_end_time ?? "",
    decoration_fee: florist?.decoration_fee ? String(Math.round(+florist.decoration_fee)) : "",
    lat: florist?.shop_latitude != null ? +florist.shop_latitude : null as number | null,
    lng: florist?.shop_longitude != null ? +florist.shop_longitude : null as number | null,
    arrival: florist?.arrival_radius_meters ?? 100,
    departure: florist?.departure_radius_meters ?? 150,
    is_active: florist?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.users({ page_size: "all" }).then(setUsers).catch(() => {}); }, []);

  const save = async () => {
    if (!f.user) return showToast("Foydalanuvchini tanlang");
    setBusy(true);
    try {
      // single-branch: `branch` YUBORILMAYDI — backend default filialni o'zi
      // qo'yadi (kontrakt: 2b26aa2 default branch for florist APIs)
      const payload = {
        user: f.user,
        staff_type: f.staff_type,
        phone: f.phone.trim(),
        daily_pay: f.daily_pay ? String(+f.daily_pay) : "0",
        work_start_time: f.work_start_time || null,
        work_end_time: f.work_end_time || null,
        shop_latitude: f.lat != null ? String(f.lat) : null,
        shop_longitude: f.lng != null ? String(f.lng) : null,
        arrival_radius_meters: f.arrival,
        departure_radius_meters: f.departure,
        // OFORMLENIYA haqi — hajm tarifidan ALOHIDA flat fee (1 dona bezash uchun); "0" ham yuboriladi.
        decoration_fee: f.decoration_fee ? String(+f.decoration_fee) : "0",
        is_active: f.is_active,
      };
      const saved = florist ? await api.updateFlorist(florist.id, payload) : await api.createFlorist(payload);
      showToast(florist ? "✓ Florist yangilandi" : "✓ Florist qo'shildi");
      onSaved(saved);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  const userName = (u: User) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username;

  return (
    <Modal onClose={onClose} width={560}>
      <ModalHeader icon={<Scissors size={20} strokeWidth={1.75} />} title={florist ? "Floristni tahrirlash" : "Yangi florist"} sub="Profil, ish vaqti va geofence" onClose={onClose} />

      <Section>Xodim</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Foydalanuvchi" span>
          <Select value={f.user} onChange={(v) => setF({ ...f, user: +v })} placeholder="Xodimni tanlang" options={users.map((u) => ({ value: u.id, label: userName(u), sub: `@${u.username}` }))} />
        </Field>
        <Field label="Turi">
          <Select value={f.staff_type} onChange={(v) => setF({ ...f, staff_type: v as StaffType })} options={(["florist", "apprentice"] as const).map((t) => ({ value: t, label: STAFF_LABEL[t] }))} />
        </Field>
        <Field label="Telefon"><input className="inp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Masalan: +998901234567" inputMode="tel" /></Field>
        <Field label="Kunlik haq (so'm)"><input className="inp" type="number" value={f.daily_pay} onChange={(e) => setF({ ...f, daily_pay: e.target.value })} placeholder="Masalan: 150000" /></Field>
        <Field label="Ish boshlanishi"><TimePicker value={f.work_start_time?.slice(0, 5) ?? ""} onChange={(v) => setF({ ...f, work_start_time: v })} placeholder="Masalan: 09:00" ariaLabel="Ish boshlanish vaqti" /></Field>
        <Field label="Ish tugashi"><TimePicker value={f.work_end_time?.slice(0, 5) ?? ""} onChange={(v) => setF({ ...f, work_end_time: v })} placeholder="Masalan: 18:00" ariaLabel="Ish tugash vaqti" /></Field>
        <Field label="Oformleniya haqi (so'm)" span>
          <input className="inp" type="number" value={f.decoration_fee} onChange={(e) => setF({ ...f, decoration_fee: e.target.value })} placeholder="Masalan: 30000" />
          <span className="mt-1 block text-[11.5px]" style={{ color: "var(--muted)" }}>Har bir buket/savat oformleniyasi uchun qo&apos;shiladigan summa. Hajm tarifidan alohida — bezovchi florist tanlansa <b>× dona</b> hisoblanadi.</span>
        </Field>
      </div>

      <Section>Geofence — do&apos;kon joyi</Section>
      <p className="mb-2 text-[12px]" style={{ color: "var(--muted)" }}>Pin&apos;ni suring yoki xaritaga bosing. Yashil doira — kelish, binafsha — ketish radiusi.</p>
      <GeofenceMap lat={f.lat} lng={f.lng} arrival={f.arrival} departure={f.departure} onMove={(lat, lng) => setF((p) => ({ ...p, lat, lng }))} />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <RadiusSlider label="Kelish radiusi" hue="#3d8a5f" value={f.arrival} onChange={(v) => setF({ ...f, arrival: v })} />
        <RadiusSlider label="Ketish radiusi" hue="#6a6ac2" value={f.departure} onChange={(v) => setF({ ...f, departure: v })} />
      </div>
      {f.lat != null && (
        <p className="mt-2 text-[12px] tabular-nums" style={{ color: "var(--muted)" }}>Koordinata: {f.lat.toFixed(6)}, {f.lng?.toFixed(6)}</p>
      )}

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: "var(--text-2)" }}>
        <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
        Faol
      </label>

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : florist ? "Saqlash" : "Qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}

function RadiusSlider({ label, hue, value, onChange }: { label: string; hue: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[12px] font-semibold">
        <span style={{ color: "var(--text-2)" }}>{label}</span>
        <span className="tabular-nums" style={{ color: hue }}>{value} m</span>
      </div>
      <input type="range" min={20} max={1000} step={10} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full" style={{ accentColor: hue }} aria-label={label} />
    </div>
  );
}
