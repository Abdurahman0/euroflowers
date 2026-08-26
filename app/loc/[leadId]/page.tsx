"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Crosshair, Link2Off, Loader2, MapPin, TriangleAlert } from "lucide-react";
import DeliveryPinMap from "@/components/DeliveryPinMap";
import { LOC_MESSAGE, deliveryPayload, locOutcome, parseLeadId, readToken, type LocOutcome } from "@/lib/deliveryLocation";
import { fmtCoords, reverseGeocode } from "@/lib/reverseGeocode";
import { SHOP } from "@/lib/ymaps";

/**
 * OCHIQ SAHIFA — /loc/:leadId?t=<kod>. Mijoz Instagramdagi havoladan kiradi:
 * login yo'q, Shell qobig'i yo'q (Shell'da /loc guard'dan chetlab o'tadi).
 *
 * Ekranda faqat xarita bor — narx, katalog, lead raqami KO'RSATILMAYDI.
 * So'rov Authorization sarlavhasisiz, tayyor `fetch` bilan ketadi: lib/api
 * interceptori bu yerga umuman ulanmaydi.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://euroflowers.api.cognilabs.org";

export default function DeliveryLocationPage() {
  const params = useParams();
  const leadId = parseLeadId(params?.leadId as string | string[] | undefined);
  const [token, setToken] = useState<string | null>(null);
  const [pos, setPos] = useState<[number, number]>(SHOP);
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<LocOutcome | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoNote, setGeoNote] = useState("");
  const [addrBusy, setAddrBusy] = useState(false);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // kod query'dan — o'zgartirilmasdan, kesilmasdan olinadi
  useEffect(() => {
    setToken(readToken(new URLSearchParams(window.location.search).get("t")));
  }, []);

  const onMove = useCallback((la: number, ln: number) => {
    setPos([la, ln]);
    setGeoNote("");
  }, []);

  // teskari geokodlash — belgi tinchigach 700 ms dan keyin, xatoda jim
  // (manzil ixtiyoriy: topilmasa ekranda koordinata ko'rinadi, API ga "" ketadi)
  useEffect(() => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    const ctrl = new AbortController();
    setAddrBusy(true);
    geoTimer.current = setTimeout(() => {
      reverseGeocode(pos[0], pos[1], ctrl.signal).then((a) => {
        if (ctrl.signal.aborted) return;
        setAddress(a);
        setAddrBusy(false);
      });
    }, 700);
    return () => {
      ctrl.abort();
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
  }, [pos]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setGeoNote("Qurilmangiz joylashuvni aniqlay olmadi — belgini qo'lda suring.");
      return;
    }
    setGeoBusy(true);
    setGeoNote("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeoBusy(false);
        setPos([p.coords.latitude, p.coords.longitude]);
      },
      () => {
        setGeoBusy(false);
        setGeoNote("Joylashuvga ruxsat berilmadi — belgini xaritada qo'lda suring.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // «Tanlash» — qayta yuborishga ruxsat: oxirgi koordinata saqlanadi
  const submit = async () => {
    if (leadId == null || token == null || sending) return;
    setSending(true);
    setOutcome(null);
    try {
      const res = await fetch(`${API}/api/delivery-location/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deliveryPayload(leadId, token, pos[0], pos[1], address)),
      });
      const body = await res.json().catch(() => null);
      setOutcome(locOutcome(res.status, body));
    } catch {
      setOutcome("error");
    } finally {
      setSending(false);
    }
  };

  // havolaning o'zi buzuq — xaritani ham ochmaymiz
  if (leadId == null) return <ResultScreen kind="expired" />;
  if (outcome === "ok") return <ResultScreen kind="ok" />;
  if (outcome === "expired") return <ResultScreen kind="expired" />;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* xarita — butun ekran */}
      <div className="relative min-h-0 flex-1">
        <DeliveryPinMap lat={pos[0]} lng={pos[1]} onMove={onMove} />

        {/* yo'riqnoma — xarita ustida suzadi */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] p-3">
          <div
            className="mx-auto flex max-w-[520px] items-center gap-2.5 rounded-[14px] border px-3.5 py-2.5 shadow-sm backdrop-blur"
            style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              <MapPin size={16} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-tight" style={{ color: "var(--text)" }}>
                Yetkazib berish manzili
              </div>
              <div className="mt-0.5 text-[11.5px] leading-tight" style={{ color: "var(--muted)" }}>
                Belgini kerakli joyga suring yoki xaritaga bosing.
              </div>
            </div>
          </div>
        </div>

        {/* joylashuvni aniqlash */}
        <button
          type="button"
          onClick={locateMe}
          disabled={geoBusy}
          data-tid="loc-geo"
          className="absolute bottom-9 right-3 z-[2] flex items-center gap-2 rounded-full border px-3.5 py-2.5 text-[12.5px] font-medium shadow-sm transition disabled:opacity-60"
          style={{ borderColor: "var(--border)", background: "var(--surface-solid)", color: "var(--text)" }}
        >
          {geoBusy ? <Loader2 size={15} className="animate-spin" /> : <Crosshair size={15} strokeWidth={2.2} />}
          Joylashuvimni aniqlash
        </button>
      </div>

      {/* pastki panel */}
      <div
        className="z-[3] shrink-0 border-t px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3.5"
        style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}
      >
        <div className="mx-auto max-w-[520px]">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Tanlangan nuqta
          </div>
          <div className="mt-1 text-[13.5px] leading-snug" style={{ color: "var(--text)" }} data-tid="loc-address">
            {address || (addrBusy ? "Manzil aniqlanmoqda…" : fmtCoords(pos[0], pos[1]))}
          </div>

          {(geoNote || outcome === "retry" || outcome === "error") && (
            <div
              className="mt-2.5 flex items-start gap-2 rounded-[12px] px-3 py-2 text-[12px] leading-snug"
              style={{ background: "var(--surface-2)", color: outcome ? "var(--danger-ink)" : "var(--warning-ink)" }}
              data-tid="loc-note"
            >
              <TriangleAlert size={14} className="mt-[1px] shrink-0" />
              <span>{outcome ? LOC_MESSAGE[outcome].text : geoNote}</span>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={sending || token == null}
            data-tid="loc-submit"
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[14.5px] font-semibold text-white transition disabled:opacity-70"
            style={{ background: "var(--primary)" }}
          >
            {sending ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Yuborilmoqda…
              </>
            ) : (
              <>
                <Check size={17} strokeWidth={2.4} />
                Tanlash
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Yakuniy ekranlar — 200 OK va «havola eskirgan» uchun. */
function ResultScreen({ kind }: { kind: "ok" | "expired" }) {
  const ok = kind === "ok";
  return (
    <div className="fixed inset-0 flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div
        className="w-full max-w-[400px] rounded-[18px] border px-6 py-8 text-center shadow-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}
        data-tid={ok ? "loc-done" : "loc-expired"}
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: ok ? "var(--primary-soft)" : "var(--surface-2)",
            color: ok ? "var(--success-ink)" : "var(--danger-ink)",
          }}
        >
          {ok ? <Check size={26} strokeWidth={2.4} /> : <Link2Off size={24} strokeWidth={2.2} />}
        </div>
        <div className="mt-4 text-[17px] font-semibold" style={{ color: "var(--text)" }}>
          {ok ? "Manzilingiz qabul qilindi" : LOC_MESSAGE.expired.title}
        </div>
        <div className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {ok ? "Instagramga qaytishingiz mumkin — operatorimiz siz bilan bog'lanadi." : LOC_MESSAGE.expired.text}
        </div>
      </div>
    </div>
  );
}
