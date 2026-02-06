import { useEffect, useRef, useCallback } from "react";

const ORACLE_LETTERS = "ORACLE";
const MAX_PARTICLES = 40;
const SPAWN_INTERVAL = 50; // ms between particle spawns

interface Particle {
  id: number;
  x: number;
  y: number;
  letter: string;
  opacity: number;
  scale: number;
  rotation: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

const CursorTrail = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -100, y: -100 });
  const lastSpawnRef = useRef(0);
  const idCounterRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const isDarkRef = useRef(false);

  const spawnParticle = useCallback((x: number, y: number) => {
    const letter = ORACLE_LETTERS[Math.floor(Math.random() * ORACLE_LETTERS.length)];
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.3 + Math.random() * 0.8;

    const particle: Particle = {
      id: idCounterRef.current++,
      x,
      y,
      letter,
      opacity: 0.6 + Math.random() * 0.4,
      scale: 0.5 + Math.random() * 0.8,
      rotation: (Math.random() - 0.5) * 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed + 0.5, // slight downward drift
      life: 0,
      maxLife: 60 + Math.random() * 40, // frames
    };

    particlesRef.current.push(particle);

    // Keep particle count manageable
    if (particlesRef.current.length > MAX_PARTICLES) {
      particlesRef.current.shift();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const checkDark = () => {
      isDarkRef.current = document.documentElement.classList.contains("dark");
    };

    const animate = (timestamp: number) => {
      if (!ctx || !canvas) return;
      checkDark();

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Spawn particles at cursor
      if (timestamp - lastSpawnRef.current > SPAWN_INTERVAL && mouseRef.current.x > 0) {
        spawnParticle(mouseRef.current.x, mouseRef.current.y);
        lastSpawnRef.current = timestamp;
      }

      // Update & draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02; // gravity
        p.vx *= 0.99; // friction

        const progress = p.life / p.maxLife;
        const fadeIn = Math.min(p.life / 8, 1);
        const fadeOut = progress > 0.5 ? 1 - (progress - 0.5) * 2 : 1;
        const currentOpacity = p.opacity * fadeIn * fadeOut;
        const currentScale = p.scale * (1 - progress * 0.3);

        if (p.life >= p.maxLife) return false;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);

        const fontSize = 14 + currentScale * 12;
        ctx.font = `800 ${fontSize}px 'Inter', system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Glow effect
        const glowColor = isDarkRef.current
          ? `rgba(255, 255, 255, ${currentOpacity * 0.3})`
          : `rgba(0, 0, 0, ${currentOpacity * 0.15})`;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 20;

        // Letter color - subtle glow
        const letterColor = isDarkRef.current
          ? `rgba(255, 255, 255, ${currentOpacity * 0.15})`
          : `rgba(0, 0, 0, ${currentOpacity * 0.1})`;
        ctx.fillStyle = letterColor;
        ctx.fillText(p.letter, 0, 0);

        // Outline stroke for definition
        const strokeColor = isDarkRef.current
          ? `rgba(255, 255, 255, ${currentOpacity * 0.25})`
          : `rgba(0, 0, 0, ${currentOpacity * 0.12})`;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.5;
        ctx.strokeText(p.letter, 0, 0);

        ctx.restore();

        return true;
      });

      // Draw subtle glow around cursor
      if (mouseRef.current.x > 0) {
        const gradient = ctx.createRadialGradient(
          mouseRef.current.x,
          mouseRef.current.y,
          0,
          mouseRef.current.x,
          mouseRef.current.y,
          120
        );
        const glowAlpha = isDarkRef.current ? 0.06 : 0.03;
        gradient.addColorStop(0, isDarkRef.current ? `rgba(255,255,255,${glowAlpha})` : `rgba(0,0,0,${glowAlpha})`);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(
          mouseRef.current.x - 120,
          mouseRef.current.y - 120,
          240,
          240
        );
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [spawnParticle]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[2] pointer-events-none"
      aria-hidden="true"
    />
  );
};

export default CursorTrail;
