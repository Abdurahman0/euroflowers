"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";

export default function Toast() {
  const toast = useStore((s) => s.toast);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.92, x: "-50%" }}
          animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
          exit={{ opacity: 0, y: 12, scale: 0.95, x: "-50%" }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="fixed bottom-6 left-1/2 z-[100] whitespace-nowrap rounded-full border border-white/25 px-6 py-3 text-[14px] font-bold text-white shadow-2xl backdrop-blur-xl"
          style={{ background: "rgba(30, 23, 18, .82)" }}
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
