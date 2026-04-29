import * as React from "react";
import { createPortal } from "react-dom";
import { format, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

interface DatePickerProps {
  value: string; // ISO YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  className?: string;
  /** Date minimale autorisée (ISO YYYY-MM-DD). Les dates antérieures sont grisées dans le calendrier. */
  minDate?: string;
}

/**
 * DatePicker — sélecteur de date combinant saisie manuelle JJ/MM/AAAA
 * et calendrier visuel. Le dropdown s'ouvre via createPortal (position: fixed)
 * pour un alignement parfait quelle que soit la hiérarchie CSS.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "JJ/MM/AAAA",
  error,
  className,
  minDate,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [dropPos, setDropPos] = React.useState<{ top: number; left: number } | null>(null);
  const [manualDay, setManualDay] = React.useState("");
  const [manualMonth, setManualMonth] = React.useState("");
  const [manualYear, setManualYear] = React.useState("");

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropRef = React.useRef<HTMLDivElement>(null);
  const monthRef = React.useRef<HTMLInputElement>(null);
  const yearRef = React.useRef<HTMLInputElement>(null);

  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const dateValid = date && isValid(date);

  // Sync manual inputs when value changes
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

  // Close on outside click — deux couches :
  // 1) Listener natif mousedown sur le portal div : stoppe la propagation avant
  //    d'atteindre le handler document. Cela couvre les clics sur les jours du
  //    calendrier ET les boutons de navigation (< >) même si react-day-picker
  //    retire le node du DOM avant que l'event remonte.
  // 2) Handler document : ne reçoit que les clics hors portal/trigger → ferme.
  React.useEffect(() => {
    if (!isOpen) return;
    const el = dropRef.current;
    if (!el) return;
    const stopInside = (e: MouseEvent) => e.stopPropagation();
    el.addEventListener("mousedown", stopInside);
    return () => el.removeEventListener("mousedown", stopInside);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      setDropPos({ top: r.bottom / zoom, left: r.left / zoom });
    }
    setIsOpen((v) => !v);
  };

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange(format(selectedDate, "yyyy-MM-dd"));
      setIsOpen(false);
    }
  };

  const tryApplyManual = (d: string, m: string, y: string) => {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const candidate = parse(`${y}-${m}-${d}`, "yyyy-MM-dd", new Date());
      if (isValid(candidate)) onChange(format(candidate, "yyyy-MM-dd"));
    }
  };

  const displayValue = dateValid ? format(date!, "dd/MM/yyyy", { locale: fr }) : "";

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex w-full items-center justify-between rounded-md border px-3 text-sm transition-all duration-150 h-9",
          "focus-visible:outline-none",
          isOpen
            ? "border-white/40 bg-white/[.07]"
            : "border-white/30 bg-white/[.04] hover:border-white/40 hover:bg-white/[.06]",
          error && "border-red-500",
          !value ? "text-foreground/40" : "text-foreground",
          className
        )}
      >
        <span className="truncate">{displayValue || placeholder}</span>
        <CalendarIcon
          className={cn(
            "w-3.5 h-3.5 shrink-0 transition-colors ml-1.5",
            isOpen ? "text-foreground/60" : "text-foreground/30"
          )}
        />
      </button>

      {/* Dropdown — portal pour alignement parfait */}
      {isOpen && dropPos &&
        createPortal(
          <div
            ref={dropRef}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: dropPos.top,
              left: dropPos.left,
              zIndex: 9999,
            }}
            className="rounded-xl border border-white/[.15] bg-[hsl(var(--card))] shadow-2xl shadow-black/70 overflow-hidden"
          >
            {/* Saisie manuelle */}
            <div className="px-3 pt-3 pb-2 border-b border-white/[.08]">
              <p className="text-[10px] uppercase tracking-widest font-bold text-foreground/30 mb-2">
                Saisie rapide
              </p>
              <div className="flex items-center gap-1">
                <Input
                  value={manualDay}
                  placeholder="JJ"
                  maxLength={2}
                  className="w-11 h-8 text-center text-xs font-mono px-1 border-white/20 bg-white/[.04]"
                  onChange={(e) => {
                    const c = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setManualDay(c);
                    if (c.length === 2) monthRef.current?.focus();
                    tryApplyManual(c, manualMonth, manualYear);
                  }}
                />
                <span className="text-foreground/30 text-xs">/</span>
                <Input
                  ref={monthRef}
                  value={manualMonth}
                  placeholder="MM"
                  maxLength={2}
                  className="w-11 h-8 text-center text-xs font-mono px-1 border-white/20 bg-white/[.04]"
                  onChange={(e) => {
                    const c = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setManualMonth(c);
                    if (c.length === 2) yearRef.current?.focus();
                    tryApplyManual(manualDay, c, manualYear);
                  }}
                />
                <span className="text-foreground/30 text-xs">/</span>
                <Input
                  ref={yearRef}
                  value={manualYear}
                  placeholder="AAAA"
                  maxLength={4}
                  className="w-16 h-8 text-center text-xs font-mono px-1 border-white/20 bg-white/[.04]"
                  onChange={(e) => {
                    const c = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setManualYear(c);
                    tryApplyManual(manualDay, manualMonth, c);
                  }}
                />
              </div>
            </div>

            {/* Calendrier */}
            <Calendar
              mode="single"
              selected={dateValid ? date : undefined}
              onSelect={handleSelect}
              locale={fr}
              className="p-3"
              disabled={minDate ? { before: parse(minDate, "yyyy-MM-dd", new Date()) } : undefined}
            />

            {/* Footer */}
            <div className="border-t border-white/[.08] p-1.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => { onChange(""); setIsOpen(false); }}
                className="flex-1 h-7 text-xs rounded-lg text-foreground/50 hover:text-foreground hover:bg-white/[.05] transition-all"
              >
                Effacer
              </button>
              <button
                type="button"
                onClick={() => { onChange(format(new Date(), "yyyy-MM-dd")); setIsOpen(false); }}
                className="flex-1 h-7 text-xs rounded-lg text-primary bg-primary/15 hover:bg-primary/25 transition-all font-medium"
              >
                Aujourd'hui
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
