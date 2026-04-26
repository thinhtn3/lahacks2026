import { useMemo } from "react";
import { motion } from "framer-motion";

function buildPaths(position: number) {
  return Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
    duration: 14 + (i % 12) * 2,
    initialOffset: (i / 36),
  }));
}

export function FloatingPaths() {
  const pathsA = useMemo(() => buildPaths(1), []);
  const pathsB = useMemo(() => buildPaths(-1), []);

  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <svg
        className="w-full h-full text-foreground"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {[...pathsA, ...pathsB].map((path, idx) => (
          <motion.path
            key={idx}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.003 + path.id * 0.0015}
            initial={{ pathLength: 0.25, pathOffset: path.initialOffset }}
            animate={{ pathOffset: [path.initialOffset, path.initialOffset + 1] }}
            transition={{
              duration: path.duration,
              repeat: Infinity,
              repeatType: "loop",
              ease: "linear",
              delay: path.delay,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
