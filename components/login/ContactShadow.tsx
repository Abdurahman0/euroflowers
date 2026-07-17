"use client";
import { ContactShadows } from "@react-three/drei";

/**
 * Yumshoq kontakt soya — vaza stolga aniq "o'tiradi", hech narsa suzmaydi.
 * frames={1}·emas: buket shabadada qimirlaydi, soya jonli qoladi (har 2 kadrda).
 */
export default function ContactShadow() {
  return (
    <ContactShadows
      position={[0, 0.005, 0]}
      opacity={0.34}
      scale={5.5}
      blur={2.4}
      far={2.8}
      resolution={512}
      frames={Infinity}
      color="#3a2a20"
    />
  );
}
