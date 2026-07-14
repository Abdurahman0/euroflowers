"use client";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

/**
 * Postprocessing dvigateli: yumshoq Bloom.
 * reduced-motion yoki past sifat rejimida umuman o'chadi.
 *
 * DepthOfField ataylab YO'Q: uning depth-blit yo'li ba'zi drayverlarda
 * "glBlitFramebuffer: depth-stencil" xatosi va miltillash beradi.
 * multisampling=0 + stencilsiz — barqaror, Bloom o'zi yumshatadi.
 */
export default function BloomController({
  enabled = true,
  bloom = 0.35,
}: {
  enabled?: boolean;
  bloom?: number;
}) {
  if (!enabled) return null;
  return (
    <EffectComposer multisampling={0} stencilBuffer={false} depthBuffer>
      <Bloom intensity={bloom} luminanceThreshold={0.75} luminanceSmoothing={0.3} mipmapBlur />
    </EffectComposer>
  );
}
