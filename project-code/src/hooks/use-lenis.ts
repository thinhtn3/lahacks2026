import Lenis from "lenis";
import { useEffect } from "react";

export function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: false });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
}
