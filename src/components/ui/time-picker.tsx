import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  minTime?: string;
  maxTime?: string;
  label?: string;
  error?: boolean;
  className?: string;
  /** Fired when user presses Enter — parent can advance focus to next field */
  onEnter?: () => void;
  /** Optional placeholder text inside the input */
  placeholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

/**
 * Format raw digits into an HH:MM string progressively as the user types.
 *   ""     -> ""
 *   "9"    -> "9"
 *   "09"   -> "09:"
 *   "091"  -> "09:1"
 *   "0915" -> "09:15"
 * Caps hour at 23, minute at 59 once both parts are present.
 */
function formatTimeInput(raw: string, { clamp = false }: { clamp?: boolean } = {}): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 0) return "";
  if (digits.length === 1) return digits;
  if (digits.length === 2) return digits + ":";
  // 3 or 4 digits: HH:M or HH:MM
  let hh = digits.slice(0, 2);
  let mm = digits.slice(2);
  if (clamp) {
    const hNum = Math.min(parseInt(hh, 10) || 0, 23);
    hh = hNum.toString().padStart(2, "0");
    if (mm.length === 2) {
      const mNum = Math.min(parseInt(mm, 10) || 0, 59);
      mm = mNum.toString().padStart(2, "0");
    }
  }
  return `${hh}:${mm}`;
}

/** Normalize on blur: pad/clamp, ensure HH:MM or empty */
function normalizeTime(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return "";
  // pad to 4 digits, then format+clamp
  const padded = digits.padEnd(4, "0").slice(0, 4);
  return formatTimeInput(padded, { clamp: true });
}

export function TimePicker({
  value,
  onChange,
  minTime,
  maxTime,
  error,
  className,
  onEnter,
  placeholder = "HH:MM",
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedHour, setSelectedHour] = React.useState(value?.split(":")[0] || "15");
  const [selectedMinute, setSelectedMinute] = React.useState(value?.split(":")[1] || "00");
  // Local input buffer so the user can type freely (e.g. "09" without colon)
  const [inputValue, setInputValue] = React.useState(value || "");

  const hourRef = React.useRef<HTMLDivElement>(null);
  const minuteRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync from prop → local state when external value changes (e.g. popover pick)
  React.useEffect(() => {
    setInputValue(value || "");
    if (value) {
      const [h, m] = value.split(":");
      setSelectedHour(h || "15");
      setSelectedMinute(m || "00");
    }
  }, [value]);

  // Scroll popover columns when opening
  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        const hourIndex = HOURS.indexOf(selectedHour);
        const minuteIndex = MINUTES.indexOf(selectedMinute);
        const itemHeight = 40;
        if (hourRef.current && hourIndex >= 0) {
          hourRef.current.scrollTop = Math.max(0, hourIndex * itemHeight - 60);
        }
        if (minuteRef.current && minuteIndex >= 0) {
          minuteRef.current.scrollTop = Math.max(0, minuteIndex * itemHeight - 60);
        }
      });
    }
  }, [open, selectedHour, selectedMinute]);

  const handleHourSelect = (hour: string) => {
    setSelectedHour(hour);
    const next = `${hour}:${selectedMinute}`;
    setInputValue(next);
    onChange(next);
  };

  const handleMinuteSelect = (minute: string) => {
    setSelectedMinute(minute);
    const next = `${selectedHour}:${minute}`;
    setInputValue(next);
    onChange(next);
  };

  const isTimeDisabled = (hour: string, minute: string) => {
    const time = `${hour}:${minute}`;
    if (minTime && time < minTime) return true;
    if (maxTime && time > maxTime) return true;
    return false;
  };

  // ── Keyboard input handling ─────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatTimeInput(raw);
    setInputValue(formatted);
    // Only propagate when we have a complete valid HH:MM (so parent state stays sane)
    if (/^\d{2}:\d{2}$/.test(formatted)) {
      const normalized = normalizeTime(formatted);
      onChange(normalized);
    } else if (formatted === "") {
      onChange("");
    }
  };

  const handleInputBlur = () => {
    const normalized = normalizeTime(inputValue);
    setInputValue(normalized);
    if (normalized !== value) onChange(normalized);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow tab/enter to commit value immediately (before focus moves)
    if (e.key === "Enter") {
      const normalized = normalizeTime(inputValue);
      setInputValue(normalized);
      if (normalized !== value) onChange(normalized);
      onEnter?.();
      return;
    }
    // Allow standard editing keys
    const allowed = [
      "Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight",
      "ArrowUp", "ArrowDown", "Home", "End",
    ];
    if (allowed.includes(e.key)) return;
    // Allow copy/paste/select-all
    if ((e.metaKey || e.ctrlKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return;
    // Only digits and ":" are allowed
    if (!/^[0-9:]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const formatted = formatTimeInput(text);
    setInputValue(formatted);
    if (/^\d{2}:\d{2}$/.test(formatted)) {
      onChange(normalizeTime(formatted));
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-center w-full h-10 rounded-md border bg-background transition-colors",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
        error ? "border-red-500" : "border-input",
        className,
      )}
    >
      {/* Native-like input (keyboard-first) */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        onPaste={handleInputPaste}
        placeholder={placeholder}
        maxLength={5}
        className={cn(
          "flex-1 h-full px-3 bg-transparent text-sm font-mono",
          "placeholder:text-muted-foreground/50 text-foreground",
          "outline-none focus:outline-none",
        )}
      />
      {/* Clock icon — click to open popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={-1}
            className="h-full px-2 rounded-l-none rounded-r-md hover:bg-accent/60 focus:outline-none"
            aria-label="Ouvrir le sélecteur d'heure"
          >
            <Clock className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[220px] p-0 bg-popover border border-border shadow-xl pointer-events-auto"
          align="end"
          sideOffset={4}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="flex h-[240px]">
            {/* Hours column */}
            <div className="flex-1 border-r border-border flex flex-col">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30 shrink-0">
                Heure
              </div>
              <div
                ref={hourRef}
                className="flex-1 overflow-y-scroll overscroll-contain py-1"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {HOURS.map((hour) => {
                  const isDisabled = minTime && `${hour}:59` < minTime;
                  const isMaxDisabled = maxTime && `${hour}:00` > maxTime;
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => !isDisabled && !isMaxDisabled && handleHourSelect(hour)}
                      disabled={!!isDisabled || !!isMaxDisabled}
                      className={cn(
                        "w-full h-10 flex items-center justify-center text-sm font-mono transition-all",
                        "hover:bg-accent/80 focus:outline-none focus:bg-accent",
                        selectedHour === hour && "bg-primary text-primary-foreground hover:bg-primary/90",
                        (isDisabled || isMaxDisabled) && "opacity-30 cursor-not-allowed hover:bg-transparent",
                      )}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Minutes column */}
            <div className="flex-1 flex flex-col">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30 shrink-0">
                Min
              </div>
              <div
                ref={minuteRef}
                className="flex-1 overflow-y-scroll overscroll-contain py-1"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {MINUTES.map((minute) => {
                  const isDisabled = isTimeDisabled(selectedHour, minute);
                  return (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => !isDisabled && handleMinuteSelect(minute)}
                      disabled={isDisabled}
                      className={cn(
                        "w-full h-10 flex items-center justify-center text-sm font-mono transition-all",
                        "hover:bg-accent/80 focus:outline-none focus:bg-accent",
                        selectedMinute === minute && "bg-primary text-primary-foreground hover:bg-primary/90",
                        isDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent",
                      )}
                    >
                      {minute}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-border p-2 flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => {
                setInputValue("");
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
              onClick={() => setOpen(false)}
            >
              OK
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
