"use client";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import type { DateFilter } from "@/lib/types";

const OPTS: [DateFilter, string][] = [["bugun", "Bugun"], ["hafta", "7 kun"], ["oy", "30 kun"]];

export default function DateChips() {
  const { dateFilter, setDateFilter } = useStore();
  return (
    <div className="flex gap-1.5">
      {OPTS.map(([id, label]) => (
        <button key={id} onClick={() => setDateFilter(id)} className={clsx("chip", dateFilter === id && "chip-active")}>
          {label}
        </button>
      ))}
    </div>
  );
}
