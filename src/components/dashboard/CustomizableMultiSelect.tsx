// ─────────────────────────────────────────────────────────────────────────────
// CustomizableMultiSelect — dropdown multi/mono sélection avec options gérables
//
// Architecture 3 couches (dans le marbre — 2026-04-29) :
//   fixedOptions   : hardcodées dans le code, non modifiables
//   globalOptions  : user_id IS NULL — admin gère, tous les users voient
//   personalOptions: user_id = auth.uid() — user gère, lui seul voit
//
// Comportement add :
//   - canManage=true  → confirmation inline → insère en global (user_id NULL)
//   - canManage=false → insère en perso (user_id = auth.uid()) sans confirmation
//
// Comportement delete :
//   - option globale  → canManage requis + confirmation inline
//   - option perso    → le user qui la possède peut la supprimer (pas de confirmation)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X, Check, AlertTriangle } from "lucide-react";
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
  customOptions,
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

  // ── États de confirmation (friction admin) ────────────────────────────────
  /** Option globale en attente de confirmation de suppression */
  const [pendingDeleteGlobal, setPendingDeleteGlobal] = useState<string | null>(null);
  /** Valeur en attente de confirmation d'ajout partagé */
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);

  const { toast } = useToast();

  const resolvedGlobalOptions = globalOptions ?? customOptions ?? [];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Reset confirmations quand on ferme
  useEffect(() => {
    if (!isOpen) {
      setPendingDeleteGlobal(null);
      setPendingAdd(null);
      setNewValue("");
    }
  }, [isOpen]);

  // ── Construire la liste ───────────────────────────────────────────────────
  const globalUniq   = resolvedGlobalOptions.filter(o => !fixedOptions.includes(o));
  const personalUniq = personalOptions.filter(
    o => !fixedOptions.includes(o) && !resolvedGlobalOptions.includes(o),
  );
  const allOptions = [...fixedOptions, ...globalUniq, ...personalUniq];

  const selectedValues = value
    ? value.split(",").map((v) => v.trim()).filter(Boolean)
    : [];

  const isGlobal = (opt: string) =>
    resolvedGlobalOptions.includes(opt) && !fixedOptions.includes(opt);

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
  const handleAddIntent = () => {
    const trimmed = newValue.trim();
    if (!trimmed || allOptions.includes(trimmed)) return;
    if (canManage) {
      // Admin : demander confirmation avant d'ajouter en partagé
      setPendingAdd(trimmed);
    } else {
      // User : ajout perso direct, sans friction
      commitAdd(trimmed);
    }
  };

  const commitAdd = async (val: string) => {
    setIsAdding(true);
    const insertData = canManage
      ? { variable_type: variableType, variable_value: val }
      : { variable_type: variableType, variable_value: val, user_id: currentUserId };

    const { error } = await supabase
      .from("user_custom_variables")
      .insert(insertData as any);

    setIsAdding(false);
    setPendingAdd(null);
    if (!error) {
      setNewValue("");
      onOptionsChanged();
    } else {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  // ── Suppression option partagée — avec confirmation ────────────────────────
  const handleDeleteGlobalConfirmed = async (opt: string) => {
    if (!canManage) return;
    await supabase
      .from("user_custom_variables")
      .delete()
      .is("user_id", null)
      .eq("variable_type", variableType)
      .eq("variable_value", opt);
    if (selectedValues.includes(opt))
      onChange(selectedValues.filter((v) => v !== opt).join(", "));
    setPendingDeleteGlobal(null);
    onOptionsChanged();
  };

  // ── Suppression option personnelle ────────────────────────────────────────
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

  // ── Render option ────────────────────────────────────────────────────────
  const renderOption = (opt: string, optIsPersonal: boolean) => {
    const isSelected          = selectedValues.includes(opt);
    const optIsActuallyGlobal = isGlobal(opt);
    const canDeleteThis       = (optIsActuallyGlobal && canManage) || optIsPersonal;

    // Confirmation suppression globale — inline dans la row
    if (pendingDeleteGlobal === opt) {
      return (
        <div key={opt} className="mx-1 mb-0.5 flex items-center gap-1.5 px-2 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="w-3 h-3 text-destructive/70 shrink-0" />
          <span className="text-[11px] text-destructive/80 flex-1 truncate">Supprimer "{opt}" ?</span>
          <button
            type="button"
            onClick={() => handleDeleteGlobalConfirmed(opt)}
            className="text-[10px] font-bold text-destructive px-2 py-0.5 rounded bg-destructive/20 hover:bg-destructive/35 transition-colors shrink-0"
          >
            Oui
          </button>
          <button
            type="button"
            onClick={() => setPendingDeleteGlobal(null)}
            className="text-[10px] text-foreground/40 px-2 py-0.5 rounded hover:bg-white/[.06] transition-colors shrink-0"
          >
            Non
          </button>
        </div>
      );
    }

    return (
      <div key={opt} className="flex items-center group">
        <button
          type="button"
          onClick={() => handleSelect(opt)}
          className={cn(
            "flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all text-left",
            isSelected
              ? optIsPersonal ? "bg-violet-500/15 text-violet-300" : "bg-primary/15 text-primary"
              : "text-foreground/80 hover:bg-white/[.06] hover:text-foreground",
          )}
        >
          {singleSelect ? (
            <div className={cn(
              "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all",
              isSelected
                ? optIsPersonal ? "bg-violet-500 border-violet-500" : "bg-primary border-primary"
                : "border-white/[.25] bg-transparent",
            )}>
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
            </div>
          ) : (
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
              isSelected
                ? optIsPersonal ? "bg-violet-500 border-violet-500" : "bg-primary border-primary"
                : "border-white/[.25] bg-transparent",
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
            onClick={() =>
              optIsActuallyGlobal
                ? setPendingDeleteGlobal(opt)   // demande confirmation
                : handleDeletePersonal(opt)      // perso : direct
            }
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all shrink-0 mr-1"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
            maxWidth: "280px",
          }}
          className="z-[9999] flex flex-col rounded-xl border border-white/[.15] bg-[hsl(var(--card))] shadow-2xl shadow-black/70 p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* ── Champ d'ajout (fixe en haut) ── */}
          <div className="shrink-0 p-2 border-b border-white/[.08]">
            {pendingAdd ? (
              /* Confirmation ajout partagé */
              <div className="flex flex-col gap-2 px-1 py-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                  <span className="text-[11px] text-foreground/70 leading-snug">
                    Ajouter <span className="font-semibold text-foreground">"{pendingAdd}"</span> pour tous les utilisateurs ?
                  </span>
                </div>
                <div className="flex gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => setPendingAdd(null)}
                    className="text-[11px] px-2.5 py-1 rounded-md border border-white/[.12] text-foreground/50 hover:text-foreground hover:bg-white/[.05] transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => commitAdd(pendingAdd)}
                    disabled={isAdding}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-primary/80 hover:bg-primary text-primary-foreground transition-all disabled:opacity-50"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={canManage ? "Ajouter une option partagée…" : "Ajouter une option perso…"}
                  className="h-8 text-xs border-white/[.15] bg-white/[.05] placeholder:text-foreground/30"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddIntent(); } }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddIntent}
                  disabled={isAdding || !newValue.trim()}
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-md border border-white/[.15] flex items-center justify-center transition-all",
                    newValue.trim()
                      ? "bg-primary/80 hover:bg-primary text-primary-foreground border-primary/60"
                      : "text-foreground/30 cursor-not-allowed",
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* ── Liste scrollable ── */}
          <div className="overflow-y-auto flex-1 p-1.5 space-y-1.5" style={{ maxHeight: "240px" }}>
            {allOptions.length === 0 && (
              <p className="text-xs text-foreground/30 text-center py-4 italic">
                Tapez ci-dessus pour ajouter une option
              </p>
            )}

            {/* Groupe 1 — options partagées */}
            {(fixedOptions.length > 0 || globalUniq.length > 0) && (
              <div className="rounded-lg border border-white/[.07] bg-white/[.025] overflow-hidden">
                <div className="px-2.5 pt-2 pb-1">
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/35">
                    Options partagées
                  </span>
                </div>
                <div className="pb-1">
                  {[...fixedOptions, ...globalUniq].map((opt) => renderOption(opt, false))}
                </div>
              </div>
            )}

            {/* Groupe 2 — options personnelles */}
            {personalUniq.length > 0 && (
              <div className="rounded-lg border border-violet-500/[.18] bg-violet-500/[.04] overflow-hidden">
                <div className="px-2.5 pt-2 pb-1">
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-violet-400/70">
                    Mes options
                  </span>
                </div>
                <div className="pb-1">
                  {personalUniq.map((opt) => renderOption(opt, true))}
                </div>
              </div>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
