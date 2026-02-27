import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface HeaderClockProps {
  timezone: string;
}

export const HeaderClock = ({ timezone }: HeaderClockProps) => {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      try {
        const now = new Date();
        const formatted = now.toLocaleTimeString("fr-FR", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setTime(formatted);
      } catch {
        setTime("--:--:--");
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  // Extract city name from timezone
  const city = timezone.split("/").pop()?.replace(/_/g, " ") || timezone;

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
      <Clock className="w-3.5 h-3.5" />
      <span className="font-bold text-foreground">{time}</span>
      <span className="text-[10px] uppercase tracking-wider hidden lg:inline">{city}</span>
    </div>
  );
};
