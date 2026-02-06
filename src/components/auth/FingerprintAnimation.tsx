import { useMemo } from "react";

interface FingerprintAnimationProps {
  progress: number; // 0-100
  verified: boolean;
}

const FingerprintAnimation = ({ progress, verified }: FingerprintAnimationProps) => {
  // Generate fingerprint ridge paths (concentric ellipses with slight distortion)
  const ridges = useMemo(() => {
    const paths: { d: string; delay: number; threshold: number }[] = [];
    const cx = 100, cy = 120;
    const totalRidges = 18;

    for (let i = 0; i < totalRidges; i++) {
      const rx = 12 + i * 4.5;
      const ry = 14 + i * 5;
      // Slight wave distortion for realism
      const wobble = Math.sin(i * 0.7) * 2;
      const wobble2 = Math.cos(i * 0.5) * 1.5;
      
      // Create arc paths (not full ellipses for fingerprint look)
      const startAngle = -160 + i * 2;
      const endAngle = 160 - i * 2;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      const x1 = cx + (rx + wobble) * Math.cos(startRad);
      const y1 = cy + (ry + wobble2) * Math.sin(startRad);
      const x2 = cx + (rx + wobble) * Math.cos(endRad);
      const y2 = cy + (ry + wobble2) * Math.sin(endRad);

      const largeArc = endAngle - startAngle > 180 ? 1 : 0;

      const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${(rx + wobble).toFixed(1)} ${(ry + wobble2).toFixed(1)} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      
      paths.push({
        d,
        delay: i * 0.08,
        threshold: (i / totalRidges) * 90, // Ridge appears at this progress %
      });
    }

    // Add some central whorl lines
    for (let i = 0; i < 5; i++) {
      const r = 4 + i * 2.5;
      const angle = i * 72;
      const rad = (angle * Math.PI) / 180;
      const x1 = cx + r * 0.3 * Math.cos(rad);
      const y1 = cy + r * 0.4 * Math.sin(rad);
      const x2 = cx + r * Math.cos(rad + 2);
      const y2 = cy + r * Math.sin(rad + 2);
      
      paths.push({
        d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx} ${cy} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
        delay: 0.3 + i * 0.05,
        threshold: i * 5,
      });
    }

    return paths;
  }, []);

  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${verified ? "animate-pulse" : ""}`}>
      <svg
        viewBox="0 0 200 240"
        className="w-64 h-80 md:w-80 md:h-96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {ridges.map((ridge, i) => {
          const isVisible = progress >= ridge.threshold;
          const opacity = isVisible
            ? verified
              ? 0.4
              : Math.min(0.08 + ((progress - ridge.threshold) / 30) * 0.15, 0.2)
            : 0;

          return (
            <path
              key={i}
              d={ridge.d}
              stroke={verified ? "hsl(var(--foreground))" : "hsl(var(--foreground))"}
              strokeWidth={1.2}
              strokeLinecap="round"
              fill="none"
              style={{
                opacity,
                transition: `opacity 0.4s ease ${ridge.delay}s`,
                filter: verified ? "drop-shadow(0 0 6px hsl(var(--foreground) / 0.3))" : "none",
              }}
            />
          );
        })}

        {/* Central dot */}
        <circle
          cx="100"
          cy="120"
          r="3"
          fill="hsl(var(--foreground))"
          style={{
            opacity: progress > 5 ? (verified ? 0.6 : 0.15) : 0,
            transition: "opacity 0.5s ease",
            filter: verified ? "drop-shadow(0 0 8px hsl(var(--foreground) / 0.4))" : "none",
          }}
        />
      </svg>
    </div>
  );
};

export default FingerprintAnimation;
