import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X, Check, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CustomizableMultiSelectProps {
  value: string;
  onChange: (value: string) => void;
  fixedOptions?: string[];
  customOptions: string[];
  variableType: string;
  placeholder?: string;
  onOptionsChanged: () => void;
  compact?: boolean;
  className?: string;
}

export const CustomizableMultiSelect = ({
  value,
  onChange,
  fixedOptions = [],
  customOptions,
  variableType,
  placeholder = "Sélectionner…",
  onOptionsChanged,
  compact = false,
  className,
}: CustomizableMultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const allOptions = [
    ...fixedOptions,
    ...customOptions.filter((o) => !fixedOptions.includes(o)),
  ];

  const selectedValues = value
    ? value.split(",").map((v) => v.trim()).filter(Boolean)
    : [];

  // ── Open / close ────────────────────────────────────────────
  const handleToggle = () => {
    if (!isOpen && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      // Compensate for html { zoom } which creates a gap between
      // getBoundingClientRect (visual/post-zoom) and position:fixed (layout/pre-zoom)
      const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      setDropdownPos({ top: r.bottom / zoom, left: r.left / zoom, width: r.width / zoom });
    }
    setIsOpen((v) => !v);
  };

  // Close on outside click (capture-phase stop above means this only fires for
  // clicks truly outside trigger + dropdown)
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  // Capture-phase on document: stop pointerdown/mousedown before Radix Dialog's
  // bubble-phase handler sees them. Capture fires before any node is removed
  // from DOM, making this reliable even with dynamic lists.
  useEffect(() => {
    if (!isOpen) return;
    const stop = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) e.stopPropagation();
    };
    document.addEventListener("pointerdown", stop, { capture: true });
    document.addEventListener("mousedown", stop, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", stop, { capture: true });
      document.removeEventListener("mousedown", stop, { capture: true });
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // ── Value helpers ────────────────────────────────────────────
  const toggleValue = (opt: string) => {
    const next = selectedValues.includes(opt)
      ? selectedValues.filter((v) => v !== opt)
      : [...selectedValues, opt];
    onChange(next.join(", "));
  };

  const removeValue = (opt: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== opt).join(", "));
  };

  // ── CRUD ─────────────────────────────────────────────────────
  const handleAdd = async () => {
    const trimmed = newValue.trim();
    if (!trimmed || allOptions.includes(trimmed)) return;
    setIsAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsAdding(false); return; }
    const { error } = await supabase.from("user_custom_variables").insert({
      user_id: user.id,
      variable_type: variableType,
      variable_value: trimmed,
    });
    setIsAdding(false);
    if (!error) { setNewValue(""); onOptionsChanged(); }
    else toast({ title: "Erreur", description: error.message, variant: "destructive" });
  };

  const handleDelete = async (opt: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_custom_variables")
      .delete().eq("user_id", user.id).eq("variable_type", variableType).eq("variable_value", opt);
    if (selectedValues.includes(opt))
      onChange(selectedValues.filter((v) => v !== opt).join(", "));
    onOptionsChanged();
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* Trigger — looks exactly like an Input */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex w-full items-center rounded-md border bg-white/[.04] px-3 py-2 text-sm transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
          compact ? "h-9" : "h-10",
          isOpen ? "border-white/40 bg-white/[.07]" : "border-white/25 hover:border-white/35 hover:bg-white/[.06]",
          selectedValues.length === 0 ? "text-foreground/40" : "text-foreground",
          className
        )}
      >
        {selectedValues.length > 0 ? (
          <div className="flex flex-wrap gap-1 flex-1 overflow-hidden min-w-0">
            {selectedValues.map((v) => (
              <span key={v} className="inline-flex items-center gap-0.5 bg-primary/20 text-primary text-[11px] px-1.5 py-0.5 rounded font-semibold">
                <span className="truncate max-w-[100px]">{v}</span>
                <button type="button" onClick={(e) => removeValue(v, e)} className="shrink-0 ml-0.5 opacity-60 hover:opacity-100 hover:text-destructive">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span className="flex-1 text-left truncate text-sm">{placeholder}</span>
        )}
        <ChevronDown className={cn(
          "ml-1.5 shrink-0 w-3.5 h-3.5 transition-all duration-200",
          isOpen ? "rotate-180 text-foreground/70" : "text-foreground/30"
        )} />
      </button>

      {/* Dropdown — rendered via portal for perfect positioning */}
      {isOpen && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className="rounded-xl border border-white/[.15] bg-[hsl(var(--card))] shadow-2xl shadow-black/70 overflow-hidden"
        >
          {/* Add option */}
          <div className="flex gap-1.5 p-2 border-b border-white/[.08]">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Ajouter une option…"
              className="h-8 text-xs border-white/[.15] bg-white/[.05] placeholder:text-foreground/30"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={isAdding || !newValue.trim()}
              className={cn(
                "h-8 w-8 shrink-0 rounded-md border border-white/[.15] flex items-center justify-center transition-all",
                newValue.trim() ? "bg-primary/80 hover:bg-primary text-primary-foreground border-primary/60" : "text-foreground/30 cursor-not-allowed"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Options */}
          <div className="max-h-56 overflow-y-auto py-1">
            {allOptions.length === 0 && (
              <p className="text-xs text-foreground/30 text-center py-4 italic">Tapez ci-dessus pour ajouter une option</p>
            )}
            {allOptions.map((opt) => {
              const isSelected = selectedValues.includes(opt);
              const isCustom = !fixedOptions.includes(opt);
              return (
                <div key={opt} className="flex items-center group px-1">
                  <button
                    type="button"
                    onClick={() => toggleValue(opt)}
                    className={cn(
                      "flex-1 flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all text-left",
                      isSelected
                        ? "bg-primary/15 text-primary"
                        : "text-foreground/80 hover:bg-white/[.06] hover:text-foreground"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                      isSelected ? "bg-primary border-primary" : "border-white/[.25] bg-transparent"
                    )}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <span className="truncate flex-1 font-medium text-[13px]">{opt}</span>
                    {isCustom && <span className="text-[10px] text-foreground/20 shrink-0 italic">perso</span>}
                  </button>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDelete(opt)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
