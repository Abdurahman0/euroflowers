import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listPaged, API_BASE } from "./api";

/**
 * BOSQICHMA-BOSQICH RO'YXAT (lib/api.ts → listPaged).
 *
 * ⚠️ NEGA SINALADI: bu funksiya Sklad, Katalog va «Floristlarga chiqarilgan»
 * sahifalarining YAGONA yuklash yo'li. Xatosi jimgina bo'ladi — ro'yxat qisqa
 * ko'rinadi, sarlavha jamilari esa shu qisqa ro'yxatdan hisoblanib, NOTO'G'RI
 * raqam chiqaradi. Shuning uchun asosiy xavf «kam qator qaytardi».
 */

const rows = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: from + i }));

/** So'ralgan URL'larni yozib boradigan soxta server. */
function mockApi(total: number, opts: { failPage?: number; failFirst?: boolean } = {}) {
  const seen: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    seen.push(url);
    const u = new URL(url);
    const size = Number(u.searchParams.get("page_size"));
    const page = Number(u.searchParams.get("page") || 1);
    if (opts.failFirst && page === 1) return { ok: false, status: 500, headers: new Headers(), json: async () => ({ detail: "boom" }) };
    if (opts.failPage === page) return { ok: false, status: 500, headers: new Headers(), json: async () => ({ detail: "boom" }) };
    const start = (page - 1) * size;
    const slice = rows(start, Math.max(0, Math.min(size, total - start)));
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({ count: total, next: start + size < total ? "x" : null, previous: null, results: slice }),
    };
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return { seen };
}

beforeEach(() => {
  // request() oflayn brauzerda darhol yiqiladi — test muhitida `onLine` false
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("localStorage", {
    getItem: () => JSON.stringify({ access: "t", refresh: "r" }),
    setItem: () => {}, removeItem: () => {},
  });
});
afterEach(() => vi.unstubAllGlobals());

const pageNums = (seen: string[]) => seen.map((u) => Number(new URL(u).searchParams.get("page") || 1));

