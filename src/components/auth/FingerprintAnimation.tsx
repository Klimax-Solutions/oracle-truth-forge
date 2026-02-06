import { useMemo } from "react";

interface FingerprintAnimationProps {
  progress: number; // 0-100
  verified: boolean;
}

const FingerprintAnimation = ({ progress, verified }: FingerprintAnimationProps) => {
  // Generate dense fingerprint ridge paths (many concentric arcs with spiral feel)
  const ridges = useMemo(() => {
    const paths: { d: string; delay: number; threshold: number }[] = [];
    const cx = 150, cy = 180;
    const totalRidges = 35;

    for (let i = 0; i < totalRidges; i++) {
      const rx = 8 + i * 3.8;
      const ry = 10 + i * 4.2;
      // Subtle wave distortion for realism
      const wobble = Math.sin(i * 0.9) * 1.8;
      const wobble2 = Math.cos(i * 0.6) * 1.2;
      
      // Varying arc lengths for organic fingerprint look
      const startAngle = -165 + i * 1.5 + Math.sin(i * 0.4) * 5;
      const endAngle = 165 - i * 1.5 - Math.cos(i * 0.3) * 5;
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
        delay: i * 0.04,
        threshold: (i / totalRidges) * 85,
      });
    }

    // Add spiral whorl lines at center
    for (let i = 0; i < 12; i++) {
      const r = 3 + i * 1.8;
      const angle = i * 47;
      const rad = (angle * Math.PI) / 180;
      const rad2 = ((angle + 120) * Math.PI) / 180;
      const x1 = cx + r * 0.4 * Math.cos(rad);
      const y1 = cy + r * 0.5 * Math.sin(rad);
      const x2 = cx + r * 1.1 * Math.cos(rad2);
      const y2 = cy + r * 1.1 * Math.sin(rad2);
      
      paths.push({
        d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx + Math.sin(i) * 3} ${cy + Math.cos(i) * 3} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
        delay: 0.15 + i * 0.03,
        threshold: i * 3,
      });
    }

    // Add broken/dashed segments between main ridges for density
    for (let i = 0; i < 20; i++) {
      const rx = 15 + i * 5.5;
      const ry = 18 + i * 6;
      const segStart = -90 + i * 8 + Math.sin(i * 1.3) * 15;
      const segEnd = segStart + 30 + Math.cos(i * 0.7) * 15;
      const startRad = (segStart * Math.PI) / 180;
      const endRad = (segEnd * Math.PI) / 180;
      
      const x1 = cx + rx * Math.cos(startRad);
      const y1 = cy + ry * Math.sin(startRad);
      const x2 = cx + rx * Math.cos(endRad);
      const y2 = cy + ry * Math.sin(endRad);

      paths.push({
        d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
        delay: 0.2 + i * 0.03,
        threshold: (i / 20) * 70 + 10,
      });
    }

    return paths;
  }, []);

  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-700 ${verified ? "animate-pulse" : ""}`}>
      <svg
        viewBox="0 0 300 360"
        className="w-[22rem] h-[28rem] md:w-[28rem] md:h-[36rem]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {ridges.map((ridge, i) => {
          const isVisible = progress >= ridge.threshold;
          const opacity = isVisible
            ? verified
              ? 0.2
              : Math.min(0.04 + ((progress - ridge.threshold) / 40) * 0.06, 0.1)
            : 0;

          return (
            <path
              key={i}
              d={ridge.d}
              stroke="hsl(var(--foreground))"
              strokeWidth={0.8}
              strokeLinecap="round"
              fill="none"
              style={{
                opacity,
                transition: `opacity 0.5s ease ${ridge.delay}s`,
                filter: verified ? "drop-shadow(0 0 4px hsl(var(--foreground) / 0.15))" : "none",
              }}
            />
          );
        })}

        {/* Central dot */}
        <circle
          cx="150"
          cy="180"
          r="2.5"
          fill="hsl(var(--foreground))"
          style={{
            opacity: progress > 5 ? (verified ? 0.3 : 0.06) : 0,
            transition: "opacity 0.5s ease",
            filter: verified ? "drop-shadow(0 0 6px hsl(var(--foreground) / 0.2))" : "none",
          }}
        />
      </svg>
    </div>
  );
};

export default FingerprintAnimation;
