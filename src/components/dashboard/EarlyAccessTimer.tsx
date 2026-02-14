import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface EarlyAccessTimerProps {
  expiresAt: string;
}

export const EarlyAccessTimer = ({ expiresAt }: EarlyAccessTimerProps) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const calc = () => {
      const now = new Date().getTime();
      const end = new Date(expiresAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="w-full bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-3 z-[60]">
      <Clock className="w-4 h-4 flex-shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wider">
        Accès anticipé limité
      </span>
      <div className="font-mono text-sm font-bold tracking-widest">
        {expired ? (
          <span>EXPIRÉ</span>
        ) : (
          <>
            {timeLeft.days > 0 && <span>{timeLeft.days}j </span>}
            {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
          </>
        )}
      </div>
    </div>
  );
};
