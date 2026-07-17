"use client";
import EnvironmentController from "@/components/three/engine/EnvironmentController";

/**
 * Blender previewga moslashtirilgan yorug'lik:
 *   • yumshoq studiya IBL (RoomEnvironment, PMREM) — HDRI tasviri ko'rinmaydi
 *   • iliq kalit nur yuqori-chapdan (preview soyalari o'ngga-pastga tushgan)
 *   • sovuqroq juda past to'ldiruvchi — kontrast yumshoq qoladi
 * Bloom yo'q, keskin HDR yo'q; ACES + sRGB LoginCanvas'da o'rnatiladi.
 */
export default function SceneLighting() {
  return (
    <>
      <EnvironmentController intensity={0.85} />
      <directionalLight
        position={[-3.2, 6.2, 4.6]}
        intensity={0.75}
        color="#fff2e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
      <directionalLight position={[4, 2.4, -2.5]} intensity={0.18} color="#e9e2f2" />
    </>
  );
}
