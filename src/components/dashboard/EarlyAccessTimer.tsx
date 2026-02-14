import { useState, useEffect } from "react";

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
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hidden lg:inline">
        Votre accès anticipé expire dans
      </span>
      <div className="font-mono text-sm font-bold tracking-widest">
        {expired ? (
          <span className="text-destructive">EXPIRÉ</span>
        ) : (
          <span className="text-destructive">
            {timeLeft.days > 0 && <span>{timeLeft.days}j </span>}
            {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
          </span>
        )}
      </div>
    </div>
  );
};
