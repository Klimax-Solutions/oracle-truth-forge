import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  minTime?: string;
  maxTime?: string;
  label?: string;
  error?: boolean;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

export function TimePicker({
  value,
  onChange,
  minTime,
  maxTime,
  label,
  error,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedHour, setSelectedHour] = React.useState(value?.split(":")[0] || "15");
  const [selectedMinute, setSelectedMinute] = React.useState(value?.split(":")[1] || "00");

  const hourRef = React.useRef<HTMLDivElement>(null);
  const minuteRef = React.useRef<HTMLDivElement>(null);

  // Update selected values when value prop changes
  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      setSelectedHour(h || "15");
      setSelectedMinute(m || "00");
    }
  }, [value]);

  // Scroll to selected values when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        const hourIndex = HOURS.indexOf(selectedHour);
        const minuteIndex = MINUTES.indexOf(selectedMinute);
        
        if (hourRef.current && hourIndex >= 0) {
          const itemHeight = 40;
          hourRef.current.scrollTop = hourIndex * itemHeight - 60;
        }
        if (minuteRef.current && minuteIndex >= 0) {
          const itemHeight = 40;
          minuteRef.current.scrollTop = minuteIndex * itemHeight - 60;
        }
      }, 50);
    }
  }, [open, selectedHour, selectedMinute]);

  const handleHourSelect = (hour: string) => {
    setSelectedHour(hour);
    onChange(`${hour}:${selectedMinute}`);
  };

  const handleMinuteSelect = (minute: string) => {
    setSelectedMinute(minute);
    onChange(`${selectedHour}:${minute}`);
  };

  const isTimeDisabled = (hour: string, minute: string) => {
    const time = `${hour}:${minute}`;
    if (minTime && time < minTime) return true;
    if (maxTime && time > maxTime) return true;
    return false;
  };

  const displayValue = value || "--:--";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between font-normal",
            "bg-background border-input hover:bg-accent/50",
            "h-10 px-3 text-left",
            error && "border-red-500",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="font-mono text-sm">{displayValue}</span>
          <Clock className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[200px] p-0 bg-popover border border-border shadow-xl" 
        align="start"
        sideOffset={4}
      >
        <div className="flex h-[200px]">
          {/* Hours column */}
          <div className="flex-1 border-r border-border">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
              Heure
            </div>
            <ScrollArea className="h-[160px]">
              <div ref={hourRef} className="py-1">
                {HOURS.map((hour) => {
                  const isDisabled = minTime && `${hour}:59` < minTime;
                  const isMaxDisabled = maxTime && `${hour}:00` > maxTime;
                  
                  return (
                    <button
                      key={hour}
                      onClick={() => !isDisabled && !isMaxDisabled && handleHourSelect(hour)}
                      disabled={isDisabled || isMaxDisabled}
                      className={cn(
                        "w-full h-10 flex items-center justify-center text-sm font-mono transition-all",
                        "hover:bg-accent/80 focus:outline-none focus:bg-accent",
                        selectedHour === hour && "bg-primary text-primary-foreground hover:bg-primary/90",
                        (isDisabled || isMaxDisabled) && "opacity-30 cursor-not-allowed hover:bg-transparent"
                      )}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          
          {/* Minutes column */}
          <div className="flex-1">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
              Min
            </div>
            <ScrollArea className="h-[160px]">
              <div ref={minuteRef} className="py-1">
                {MINUTES.map((minute) => {
                  const fullTime = `${selectedHour}:${minute}`;
                  const isDisabled = isTimeDisabled(selectedHour, minute);
                  
                  return (
                    <button
                      key={minute}
                      onClick={() => !isDisabled && handleMinuteSelect(minute)}
                      disabled={isDisabled}
                      className={cn(
                        "w-full h-10 flex items-center justify-center text-sm font-mono transition-all",
                        "hover:bg-accent/80 focus:outline-none focus:bg-accent",
                        selectedMinute === minute && "bg-primary text-primary-foreground hover:bg-primary/90",
                        isDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
                      )}
                    >
                      {minute}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
        
        {/* Quick actions */}
        <div className="border-t border-border p-2 flex gap-1">
          <Button
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
            variant="default"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => setOpen(false)}
          >
            OK
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
