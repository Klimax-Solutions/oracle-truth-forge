import { useEffect, useRef } from "react";

interface VortexTransitionProps {
  isActive: boolean;
}

const NUM_STREAKS = 24;

const VortexTransition = ({ isActive }: VortexTransitionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    // Trigger reflow for animation restart
    containerRef.current.offsetHeight;
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Speed streaks radiating from center */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: "800px" }}>
        {Array.from({ length: NUM_STREAKS }).map((_, i) => {
          const angle = (360 / NUM_STREAKS) * i;
          const delay = Math.random() * 0.3;
          const length = 60 + Math.random() * 40;

          return (
            <div
              key={i}
              className="auth-speed-streak"
              style={{
                transform: `rotate(${angle}deg)`,
                animationDelay: `${delay}s`,
                ["--streak-length" as string]: `${length}vh`,
              }}
            />
          );
        })}
      </div>

      {/* Central light burst */}
      <div className="auth-light-burst" />

      {/* Radial closing overlay */}
      <div className="auth-vortex-overlay" />
    </div>
  );
};

export default VortexTransition;
