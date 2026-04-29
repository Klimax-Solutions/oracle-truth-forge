// ─────────────────────────────────────────────────────────────────────────────
// CustomizableMultiSelect — dropdown multi/mono sélection avec options gérables
//
// Architecture 3 couches (dans le marbre — 2026-04-29) :
//   fixedOptions   : hardcodées dans le code, non modifiables
//   globalOptions  : user_id IS NULL — admin gère, tous les users voient
//   personalOptions: user_id = auth.uid() — user gère, lui seul voit
//
// Champ d'ajout du haut → TOUJOURS personnel (pour tous, admin inclus)
// Admin add-on → petit "+" dans la card "Options partagées" → mini-input inline
//               avec confirmation avant insertion globale
//
// Comportement delete :
//   - option globale  → canManage requis + confirmation inline
//   - option perso    → le user qui la possède peut la supprimer (pas de confirmation)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X, Check, AlertTriangle, Settings2 } from "lucide-react";
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ── Ajout personnel (champ du haut — tout le monde) ──────────────────────
  const [newPersonalValue, setNewPersonalValue] = useState("");
  const [isAddingPersonal, setIsAddingPersonal] = useState(false);

  // ── Ajout partagé (admin add-on — dans la card "Options partagées") ───────
  const [showSharedInput, setShowSharedInput]   = useState(false);
  const [newSharedValue, setNewSharedValue]     = useState("");
  const [pendingAddShared, setPendingAddShared] = useState<string | null>(null);
  const [isAddingShared, setIsAddingShared]     = useState(false);

  // ── Confirmation suppression globale ─────────────────────────────────────
  const [pendingDeleteGlobal, setPendingDeleteGlobal] = useState<string | null>(null);

  const { toast } = useToast();

  const resolvedGlobalOptions = globalOptions ?? customOptions ?? [];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Reset tout quand on ferme
  useEffect(() => {
    if (!isOpen) {
      setNewPersonalValue("");
      setNewSharedValue("");
      setShowSharedInput(false);
      setPendingAddShared(null);
      setPendingDeleteGlobal(null);
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

  // ── Ajout personnel — pour tous (admin inclus) ────────────────────────────
  const handleAddPersonal = async () => {
    const trimmed = newPersonalValue.trim();
    if (!trimmed || allOptions.includes(trimmed)) return;
    setIsAddingPersonal(true);
    const { error } = await supabase
      .from("user_custom_variables")
      .insert({ variable_type: variableType, variable_value: trimmed, user_id: currentUserId } as any);
    setIsAddingPersonal(false);
    if (!error) {
      setNewPersonalValue("");
      onOptionsChanged();
    } else {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  // ── Ajout partagé — admin seulement, avec confirmation ────────────────────
  const handleSharedAddIntent = () => {
    const trimmed = newSharedValue.trim();
    if (!trimmed || allOptions.includes(trimmed)) return;
    setPendingAddShared(trimmed);
  };

  const commitAddShared = async () => {
    if (!pendingAddShared || !canManage) return;
    setIsAddingShared(true);
    const { error } = await supabase
      .from("user_custom_variables")
      .insert({ variable_type: variableType, variable_value: pendingAddShared } as any);
    setIsAddingShared(false);
    setPendingAddShared(null);
    if (!error) {
      setNewSharedValue("");
      setShowSharedInput(false);
      onOptionsChanged();
    } else {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  // ── Suppression option partagée — avec confirmation ───────────────────────
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

  // ── Render option ─────────────────────────────────────────────────────────
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
                ? setPendingDeleteGlobal(opt)
                : handleDeletePersonal(opt)
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
            maxHeight: "360px",
          }}
          className="z-[9999] flex flex-col rounded-xl border border-white/[.15] bg-[hsl(var(--card))] shadow-2xl shadow-black/70 p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* ── Champ d'ajout personnel — identique pour tous (admin inclus) ── */}
          <div className="shrink-0 p-2 border-b border-white/[.08]">
            <div className="flex gap-1.5">
              <Input
                value={newPersonalValue}
                onChange={(e) => setNewPersonalValue(e.target.value)}
                placeholder="Ajouter une option perso…"
                className="h-8 text-xs border-white/[.15] bg-white/[.05] placeholder:text-foreground/30"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddPersonal(); } }}
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddPersonal}
                disabled={isAddingPersonal || !newPersonalValue.trim()}
                className={cn(
                  "h-8 w-8 shrink-0 rounded-md border border-white/[.15] flex items-center justify-center transition-all",
                  newPersonalValue.trim()
                    ? "bg-primary/80 hover:bg-primary text-primary-foreground border-primary/60"
                    : "text-foreground/30 cursor-not-allowed",
                )}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Liste scrollable ── */}
          <div
            className="overflow-y-auto min-h-0 flex-1 p-1.5 space-y-1.5"
            onWheel={(e) => e.stopPropagation()}
          >
            {allOptions.length === 0 && (
              <p className="text-xs text-foreground/30 text-center py-4 italic">
                Tapez ci-dessus pour ajouter une option
              </p>
            )}

            {/* Groupe 1 — options partagées */}
            {(fixedOptions.length > 0 || globalUniq.length > 0) && (
              <div className="rounded-lg border border-white/[.07] bg-white/[.025] overflow-hidden">
                {/* Header card — admin add-on : icône Settings2 */}
                <div className="px-2.5 pt-2 pb-1 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/35">
                    Options partagées
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => { setShowSharedInput(v => !v); setPendingAddShared(null); setNewSharedValue(""); }}
                      title="Gérer les options partagées (admin)"
                      className={cn(
                        "p-1 rounded transition-all",
                        showSharedInput
                          ? "text-primary bg-primary/10"
                          : "text-foreground/25 hover:text-foreground/60 hover:bg-white/[.06]",
                      )}
                    >
                      <Settings2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Mini-input admin — visible uniquement si showSharedInput */}
                {canManage && showSharedInput && (
                  <div className="px-1.5 pb-1.5">
                    {pendingAddShared ? (
                      /* Confirmation */
                      <div className="flex flex-col gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/[.07] border border-amber-500/20">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400/80 shrink-0" />
                          <span className="text-[10px] text-foreground/70 leading-snug">
                            Ajouter <span className="font-semibold text-foreground">"{pendingAddShared}"</span> pour tous ?
                          </span>
                        </div>
                        <div className="flex gap-1 justify-end">
                          <button type="button" onClick={() => setPendingAddShared(null)}
                            className="text-[10px] px-2 py-0.5 rounded border border-white/[.12] text-foreground/50 hover:text-foreground transition-all">
                            Annuler
                          </button>
                          <button type="button" onClick={commitAddShared} disabled={isAddingShared}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/80 hover:bg-primary text-primary-foreground transition-all disabled:opacity-50">
                            Confirmer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Input
                          value={newSharedValue}
                          onChange={(e) => setNewSharedValue(e.target.value)}
                          placeholder="Nouvelle option partagée…"
                          className="h-7 text-[11px] border-white/[.12] bg-white/[.04] placeholder:text-foreground/25"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSharedAddIntent(); } }}
                        />
                        <button
                          type="button"
                          onClick={handleSharedAddIntent}
                          disabled={!newSharedValue.trim()}
                          className={cn(
                            "h-7 w-7 shrink-0 rounded border flex items-center justify-center transition-all",
                            newSharedValue.trim()
                              ? "bg-primary/70 hover:bg-primary text-primary-foreground border-primary/50"
                              : "text-foreground/25 border-white/[.10] cursor-not-allowed",
                          )}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

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
