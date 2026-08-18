"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_PAGE_SIZE, DEFAULT_PAGE_SIZE, buildListQuery, clampPage, clampPageSize,
  readPageInfo, type PageInfo, type PageState,
} from "./pagination";
import type { Paginated } from "./types";

// Stable empty value: returning `[]` inline from the hook creates a new
// reference on every render and can retrigger consumers' synchronization
// effects before the first response arrives.
const EMPTY_ROWS: never[] = [];

/**
 * SAHIFALANGAN RO'YXAT — YAGONA so'rov yordamchisi.
 *
 * Nima qiladi:
 *   • bitta sahifa uchun AYNAN BITTA so'rov (hech qanday «hamma sahifani aylanish»)
 *   • `page` va `page_size` ni URL'da saqlaydi — yangilashda joyida qoladi
 *   • ⚠️ FILTR o'zgarsa sahifani 1 ga qaytaradi (aks holda bo'sh sahifa ko'rinardi)
 *   • ⚠️ ESKIRGAN javobni tashlaydi: har so'rovda AbortController + avlod raqami,
 *     shuning uchun tez yozilgan qidiruv eski natijani ustiga yozib ketolmaydi
 *   • jamilarni serverning `count` / `totals` idan beradi
 *
 * ⚠️ AVTOMATIK QAYTA SO'RAMAYDI. Ma'lumot faqat foydalanuvchi harakati (filtr,
 * sahifa, `refresh()`) yoki mutatsiyadan keyingi `notifyReportDataChanged()`
 * bilan yangilanadi.
 */
export type PagedListResult<T> = {
  rows: T[];
  info: PageInfo;
  totals: Record<string, unknown> | undefined;
  loading: boolean;
  /** birinchi yuklash tugadimi — «hali yuklanmoqda» va «bo'sh» ni ajratish uchun */
  ready: boolean;
  error: string;
  page: number;
  pageSize: number | typeof ALL_PAGE_SIZE;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  refresh: () => void;
  /** oxirgi muvaffaqiyatli yuklash vaqti (ms) — «yangilandi» yorlig'i uchun */
  loadedAt: number | null;
};

