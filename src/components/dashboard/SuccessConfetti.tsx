import { useCallback } from "react";
import confetti from "canvas-confetti";

export const useSuccessConfetti = () => {
  const fireConfetti = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ["#FFD700", "#FFF8DC", "#87CEEB", "#FFFACD", "#F0E68C", "#E6E6FA"];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
        shapes: ["circle", "square"],
        scalar: 0.8,
        drift: 0.5,
        gravity: 0.6,
        ticks: 200,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
        shapes: ["circle", "square"],
        scalar: 0.8,
        drift: -0.5,
        gravity: 0.6,
        ticks: 200,
      });

      // Center rain effect
      confetti({
        particleCount: 2,
        angle: 90,
        spread: 160,
        origin: { x: 0.5, y: 0 },
        colors,
        shapes: ["circle"],
        scalar: 0.6,
        gravity: 0.4,
        drift: 0,
        ticks: 300,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

  return { fireConfetti };
};
