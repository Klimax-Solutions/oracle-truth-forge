import * as React from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

interface TimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

function formatTime(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 1) return d;
  if (d.length === 2) return d + ":";
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

function normalizeTime(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  const p = d.padEnd(4, "0").slice(0, 4);
  const hh = Math.min(parseInt(p.slice(0, 2), 10) || 0, 23).toString().padStart(2, "0");
  const mm = Math.min(parseInt(p.slice(2), 10) || 0, 59).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * TimeField — champ heure combinant saisie clavier HH:MM et sélecteur visuel.
 * Le dropdown s'ouvre via createPortal (position: fixed) pour un alignement
 * parfait quelle que soit la hiérarchie CSS (overflow, transform, dialog).
 */
export function TimeField({
  value,
  onChange,
  className,
  placeholder = "HH:MM",
}: TimeFieldProps) {
  const [local, setLocal] = React.useState(value || "");
  const [isOpen, setIsOpen] = React.useState(false);
  const [dropPos, setDropPos] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const dropRef = React.useRef<HTMLDivElement>(null);
  const hourScrollRef = React.useRef<HTMLDivElement>(null);
  const minScrollRef = React.useRef<HTMLDivElement>(null);

  const selHour = local.includes(":") ? local.split(":")[0] : "";
  const selMin = local.includes(":") ? (local.split(":")[1] ?? "").slice(0, 2) : "";

  // Sync prop → local
  React.useEffect(() => {
    setLocal(value || "");
  }, [value]);

  // Scroll picker columns into view when opening
  React.useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      const hi = HOURS.indexOf(selHour);
      const mi = MINUTES.indexOf(selMin);
      const itemH = 40;
      if (hourScrollRef.current && hi >= 0)
        hourScrollRef.current.scrollTop = Math.max(0, hi * itemH - 80);
      if (minScrollRef.current && mi >= 0)
        minScrollRef.current.scrollTop = Math.max(0, mi * itemH - 80);
    });
  }, [isOpen]); // intentionally exclude selHour/selMin — only on open

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
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

  const openPicker = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    setIsOpen(true);
  };

  const pickTime = (h: string, m: string) => {
    const v = `${h}:${m}`;
    setLocal(v);
    onChange(v);
    setIsOpen(false);
  };

  const clearTime = () => {
    setLocal("");
    onChange("");
    setIsOpen(false);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = formatTime(e.target.value);
    setLocal(f);
    if (/^\d{2}:\d{2}$/.test(f)) onChange(normalizeTime(f));
    else if (f === "") onChange("");
  };

  const handleBlur = () => {
    const n = normalizeTime(local);
    setLocal(n);
    if (n !== value) onChange(n);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const pass = [
      "Backspace", "Delete", "Tab",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "Home", "End",
    ];
    if (pass.includes(e.key)) return;
    if ((e.metaKey || e.ctrlKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return;
    if (!/^[0-9:]$/.test(e.key)) e.preventDefault();
  };

  return (
    <>
      {/* Trigger — wrapper border unique, input + clock comme un seul champ */}
      <div
        ref={wrapperRef}
        className={cn(
          "flex items-center rounded-md border transition-all duration-150",
          isOpen
            ? "border-white/40 bg-white/[.07]"
            : "border-white/30 bg-white/[.04] hover:border-white/40 hover:bg-white/[.06]",
          className
        )}
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={local}
          placeholder={placeholder}
          maxLength={5}
          onChange={handleInput}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="flex-1 h-full px-3 bg-transparent text-sm font-mono text-foreground placeholder:text-foreground/30 outline-none min-w-0"
        />
        <button
          type="button"
          onMouseDown={openPicker}
          tabIndex={-1}
          aria-label="Ouvrir le sélecteur d'heure"
          className="h-full px-2.5 flex items-center border-l border-white/[.08] text-foreground/30 hover:text-foreground/60 transition-colors shrink-0"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown — portal pour alignement parfait */}
      {isOpen && dropPos &&
        createPortal(
          <div
            ref={dropRef}
            style={{
              position: "fixed",
              top: dropPos.top,
              left: dropPos.left,
              width: Math.max(dropPos.width, 160),
              zIndex: 9999,
            }}
            className="rounded-xl border border-white/[.15] bg-[hsl(var(--card))] shadow-2xl shadow-black/70 overflow-hidden"
          >
            {/* Column headers */}
            <div className="flex border-b border-white/[.08]">
              <div className="flex-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-foreground/35 border-r border-white/[.08]">
                H
              </div>
              <div className="flex-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-foreground/35">
                MIN
              </div>
            </div>

            {/* Scroll columns */}
            <div className="flex h-[200px]">
              <div
                ref={hourScrollRef}
                className="flex-1 overflow-y-auto border-r border-white/[.08]"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => pickTime(h, selMin || "00")}
                    className={cn(
                      "w-full h-10 flex items-center justify-center text-sm font-mono transition-all",
                      selHour === h
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/70 hover:bg-white/[.06] hover:text-foreground"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <div
                ref={minScrollRef}
                className="flex-1 overflow-y-auto"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickTime(selHour || "00", m)}
                    className={cn(
                      "w-full h-10 flex items-center justify-center text-sm font-mono transition-all",
                      selMin === m
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/70 hover:bg-white/[.06] hover:text-foreground"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/[.08] p-1.5 flex gap-1.5">
              <button
                type="button"
                onClick={clearTime}
                className="flex-1 h-7 text-xs rounded-lg text-foreground/50 hover:text-foreground hover:bg-white/[.05] transition-all"
              >
                Effacer
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 h-7 text-xs rounded-lg text-primary bg-primary/15 hover:bg-primary/25 transition-all font-medium"
              >
                OK
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
