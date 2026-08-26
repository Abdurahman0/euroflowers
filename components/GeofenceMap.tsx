"use client";
import { useEffect, useRef, useState } from "react";
import { loadYmaps, TASHKENT, type YMap, type YPlacemark, type YCircle } from "@/lib/ymaps";

/**
 * GEOFENCE xarita — Yandex Maps (kalitsiz JS API). Markaz-pin sudraladi,
 * ikki shaffof doira (kelish/ketish radiusi) sliderlar bilan jonli o'zgaradi.
 * Xarita ranglari Yandex'niki; atrofdagi UI tema tokenlarida.
 */


export default function GeofenceMap({
  lat,
  lng,
  arrival,
  departure,
  onMove,
}: {
  lat: number | null;
  lng: number | null;
  arrival: number;
  departure: number;
  onMove: (lat: number, lng: number) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YMap | null>(null);
  const pinRef = useRef<YPlacemark | null>(null);
  const arrRef = useRef<YCircle | null>(null);
  const depRef = useRef<YCircle | null>(null);
  const [err, setErr] = useState(false);
  const center: [number, number] = lat != null && lng != null ? [lat, lng] : TASHKENT;

  // xaritani bir marta yaratish
  useEffect(() => {
    let killed = false;
    loadYmaps()
      .then((ymaps) => {
        if (killed || !elRef.current || mapRef.current) return;
        const map = new ymaps.Map(elRef.current, { center, zoom: 15, controls: ["zoomControl", "geolocationControl"] });
        const pin = new ymaps.Placemark(center, {}, { draggable: true, preset: "islands#redDotIcon" });
        const dep = new ymaps.Circle([center, departure], {}, { fillColor: "#6a6ac233", strokeColor: "#6a6ac2", strokeWidth: 1, strokeOpacity: 0.7 });
        const arr = new ymaps.Circle([center, arrival], {}, { fillColor: "#3d8a5f33", strokeColor: "#3d8a5f", strokeWidth: 1.5, strokeOpacity: 0.8 });
        map.geoObjects.add(dep); map.geoObjects.add(arr); map.geoObjects.add(pin);
        const sync = () => { const c = pin.geometry.getCoordinates(); arr.geometry.setCoordinates(c); dep.geometry.setCoordinates(c); onMove(c[0], c[1]); };
        pin.events.add("dragend", sync);
        map.events.add("click", (ev) => { const c = ev.get("coords"); pin.geometry.setCoordinates(c); arr.geometry.setCoordinates(c); dep.geometry.setCoordinates(c); onMove(c[0], c[1]); });
        mapRef.current = map; pinRef.current = pin; arrRef.current = arr; depRef.current = dep;
      })
      .catch(() => setErr(true));
    return () => { killed = true; if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // radius sliderlari o'zgarsa — doiralar jonli yangilanadi
  useEffect(() => { arrRef.current?.geometry.setRadius(arrival); }, [arrival]);
  useEffect(() => { depRef.current?.geometry.setRadius(departure); }, [departure]);
  // tashqi lat/lng o'zgarsa (masalan reset) — markaz ko'chadi
  useEffect(() => {
    if (lat == null || lng == null || !pinRef.current) return;
    const c: [number, number] = [lat, lng];
    pinRef.current.geometry.setCoordinates(c);
    arrRef.current?.geometry.setCoordinates(c);
    depRef.current?.geometry.setCoordinates(c);
    mapRef.current?.setCenter(c);
  }, [lat, lng]);

  if (err)
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[14px] border text-center text-[13px]" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--muted)" }}>
        Xaritani yuklab bo&apos;lmadi — internet aloqasini tekshiring.
      </div>
    );

  return <div ref={elRef} className="h-[280px] w-full overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--border)" }} />;
}
