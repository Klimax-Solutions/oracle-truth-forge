import { useState, useEffect, useRef } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TIMEZONE_OPTIONS = [
  { value: "Europe/Paris", label: "Paris (UTC+1/+2)" },
  { value: "Europe/London", label: "Londres (UTC+0/+1)" },
  { value: "Europe/Berlin", label: "Berlin (UTC+1/+2)" },
  { value: "Europe/Madrid", label: "Madrid (UTC+1/+2)" },
  { value: "Europe/Rome", label: "Rome (UTC+1/+2)" },
  { value: "Europe/Brussels", label: "Bruxelles (UTC+1/+2)" },
  { value: "Europe/Zurich", label: "Zurich (UTC+1/+2)" },
  { value: "Europe/Moscow", label: "Moscou (UTC+3)" },
  { value: "America/New_York", label: "New York (UTC-5/-4)" },
  { value: "America/Chicago", label: "Chicago (UTC-6/-5)" },
  { value: "America/Denver", label: "Denver (UTC-7/-6)" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC-8/-7)" },
  { value: "America/Toronto", label: "Toronto (UTC-5/-4)" },
  { value: "America/Montreal", label: "Montréal (UTC-5/-4)" },
  { value: "America/Sao_Paulo", label: "São Paulo (UTC-3)" },
  { value: "Asia/Dubai", label: "Dubaï (UTC+4)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Asia/Shanghai", label: "Shanghai (UTC+8)" },
  { value: "Asia/Singapore", label: "Singapour (UTC+8)" },
  { value: "Asia/Kolkata", label: "Mumbai (UTC+5:30)" },
  { value: "Australia/Sydney", label: "Sydney (UTC+10/+11)" },
  { value: "Africa/Casablanca", label: "Casablanca (UTC+0/+1)" },
  { value: "Africa/Lagos", label: "Lagos (UTC+1)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (UTC+2)" },
  { value: "Pacific/Auckland", label: "Auckland (UTC+12/+13)" },
];

interface HeaderClockProps {
  timezone: string;
  onTimezoneChange?: (tz: string) => void;
}

export const HeaderClock = ({ timezone, onTimezoneChange }: HeaderClockProps) => {
  const [time, setTime] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const city = timezone.split("/").pop()?.replace(/_/g, " ") || timezone;

  const handleSelect = async (tz: string) => {
    setSaving(true);
    setDropdownOpen(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ timezone: tz } as any).eq("user_id", user.id);
    }
    onTimezoneChange?.(tz);
    setSaving(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setDropdownOpen(p => !p)}
        className={cn(
          "flex items-center gap-1.5 text-xs font-mono text-muted-foreground px-2 py-1 rounded-md border border-transparent transition-all",
          "hover:border-border hover:bg-muted/50",
          dropdownOpen && "border-border bg-muted/50"
        )}
      >
        <Clock className="w-3.5 h-3.5" />
        <span className="font-bold text-foreground">{time}</span>
        <span className="text-[10px] uppercase tracking-wider hidden lg:inline">{city}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", dropdownOpen && "rotate-180")} />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
          {TIMEZONE_OPTIONS.map(tz => (
            <button
              key={tz.value}
              onClick={() => handleSelect(tz.value)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs font-mono hover:bg-muted/60 transition-colors",
                tz.value === timezone && "bg-primary/10 text-primary font-semibold"
              )}
            >
              {tz.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
