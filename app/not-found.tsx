import Link from "next/link";

/** 404 — yo'qolgan sahifa ham gulzorning bir burchagi. */
export default function NotFound() {
  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <img
        src="/flowers/textures/peony.png"
        alt=""
        aria-hidden
        width={150}
        height={150}
        className="opacity-80"
        style={{
          filter: "saturate(0.85) drop-shadow(0 16px 34px rgba(140,80,70,0.28))",
          animation: "gentleFloat 7s ease-in-out infinite",
        }}
      />
      <h1 className="text-[42px] tracking-tight">404</h1>
      <p className="max-w-[340px] text-[14px] leading-relaxed" style={{ color: "var(--mut)" }}>
        Bu sahifa gulzordan topilmadi. Balki u allaqachon guldastaga aylangandir.
      </p>
      <Link href="/" className="btn-primary !flex-none px-8">
        Bosh sahifaga qaytish
      </Link>
    </div>
  );
}
