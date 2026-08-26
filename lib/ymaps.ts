/**
 * Yandex Maps (kalitsiz JS API) uchun yagona yuklovchi.
 * Skript bir marta qo'shiladi — bir nechta xarita komponenti bo'lsa ham
 * (geofence, yetkazish manzili) bitta `loaderPromise` ni bo'lishadi.
 */

export type YMaps = {
  ready: (cb: () => void) => void;
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => YMap;
  Placemark: new (coords: [number, number], props: unknown, opts: unknown) => YPlacemark;
  Circle: new (geom: [[number, number], number], props: unknown, opts: unknown) => YCircle;
};
export type YMap = {
  geoObjects: { add: (o: unknown) => void; remove: (o: unknown) => void };
  destroy: () => void;
  setCenter: (c: [number, number], zoom?: number) => void;
  events: { add: (e: string, cb: (ev: { get: (k: string) => [number, number] }) => void) => void };
};
export type YPlacemark = {
  geometry: { getCoordinates: () => [number, number]; setCoordinates: (c: [number, number]) => void };
  events: { add: (e: string, cb: () => void) => void };
};
export type YCircle = { geometry: { setRadius: (r: number) => void; setCoordinates: (c: [number, number]) => void } };

let loaderPromise: Promise<YMaps> | null = null;

export function loadYmaps(): Promise<YMaps> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as unknown as { ymaps?: YMaps };
  if (w.ymaps) return Promise.resolve(w.ymaps);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise<YMaps>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://api-maps.yandex.ru/2.1/?lang=uz_UZ";
    s.async = true;
    s.onload = () => {
      const y = (window as unknown as { ymaps?: YMaps }).ymaps;
      y ? y.ready(() => resolve(y)) : reject(new Error("ymaps yo'q"));
    };
    s.onerror = () => reject(new Error("Xarita yuklanmadi"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

/** Toshkent markazi — geofence xaritasining boshlang'ich nuqtasi. */
export const TASHKENT: [number, number] = [41.311081, 69.279737];
/** Do'kon manzili (Bobur ko'chasi 10) — yetkazish xaritasining boshlang'ich nuqtasi. */
export const SHOP: [number, number] = [41.2995, 69.2401];
