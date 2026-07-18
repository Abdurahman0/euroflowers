"use client";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Kinematik sahifa o'tishi: chuqurlikdan suzib chiqish.
 * DIQQAT: bu yerda filter/blur ishlatib bo'lmaydi — framer yakuniy
 * "blur(0px)" qiymatini ushlab qoladi va sahifa fixed-elementlar uchun
 * containing block bo'lib, drawer/overlaylarni qafasga solib qo'yadi.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
