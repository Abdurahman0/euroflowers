import type { Metadata } from "next";

/** Ochiq sahifa — qidiruv tizimlariga tushmasin (havolada maxfiy kod bor). */
export const metadata: Metadata = {
  title: "Yetkazib berish manzili — EuroFlowers",
  description: "Xaritada yetkazib berish nuqtasini belgilang.",
  robots: { index: false, follow: false },
};

export default function LocLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
