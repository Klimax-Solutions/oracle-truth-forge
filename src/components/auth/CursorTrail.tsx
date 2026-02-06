import { useEffect, useRef, useCallback } from "react";

const ORACLE_LETTERS = "ORACLE";
const MAX_PARTICLES = 50;
const SPAWN_INTERVAL = 30; // ms between particle spawns
const MOVE_THRESHOLD = 3; // minimum pixels moved to spawn

interface Particle {
  id: number;
  x: number;
  y: number;
  letter: string;
  opacity: number;
  scale: number;
  rotation: number;
  rotationSpeed: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

const CursorTrail = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -100, y: -100 });
  const prevMouseRef = useRef({ x: -100, y: -100 });
  const lastSpawnRef = useRef(0);
  const idCounterRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const isDarkRef = useRef(false);

  const spawnParticle = useCallback((x: number, y: number, velX: number, velY: number) => {
    const letter = ORACLE_LETTERS[Math.floor(Math.random() * ORACLE_LETTERS.length)];
    // Spread particles in cursor movement direction with some randomness
    const spread = (Math.random() - 0.5) * 1.2;

    const particle: Particle = {
      id: idCounterRef.current++,
      x,
      y,
      letter,
      opacity: 0.5 + Math.random() * 0.5,
      scale: 0.4 + Math.random() * 0.7,
      rotation: (Math.random() - 0.5) * 20,
      rotationSpeed: (Math.random() - 0.5) * 2,
      vx: velX * 0.15 + spread,
      vy: velY * 0.15 + 0.8 + Math.random() * 0.6, // downward drift
      life: 0,
      maxLife: 50 + Math.random() * 30, // frames
    };

    particlesRef.current.push(particle);

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
      prevMouseRef.current = { ...mouseRef.current };
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const checkDark = () => {
      isDarkRef.current = document.documentElement.classList.contains("dark");
    };

    const animate = (timestamp: number) => {
      if (!ctx || !canvas) return;
      checkDark();

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Only spawn when mouse has moved enough
      const dx = mouseRef.current.x - prevMouseRef.current.x;
      const dy = mouseRef.current.y - prevMouseRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (
        timestamp - lastSpawnRef.current > SPAWN_INTERVAL &&
        mouseRef.current.x > 0 &&
        dist > MOVE_THRESHOLD
      ) {
        spawnParticle(mouseRef.current.x, mouseRef.current.y, dx, dy);
        lastSpawnRef.current = timestamp;
      }

      // Update & draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // gravity
        p.vx *= 0.97; // friction
        p.rotation += p.rotationSpeed;

        const progress = p.life / p.maxLife;
        const fadeIn = Math.min(p.life / 5, 1);
        const fadeOut = progress > 0.4 ? 1 - (progress - 0.4) / 0.6 : 1;
        const currentOpacity = p.opacity * fadeIn * Math.max(fadeOut, 0);
        const currentScale = p.scale * (1 - progress * 0.4);

        if (p.life >= p.maxLife || currentOpacity <= 0) return false;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);

        const fontSize = 12 + currentScale * 10;
        ctx.font = `800 ${fontSize}px 'Inter', system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Subtle glow
        const glowColor = isDarkRef.current
          ? `rgba(255, 255, 255, ${currentOpacity * 0.2})`
          : `rgba(0, 0, 0, ${currentOpacity * 0.1})`;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;

        // Letter fill
        const letterColor = isDarkRef.current
          ? `rgba(255, 255, 255, ${currentOpacity * 0.18})`
          : `rgba(0, 0, 0, ${currentOpacity * 0.12})`;
        ctx.fillStyle = letterColor;
        ctx.fillText(p.letter, 0, 0);

        // Stroke for definition
        const strokeColor = isDarkRef.current
          ? `rgba(255, 255, 255, ${currentOpacity * 0.28})`
          : `rgba(0, 0, 0, ${currentOpacity * 0.14})`;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.4;
        ctx.strokeText(p.letter, 0, 0);

        ctx.restore();

        return true;
      });

      // Subtle glow around cursor (only when moving)
      if (mouseRef.current.x > 0 && dist > MOVE_THRESHOLD) {
        const gradient = ctx.createRadialGradient(
          mouseRef.current.x,
          mouseRef.current.y,
          0,
          mouseRef.current.x,
          mouseRef.current.y,
          80
        );
        const glowAlpha = isDarkRef.current ? 0.04 : 0.02;
        gradient.addColorStop(0, isDarkRef.current ? `rgba(255,255,255,${glowAlpha})` : `rgba(0,0,0,${glowAlpha})`);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(
          mouseRef.current.x - 80,
          mouseRef.current.y - 80,
          160,
          160
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
