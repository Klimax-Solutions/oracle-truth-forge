import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

interface DatePickerProps {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Sélectionner...",
  error,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [manualDay, setManualDay] = React.useState("");
  const [manualMonth, setManualMonth] = React.useState("");
  const [manualYear, setManualYear] = React.useState("");
  const monthRef = React.useRef<HTMLInputElement>(null);
  const yearRef = React.useRef<HTMLInputElement>(null);

  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  // Sync manual inputs when value changes externally
  React.useEffect(() => {
    if (value) {
      const d = parse(value, "yyyy-MM-dd", new Date());
      if (isValid(d)) {
        setManualDay(format(d, "dd"));
        setManualMonth(format(d, "MM"));
        setManualYear(format(d, "yyyy"));
      }
    } else {
      setManualDay("");
      setManualMonth("");
      setManualYear("");
    }
  }, [value]);

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange(format(selectedDate, "yyyy-MM-dd"));
      setOpen(false);
    }
  };

  const tryApplyManualDate = (day: string, month: string, year: string) => {
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      const candidate = parse(`${year}-${month}-${day}`, "yyyy-MM-dd", new Date());
      if (isValid(candidate)) {
        onChange(format(candidate, "yyyy-MM-dd"));
      }
    }
  };

  const handleDayChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 2);
    setManualDay(clean);
    if (clean.length === 2) monthRef.current?.focus();
    tryApplyManualDate(clean, manualMonth, manualYear);
  };

  const handleMonthChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 2);
    setManualMonth(clean);
    if (clean.length === 2) yearRef.current?.focus();
    tryApplyManualDate(manualDay, clean, manualYear);
  };

  const handleYearChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 4);
    setManualYear(clean);
    tryApplyManualDate(manualDay, manualMonth, clean);
  };

  const displayValue = date ? format(date, "dd/MM/yyyy", { locale: fr }) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn(
            "w-full justify-between font-normal",
            "bg-background border-input hover:bg-accent/50",
            "h-10 px-3 text-left",
            error && "border-red-500",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="text-sm">{displayValue}</span>
          <CalendarIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-popover border border-border shadow-xl"
        align="start"
        sideOffset={4}
      >
        {/* Manual date input */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Saisie manuelle</p>
          <div className="flex items-center gap-1">
            <Input
              value={manualDay}
              onChange={(e) => handleDayChange(e.target.value)}
              placeholder="JJ"
              className="w-12 h-8 text-center text-xs font-mono px-1"
              maxLength={2}
            />
            <span className="text-muted-foreground text-xs">/</span>
            <Input
              ref={monthRef}
              value={manualMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              placeholder="MM"
              className="w-12 h-8 text-center text-xs font-mono px-1"
              maxLength={2}
            />
            <span className="text-muted-foreground text-xs">/</span>
            <Input
              ref={yearRef}
              value={manualYear}
              onChange={(e) => handleYearChange(e.target.value)}
              placeholder="AAAA"
              className="w-16 h-8 text-center text-xs font-mono px-1"
              maxLength={4}
            />
          </div>
        </div>

        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          locale={fr}
          className="p-3 pointer-events-auto"
          initialFocus
        />
        <div className="border-t border-border p-2 flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Effacer
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => {
              onChange(format(new Date(), "yyyy-MM-dd"));
              setOpen(false);
            }}
          >
            Aujourd'hui
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
