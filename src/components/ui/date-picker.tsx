import * as React from "react";
import { format, parse } from "date-fns";
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
  
  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange(format(selectedDate, "yyyy-MM-dd"));
      setOpen(false);
    }
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