export function usePagedList<T>({
  fetcher,
  filters,
  urlKey = true,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  enabled = true,
}: {
  /** ⚠️ `signal` NI so'rovga uzating — aks holda eskirgan javob tashlanmaydi */
  fetcher: (query: Record<string, string | number>, signal: AbortSignal) => Promise<Paginated<T>>;
  filters: Record<string, unknown>;
  /** `page`/`page_size` ni URL'da saqlash */
  urlKey?: boolean;
  defaultPageSize?: number;
  enabled?: boolean;
}): PagedListResult<T> {
  const initial = (): PageState => {
    if (typeof window === "undefined" || !urlKey) return { page: 1, pageSize: defaultPageSize };
    const p = new URLSearchParams(window.location.search);
    const rawSize = p.get("page_size");
    return { page: clampPage(p.get("page") ?? 1), pageSize: rawSize == null ? defaultPageSize : clampPageSize(rawSize) };
  };
  const [state, setState] = useState<PageState>(initial);
  const [body, setBody] = useState<Paginated<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  // ⚠️ filtrlar obyekti har renderda YANGI bo'ladi — barqaror kalitga aylantiramiz,
  // aks holda effekt cheksiz qayta ishga tushardi (har renderda so'rov!).
  const filterKey = JSON.stringify(
    Object.keys(filters).sort().map((k) => [k, filters[k] ?? ""]),
  );
  const prevFilterKey = useRef(filterKey);

  // ⚠️ FILTR O'ZGARDI → 1-sahifa. Render paytida hisoblaymiz (effektda emas),
  // shunda eski sahifa bilan ortiqcha so'rov ketmaydi.
  const effPage = prevFilterKey.current === filterKey ? state.page : 1;
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setState((s) => (s.page === 1 ? s : { ...s, page: 1 }));
    }
  }, [filterKey]);

  const gen = useRef(0);
  const acRef = useRef<AbortController | null>(null);
  /**
   * ⚠️ «BITTA SAHIFA = BITTA SO'ROV» KAFOLATI.
   * Effekt bir xil so'rov bilan ikki marta ishga tushishi mumkin (React ikki
   * marta render qilsa, Strict rejim, yoki router ichki holatini yangilaganda).
   * Jonli o'lchovda audit sahifasida aynan shunday bo'ldi: bitta bosishga
   * `?page=83` IKKI marta ketdi (ikkalasi ham 200). Shu bois oxirgi yuborilgan
   * so'rov kaliti eslab qolinadi va AYNAN o'sha takrorlansa — yuborilmaydi.
   * `nonce` kalitga kiradi, shuning uchun «Yangilash» tugmasi doim ishlaydi.
   */
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;
    const query = buildListQuery(filters, { page: effPage, pageSize: state.pageSize });
    const key = `${JSON.stringify(query)}|${nonce}`;
    if (key === lastKey.current) return;    // ayni so'rov — takror yuborilmaydi
    lastKey.current = key;

    const myGen = ++gen.current;
    acRef.current?.abort();                 // ⚠️ eskirgan so'rov BEKOR qilinadi
    const ac = new AbortController();
    acRef.current = ac;
    setLoading(true);
    fetcher(query, ac.signal)
      .then((d) => {
        if (myGen !== gen.current || ac.signal.aborted) return;
        setBody(d); setError(""); setLoadedAt(Date.now());
      })
      .catch((e) => {
        if (myGen !== gen.current || ac.signal.aborted) return;
        if ((e as { name?: string })?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Yuklab bo'lmadi");
      })
      .finally(() => {
        if (myGen !== gen.current) return;
        setLoading(false); setReady(true);
      });

    // ⚠️ BU YERDA cleanup'da abort QILINMAYDI. Agar qilinsa, effekt bir xil
    // so'rov bilan qayta ishga tushganda (yuqoridagi izohga qarang) cleanup
    // uchayotgan so'rovni bo'g'ib qo'yardi, yangisi esa qo'riqchi tufayli
    // yuborilmasdi — natijada ro'yxat umuman yuklanmay qolardi.
    // Eskirgan so'rov KEYINGI HAQIQIY so'rov boshida bekor qilinadi (acRef),
    // komponent yopilganda esa quyidagi alohida effektda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, effPage, state.pageSize, nonce, enabled]);

  // KOMPONENT yopilganda — uchayotgan so'rovni bekor qilamiz. Reset the
  // duplicate guard too: React Strict Mode performs an effect cleanup/setup
  // cycle in development; without resetting it, the aborted first request
  // could suppress the legitimate second request.
  useEffect(() => () => {
    acRef.current?.abort();
    lastKey.current = "";
  }, []);

  // URL — sahifa va hajm (sukut qiymatlar yozilmaydi, havola toza qoladi)
  useEffect(() => {
    if (!urlKey || typeof window === "undefined") return;
    const u = new URL(window.location.href);
    effPage > 1 ? u.searchParams.set("page", String(effPage)) : u.searchParams.delete("page");
    state.pageSize !== defaultPageSize ? u.searchParams.set("page_size", String(state.pageSize)) : u.searchParams.delete("page_size");
    window.history.replaceState(null, "", u);
  }, [effPage, state.pageSize, urlKey, defaultPageSize]);

  const info = useMemo(() => readPageInfo(body, { page: effPage, pageSize: state.pageSize }), [body, effPage, state.pageSize]);

  const setPage = useCallback((p: number) => setState((s) => ({ ...s, page: clampPage(p) })), []);
  const setPageSize = useCallback((n: number) => setState({ page: 1, pageSize: clampPageSize(n) }), []);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    rows: body?.results ?? (EMPTY_ROWS as T[]),
    info,
    totals: body?.totals,
    loading, ready, error,
    page: effPage, pageSize: state.pageSize,
    setPage, setPageSize, refresh, loadedAt,
  };
}
