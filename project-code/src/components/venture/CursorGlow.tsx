import { useEffect, useRef } from "react";

/** A whisper-soft glow that follows the cursor. Fixed, pointer-events:none. */
export const CursorGlow = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine) return;

    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };

    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      if (ref.current) {
        ref.current.style.transform = `translate3d(${cx - 280}px, ${cy - 280}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 h-[560px] w-[560px] z-[1] mix-blend-multiply"
      style={{
        background:
          "radial-gradient(circle, hsl(var(--primary) / 0.16) 0%, transparent 60%)",
        willChange: "transform",
      }}
    />
  );
};
