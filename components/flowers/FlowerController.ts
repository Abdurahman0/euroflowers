"use client";
import * as THREE from "three";
import { CLIP, FADE_S, PHASE_CLIP, NEXT_STEADY, type FlowerPhase } from "./FlowerAnimation";

/**
 * Gul animatsiya kontrolleri — mixer ustidan holat boshqaruvi.
 *   • WindIdle doim aylanadi (hech qachon to'xtamaydi)
 *   • Faza kliplari (Closed/Opening/FullyBloomed/Closing) o'zaro krossfeyd
 *   • O'tish kliplari bir marta ijro etilib, barqaror fazaga o'zi o'tadi
 * React'dan tashqarida ushlab turiladi — re-render yo'q.
 */
export class FlowerController {
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private phase: FlowerPhase | null = null;
  private onFinished = (e: { action: THREE.AnimationAction }) => {
    // Opening/Closing tugadi → mos barqaror fazaga silliq o'tamiz
    if (this.phase && e.action === this.current) {
      const steady = NEXT_STEADY[this.phase];
      if (steady) this.setPhase(steady);
    }
  };

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) {
      const a = this.mixer.clipAction(clip);
      this.actions.set(clip.name, a);
    }
    // WindIdle — abadiy sikl, boshqa kliplar bilan parallel qatlam
    const wind = this.actions.get(CLIP.windIdle);
    if (wind) {
      wind.setLoop(THREE.LoopRepeat, Infinity);
      wind.play();
    }
    this.mixer.addEventListener("finished", this.onFinished as never);
  }

  /** Fazaga o'tish. `progress` — o'tish klipining boshlanish nuqtasi (0..1). */
  setPhase(phase: FlowerPhase, progress = 0) {
    if (phase === this.phase) return;
    const next = this.actions.get(PHASE_CLIP[phase]);
    if (!next) return;

    const isTransition = phase === "opening" || phase === "closing";
    next.reset();
    if (isTransition) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      const dur = next.getClip().duration;
      next.time = THREE.MathUtils.clamp(progress, 0, 0.98) * dur;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }
    next.play();

    if (this.current) {
      this.current.crossFadeTo(next, FADE_S, false);
    } else {
      next.fadeIn(FADE_S * 0.5);
    }
    this.current = next;
    this.phase = phase;
  }

  update(delta: number) {
    this.mixer.update(delta);
  }

  dispose() {
    this.mixer.removeEventListener("finished", this.onFinished as never);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