describe("listPaged — bosqichma-bosqich yuklash", () => {
  it("bitta sahifa — onPage BIR marta, darhol `done: true`", async () => {
    mockApi(10);
    const calls: { n: number; done: boolean }[] = [];
    const out = await listPaged<{ id: number }>("/api/x/", undefined, (r, done) => calls.push({ n: r.length, done }), 24);
    expect(out).toHaveLength(10);
    expect(calls).toEqual([{ n: 10, done: true }]);
  });

  it("⚠️ BIRINCHI SAHIFA DARHOL, keyin TO'LIQ ro'yxat — ikkala chaqiruv ham bo'ladi", async () => {
    mockApi(146);   // jonli katalog hajmi
    const calls: { n: number; done: boolean }[] = [];
    const out = await listPaged<{ id: number }>("/api/catalog/", undefined, (r, done) => calls.push({ n: r.length, done }), 24);
    expect(calls[0]).toEqual({ n: 24, done: false });      // ekran shu bilan to'ladi
    expect(calls.at(-1)).toEqual({ n: 146, done: true });  // jamilar SHU bilan aniqlashadi
    expect(out).toHaveLength(146);
  });

  /**
   * ⚠️ BUTUN OPTIMALLASHTIRISHNING MOHIYATI. Bir marta shunday buzilgan: `onPage(…, false)`
   * hamma sahifa yuklangandan KEYIN chaqirilgan va ekran avvalgidek uzoq bo'sh turgan
   * (jonli o'lchov: katalog 2.5 s dan 8 s ga qaytib ketgan). Tartibni tekshiruvchi
   * sinovlar buni SEZMAGAN — shu bois bu yerda VAQT tekshiriladi: 1-chaqiruv
   * 2-sahifa SO'RALISHIDAN OLDIN bo'lishi shart.
   */
  it("⚠️ 1-sahifa QOLGANLARINI KUTMASDAN beriladi (2-sahifa so'ralishidan OLDIN)", async () => {
    const order: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      const size = Number(u.searchParams.get("page_size"));
      const page = Number(u.searchParams.get("page") || 1);
      order.push(`fetch:p${page}`);
      const start = (page - 1) * size;
      return {
        ok: true, status: 200, headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ count: 146, next: start + size < 146 ? "x" : null, previous: null, results: rows(start, Math.min(size, 146 - start)) }),
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await listPaged<{ id: number }>("/api/catalog/", undefined, (r, done) => order.push(done ? "onPage:done" : `onPage:first(${r.length})`), 24);
    expect(order[0]).toBe("fetch:p1");
    expect(order[1]).toBe("onPage:first(24)");     // ← ekran SHU YERDA to'ladi
    expect(order[2]).toBe("fetch:p2");             // qolgan sahifalar KEYIN
    expect(order.at(-1)).toBe("onPage:done");
  });

  it("⚠️ QATOR YO'QOLMAYDI — hammasi, TARTIBI buzilmagan holda", async () => {
    mockApi(146);
    const out = await listPaged<{ id: number }>("/api/x/", undefined, () => {}, 24);
    expect(out.map((r) => r.id)).toEqual(Array.from({ length: 146 }, (_, i) => i));
  });

  it("⚠️ 500 QATOR SHIFTI — `list()` bilan AYNAN bir xil (kichik sahifa uni QISQARTIRMAYDI)", async () => {
    // eski `list()`: page_size=100 × 5 sahifa = 500. Sahifa 24 ta bo'lgani uchun
    // shift SAHIFA soniga emas, QATOR soniga qo'yilgan — aks holda 24×5=120 bo'lib
    // ro'yxat jimgina qisqarardi.
    mockApi(900);
    const out = await listPaged<{ id: number }>("/api/x/", undefined, () => {}, 24);
    expect(out).toHaveLength(504);            // 21 sahifa × 24 (500 dan oshgan oxirgi to'liq sahifa)
    expect(out.length).toBeGreaterThanOrEqual(500);
  });

  it("sahifa raqamlari 1..N — takror yoki tushib qolgan sahifa yo'q", async () => {
    const { seen } = mockApi(100);
    await listPaged<{ id: number }>("/api/x/", undefined, () => {}, 24);
    expect(pageNums(seen).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("⚠️ chaqiruvchi `page` bersa ham sahifalash BUZILMAYDI (spread'dan keyin qo'yilgan)", async () => {
    const { seen } = mockApi(60);
    await listPaged<{ id: number }>("/api/x/", { page: 7 }, () => {}, 24);
    expect(pageNums(seen).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("filtrlar HAR sahifaga uzatiladi — aks holda 2-sahifa filtrsiz kelardi", async () => {
    const { seen } = mockApi(60);
    await listPaged<{ id: number }>("/api/x/", { is_active: true, ordering: "-created_at" }, () => {}, 24);
    for (const u of seen) {
      expect(new URL(u).searchParams.get("is_active")).toBe("true");
      expect(new URL(u).searchParams.get("ordering")).toBe("-created_at");
    }
  });

  it("BIRINCHI sahifa yiqilsa — promise REJECT (chaqiruvchi xatoni ko'rsatadi)", async () => {
    mockApi(60, { failFirst: true });
    await expect(listPaged<{ id: number }>("/api/x/", undefined, () => {}, 24)).rejects.toBeTruthy();
  });

  it("⚠️ KEYINGI sahifa yiqilsa — ro'yxat BO'SHAB qolmaydi, o'sha bo'lak tushadi xolos", async () => {
    mockApi(60, { failPage: 2 });
    const out = await listPaged<{ id: number }>("/api/x/", undefined, () => {}, 24);
    expect(out).toHaveLength(36);             // 24 (1-sahifa) + 12 (3-sahifa)
    expect(out.length).toBeGreaterThan(0);
  });

  it("bo'sh javob — onPage bir marta, bo'sh ro'yxat bilan", async () => {
    mockApi(0);
    const calls: number[] = [];
    const out = await listPaged<{ id: number }>("/api/x/", undefined, (r) => calls.push(r.length), 24);
    expect(out).toEqual([]);
    expect(calls).toEqual([0]);
  });

  it("onPage'ga BERILGAN massiv nusxa — chaqiruvchi uni o'zgartirsa ichki holat buzilmaydi", async () => {
    mockApi(50);
    const grabbed: { id: number }[][] = [];
    const out = await listPaged<{ id: number }>("/api/x/", undefined, (r) => { grabbed.push(r); r.length = 0; }, 24);
    expect(out).toHaveLength(50);
    expect(grabbed).toHaveLength(2);
  });

  /**
   * ⚠️ JONLI TOPILGAN NOSOZLIK (08.08.2026). /api/stock-batches/?ordering=-received_at
   * da server teng `received_at` li qatorlarni HAR so'rovda boshqacha joylashtiradi.
   * Sahifa 24 bo'lganda 141 qatordan 6 tasi IKKI marta, 6 tasi esa UMUMAN kelmagan —
   * ekranda «Jami qoldiq» 225 o'rniga 175 dona chiqqan. Jimgina, xatosiz, NOTO'G'RI raqam.
   */
  it("BEQAROR tartib — dublikat tashlanadi va yo'qolgan qator BARQAROR tartib bilan qaytariladi", async () => {
    const total = 141;
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      const size = Number(u.searchParams.get("page_size"));
      const page = Number(u.searchParams.get("page") || 1);
      const stable = u.searchParams.get("ordering") === "-id";
      const start = (page - 1) * size;
      let slice = rows(start, Math.max(0, Math.min(size, total - start)));
      // beqaror tartibni taqlid qilamiz: har sahifa oxirgi qatorni TAKRORLAYDI
      if (!stable && start > 0) slice = [{ id: start - 1 }, ...slice.slice(0, -1)];
      return {
        ok: true, status: 200, headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ count: total, next: start + size < total ? "x" : null, previous: null, results: slice }),
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const out = await listPaged<{ id: number }>("/api/stock-batches/", { ordering: "-received_at" }, () => {}, 24);
    expect(out).toHaveLength(total);                                   // BITTA ham qator yo'qolmadi
    expect(new Set(out.map((r) => r.id)).size).toBe(total);            // dublikat ham yo'q
    // barqaror tartib bilan QAYTA olingani — o'sha `-id` so'rovi bo'lgan
    expect(fetchMock.mock.calls.some(([u]) => new URL(u as string).searchParams.get("ordering") === "-id")).toBe(true);
  });

  it("tartib BARQAROR bo'lsa — qayta olish YO'Q (ortiqcha so'rov qilinmaydi)", async () => {
    const { seen } = mockApi(141);
    await listPaged<{ id: number }>("/api/x/", { ordering: "-created_at" }, () => {}, 24);
    expect(seen).toHaveLength(6);   // 141/24 = 6 sahifa, qayta olish yo'q
    expect(seen.some((u) => new URL(u).searchParams.get("ordering") === "-id")).toBe(false);
  });

  it("dublikat kelsa — `id` bo'yicha bittasi qoladi", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200, headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({ count: 3, next: null, previous: null, results: [{ id: 1 }, { id: 1 }, { id: 2 }] }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const out = await listPaged<{ id: number }>("/api/x/", undefined, () => {}, 24);
    expect(out.map((r) => r.id)).toEqual([1, 2]);
  });

  it("so'rov manzili API_BASE bilan boshlanadi", async () => {
    const { seen } = mockApi(5);
    await listPaged<{ id: number }>("/api/x/", undefined, () => {}, 24);
    expect(seen[0].startsWith(API_BASE)).toBe(true);
  });
});
