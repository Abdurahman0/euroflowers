"use client";
import { useEffect, useRef, useState } from "react";
import { loadYmaps, SHOP, type YMap, type YPlacemark } from "@/lib/ymaps";

/**
 * YETKAZISH XARITASI — mijoz uchun to'liq ekran Yandex xaritasi (kalitsiz JS API).
 * Belgi sudraladi, xaritaga bosilsa ham ko'chadi. Tashqi `lat/lng` o'zgarsa
 * (masalan «joylashuvimni aniqlash») xarita o'sha nuqtaga uchadi.
 */
export default function DeliveryPinMap({
  lat,
  lng,
  onMove,
  onReady,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
  onReady?: () => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YMap | null>(null);
  const pinRef = useRef<YPlacemark | null>(null);
  const selfRef = useRef<string>("");
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const [err, setErr] = useState(false);

  useEffect(() => {
    let killed = false;
    const start: [number, number] = [lat, lng];
    loadYmaps()
      .then((ymaps) => {
        if (killed || !elRef.current || mapRef.current) return;
        const map = new ymaps.Map(elRef.current, {
          center: start,
          zoom: 16,
          controls: ["zoomControl"],
        });
        const pin = new ymaps.Placemark(start, {}, { draggable: true, preset: "islands#redDotIcon" });
        map.geoObjects.add(pin);
        const emit = (c: [number, number]) => {
          selfRef.current = `${c[0]},${c[1]}`;
          moveRef.current(c[0], c[1]);
        };
        pin.events.add("dragend", () => emit(pin.geometry.getCoordinates()));
        map.events.add("click", (ev) => {
          const c = ev.get("coords");
          pin.geometry.setCoordinates(c);
          emit(c);
        });
        mapRef.current = map;
        pinRef.current = pin;
        onReady?.();
      })
      .catch(() => setErr(true));
    return () => {
      killed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tashqaridan kelgan koordinata (geolokatsiya) — belgi va markaz ko'chadi;
  // o'zimiz chiqargan qiymat qaytib kelsa xaritaga tegmaymiz
  useEffect(() => {
    if (!pinRef.current || selfRef.current === `${lat},${lng}`) return;
    const c: [number, number] = [lat, lng];
    pinRef.current.geometry.setCoordinates(c);
    mapRef.current?.setCenter(c, 17);
  }, [lat, lng]);

  if (err)
    return (
      <div
        className="flex h-full w-full items-center justify-center p-6 text-center text-[13px]"
        style={{ background: "var(--surface-2)", color: "var(--muted)" }}
      >
        Xaritani yuklab bo&apos;lmadi — internet aloqasini tekshiring.
      </div>
    );

  return <div ref={elRef} className="h-full w-full" />;
}

export { SHOP };
