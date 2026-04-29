// ─────────────────────────────────────────────────────────────────────────────
// CustomizableMultiSelect — dropdown multi/mono sélection avec options gérables
//
// Architecture 3 couches (dans le marbre — 2026-04-29) :
//   fixedOptions   : hardcodées dans le code, non modifiables
//   globalOptions  : user_id IS NULL — admin gère, tous les users voient
//   personalOptions: user_id = auth.uid() — user gère, lui seul voit
//
// Comportement add :
//   - canManage=true  → insère en global  (user_id NULL)
//   - canManage=false → insère en perso   (user_id = auth.uid())
//
// Comportement delete :
//   - option globale  → canManage requis
//   - option perso    → le user qui la possède peut la supprimer
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CustomizableMultiSelectProps {
  value: string;
  onChange: (value: string) => void;
  fixedOptions?: string[];
  /** Options partagées — admin gère, tous voient */
  globalOptions?: string[];
  /** Options personnelles — user gère, lui seul voit */
  personalOptions?: string[];
  /** @deprecated Alias de globalOptions (backward compat) */
  customOptions?: string[];
  variableType: string;
  placeholder?: string;
  onOptionsChanged: () => void;
  compact?: boolean;
  className?: string;
  /** Si true : choix unique, ferme automatiquement après sélection */
  singleSelect?: boolean;
  /**
   * Si true : l'utilisateur peut gérer les options PARTAGÉES (admin uniquement).
   * Tous les users authentifiés peuvent toujours gérer leurs options personnelles.
   */
  canManage?: boolean;
}

