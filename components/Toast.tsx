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
          className="fixed bottom-6 left-1/2 z-[100] max-w-[min(560px,90vw)] rounded-full border px-6 py-3 text-center text-[14px] font-semibold shadow-2xl"
          // qat'iy to'q pilyulya + yorqin oq matn — video foni va yorug' rejimda
          // ham bir xil o'qiladi (mavzu o'zgaruvchilariga bog'lanmaydi ataylab)
          style={{ background: "rgba(28, 21, 16, 0.96)", borderColor: "rgba(255, 255, 255, 0.28)", color: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