export const CustomizableMultiSelect = ({
  value,
  onChange,
  fixedOptions = [],
  globalOptions,
  personalOptions = [],
  customOptions,         // backward compat
  variableType,
  placeholder = "Sélectionner…",
  onOptionsChanged,
  compact = false,
  className,
  singleSelect = false,
  canManage = false,
}: CustomizableMultiSelectProps) => {
  const [isOpen, setIsOpen]         = useState(false);
  const [newValue, setNewValue]     = useState("");
  const [isAdding, setIsAdding]     = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // Résoudre globalOptions (backward compat avec customOptions)
  const resolvedGlobalOptions = globalOptions ?? customOptions ?? [];

  // Récupérer l'uid une seule fois au montage
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // ── Construire la liste complète ─────────────────────────────────────────────
  // Ordre : fixes → partagées → personnelles (sans doublons)
  const globalUniq   = resolvedGlobalOptions.filter(o => !fixedOptions.includes(o));
  const personalUniq = personalOptions.filter(
    o => !fixedOptions.includes(o) && !resolvedGlobalOptions.includes(o),
  );
  const allOptions = [...fixedOptions, ...globalUniq, ...personalUniq];

  const selectedValues = value
    ? value.split(",").map((v) => v.trim()).filter(Boolean)
    : [];

  // ── Catégoriser chaque option ──────────────────────────────────────────────
  const isPersonal = (opt: string) => personalOptions.includes(opt) && !fixedOptions.includes(opt);
  const isGlobal   = (opt: string) => resolvedGlobalOptions.includes(opt) && !fixedOptions.includes(opt);

  // ── Sélection ─────────────────────────────────────────────────────────────
  const handleSelect = (opt: string) => {
    if (singleSelect) {
      const next = selectedValues.includes(opt) ? "" : opt;
      onChange(next);
      if (!selectedValues.includes(opt)) setIsOpen(false);
    } else {
      const next = selectedValues.includes(opt)
        ? selectedValues.filter((v) => v !== opt)
        : [...selectedValues, opt];
      onChange(next.join(", "));
    }
  };

  const removeValue = (opt: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== opt).join(", "));
  };

  // ── Ajout ─────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const trimmed = newValue.trim();
    if (!trimmed || allOptions.includes(trimmed)) return;
    setIsAdding(true);

    // Admin → global (pas de user_id) ; user → personnel (user_id = auth.uid())
    const insertData = canManage
      ? { variable_type: variableType, variable_value: trimmed }
      : { variable_type: variableType, variable_value: trimmed, user_id: currentUserId };

    const { error } = await supabase
      .from("user_custom_variables")
      .insert(insertData as any);

    setIsAdding(false);
    if (!error) {
      setNewValue("");
      onOptionsChanged();
    } else {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  // ── Suppression option partagée (admin requis) ─────────────────────────────
  const handleDeleteGlobal = async (opt: string) => {
    if (!canManage) return;
    await supabase
      .from("user_custom_variables")
      .delete()
      .is("user_id", null)
      .eq("variable_type", variableType)
      .eq("variable_value", opt);
    if (selectedValues.includes(opt))
      onChange(selectedValues.filter((v) => v !== opt).join(", "));
    onOptionsChanged();
  };

  // ── Suppression option personnelle (user requis) ───────────────────────────
  const handleDeletePersonal = async (opt: string) => {
    if (!currentUserId) return;
    await supabase
      .from("user_custom_variables")
      .delete()
      .eq("user_id", currentUserId)
      .eq("variable_type", variableType)
      .eq("variable_value", opt);
    if (selectedValues.includes(opt))
      onChange(selectedValues.filter((v) => v !== opt).join(", "));
    onOptionsChanged();
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderOption = (opt: string, _optIsGlobal: boolean, optIsPersonal: boolean) => {
    const isSelected    = selectedValues.includes(opt);
    const optIsFixed    = fixedOptions.includes(opt);
    const optIsActuallyGlobal = isGlobal(opt);
    const canDeleteThis = (optIsActuallyGlobal && canManage) || optIsPersonal;

    return (
      <div key={opt} className="flex items-center group px-1">
        <button
          type="button"
          onClick={() => handleSelect(opt)}
          className={cn(
            "flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all text-left",
            isSelected
              ? "bg-primary/15 text-primary"
              : "text-foreground/80 hover:bg-white/[.06] hover:text-foreground",
          )}
        >
          {singleSelect ? (
            <div className={cn(
              "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all",
              isSelected ? "bg-primary border-primary" : "border-white/[.25] bg-transparent",
            )}>
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
            </div>
          ) : (
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
              isSelected ? "bg-primary border-primary" : "border-white/[.25] bg-transparent",
            )}>
              {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
            </div>
          )}
          <span className={cn(
            "truncate flex-1 font-medium text-[13px] whitespace-nowrap",
            optIsPersonal && "text-violet-300/90",
          )}>
            {opt}
          </span>
        </button>

        {canDeleteThis && (
          <button
            type="button"
            onClick={() => optIsActuallyGlobal
              ? handleDeleteGlobal(opt)
              : handleDeletePersonal(opt)
            }
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center rounded-md border bg-white/[.04] px-3 py-2 text-sm transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
            compact ? "h-9" : "h-10",
            isOpen ? "border-white/40 bg-white/[.07]" : "border-white/25 hover:border-white/35 hover:bg-white/[.06]",
            selectedValues.length === 0 ? "text-foreground/40" : "text-foreground",
            className,
          )}
        >
          {selectedValues.length > 0 ? (
            singleSelect ? (
              <span className="flex-1 text-left truncate text-sm font-medium">
                {selectedValues[0]}
              </span>
            ) : (
              <div className="flex flex-wrap gap-1 flex-1 overflow-hidden min-w-0">
                {selectedValues.map((v) => (
                  <span key={v} className="inline-flex items-center gap-0.5 bg-primary/20 text-primary text-[11px] px-1.5 py-0.5 rounded font-semibold">
                    <span className="truncate max-w-[100px]">{v}</span>
                    <button
                      type="button"
                      onClick={(e) => removeValue(v, e)}
                      className="shrink-0 ml-0.5 opacity-60 hover:opacity-100 hover:text-destructive"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )
          ) : (
            <span className="flex-1 text-left truncate text-sm">{placeholder}</span>
          )}
          <svg
            className={cn(
              "ml-1.5 shrink-0 w-3.5 h-3.5 transition-all duration-200",
              isOpen ? "rotate-180 text-foreground/70" : "text-foreground/30",
            )}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          style={{
            minWidth: "var(--radix-popover-trigger-width)",
            maxWidth: "260px",
          }}
          className="z-[9999] rounded-xl border border-white/[.15] bg-[hsl(var(--card))] shadow-2xl shadow-black/70 overflow-hidden p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* ── Champ d'ajout — visible par tous ── */}
          <div className="flex gap-1.5 p-2 border-b border-white/[.08]">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={canManage ? "Ajouter une option partagée…" : "Ajouter une option perso…"}
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
                newValue.trim() ? "bg-primary/80 hover:bg-primary text-primary-foreground border-primary/60" : "text-foreground/30 cursor-not-allowed",
              )}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Liste des options ── */}
          <div className="max-h-56 overflow-y-auto py-1">
            {allOptions.length === 0 && (
              <p className="text-xs text-foreground/30 text-center py-4 italic">
                Tapez ci-dessus pour ajouter une option
              </p>
            )}

            {/* Groupe 1 — options partagées (admin) */}
            {(fixedOptions.length > 0 || globalUniq.length > 0) && (
              <>
                <div className="flex items-center gap-2 px-3 pt-1.5 pb-1">
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/30">
                    Options partagées
                  </span>
                  <div className="flex-1 h-px bg-white/[.06]" />
                </div>
                {[...fixedOptions, ...globalUniq].map((opt) => renderOption(opt, false, false))}
              </>
            )}

            {/* Groupe 2 — options personnelles */}
            {personalUniq.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-violet-400/60">
                    Mes options
                  </span>
                  <div className="flex-1 h-px bg-violet-500/[.12]" />
                </div>
                {personalUniq.map((opt) => renderOption(opt, false, true))}
              </>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
