import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2, Settings2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CustomizableMultiSelectProps {
  /** Comma-separated string of selected values */
  value: string;
  onChange: (value: string) => void;
  fixedOptions?: string[];
  customOptions: string[];
  variableType: string;
  placeholder?: string;
  onOptionsChanged: () => void;
  /** Compact mode: smaller trigger, settings icon barely visible until hover */
  compact?: boolean;
}

export const CustomizableMultiSelect = ({
  value,
  onChange,
  fixedOptions = [],
  customOptions,
  variableType,
  placeholder = "Sélectionner...",
  onOptionsChanged,
  compact = false,
}: CustomizableMultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const allOptions = [
    ...fixedOptions,
    ...customOptions.filter((o) => !fixedOptions.includes(o)),
  ];

  // Parse the comma-separated value into an array
  const selectedValues = value
    ? value.split(",").map((v) => v.trim()).filter(Boolean)
    : [];

  const toggleValue = (opt: string) => {
    let newSelected: string[];
    if (selectedValues.includes(opt)) {
      newSelected = selectedValues.filter((v) => v !== opt);
    } else {
      newSelected = [...selectedValues, opt];
    }
    onChange(newSelected.join(", "));
  };

  const removeValue = (opt: string) => {
    const newSelected = selectedValues.filter((v) => v !== opt);
    onChange(newSelected.join(", "));
  };

  const handleAddOption = async () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;

    if (allOptions.includes(trimmed)) {
      toast({ title: "Option existante", description: `"${trimmed}" existe déjà.`, variant: "destructive" });
      return;
    }

    setIsAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsAdding(false); return; }

    const { error } = await supabase.from("user_custom_variables").insert({
      user_id: user.id,
      variable_type: variableType,
      variable_value: trimmed,
    });

    setIsAdding(false);
    if (error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter l'option.", variant: "destructive" });
      return;
    }
    setNewValue("");
    onOptionsChanged();
    toast({ title: "Option ajoutée", description: `"${trimmed}" ajouté.` });
  };

  const handleDeleteOption = async (optionValue: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_custom_variables")
      .delete()
      .eq("user_id", user.id)
      .eq("variable_type", variableType)
      .eq("variable_value", optionValue);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer l'option.", variant: "destructive" });
      return;
    }

    if (selectedValues.includes(optionValue)) {
      removeValue(optionValue);
    }
    onOptionsChanged();
    toast({ title: "Option supprimée", description: `"${optionValue}" supprimé.` });
  };

  return (
    <div className="flex gap-1.5">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className={cn(
              "flex-1 h-auto justify-start text-left font-normal overflow-hidden",
              compact ? "min-h-8 text-xs" : "min-h-10",
              selectedValues.length === 0 && "text-muted-foreground"
            )}
          >
            {selectedValues.length > 0 ? (
              <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
                {selectedValues.map((v) => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 h-5 gap-0.5 max-w-[120px] shrink-0"
                  >
                    <span className="truncate">{v}</span>
                    <button
                      type="button"
                      className="ml-0.5 hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeValue(v);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 z-[100]" align="start" onWheel={(e) => e.stopPropagation()}>
          <div className="space-y-1 max-h-48 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
            {allOptions.length === 0 && (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                Aucune option. Cliquez sur ⚙ pour en ajouter.
              </div>
            )}
            {allOptions.map((opt) => {
              const isSelected = selectedValues.includes(opt);
              const isCustom = !fixedOptions.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-left",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                  onClick={() => toggleValue(opt)}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0",
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input"
                  )}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <span className="truncate flex-1">{opt}</span>
                  {isCustom && (
                    <span className="text-[10px] text-muted-foreground">(perso)</span>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Manage options popover */}
      <Popover open={isManaging} onOpenChange={setIsManaging}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon"
            className={cn("shrink-0 transition-opacity", compact ? "h-7 w-6 opacity-20 hover:opacity-80" : "h-10 w-10 opacity-50 hover:opacity-100")}
            title="Gérer les options">
            <Settings2 className={compact ? "w-3 h-3" : "w-4 h-4"} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 z-[100]" align="end" side="bottom" onWheel={(e) => e.stopPropagation()}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Gérer les options</p>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsManaging(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="flex gap-1.5">
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Nouvelle option..."
                className="h-8 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddOption(); } }}
              />
              <Button type="button" size="sm" className="h-8 px-2" onClick={handleAddOption} disabled={isAdding || !newValue.trim()}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {fixedOptions.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">Options fixes</p>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {fixedOptions.map((opt) => (
                    <div key={`manage-fixed-${opt}`} className="flex items-center justify-between px-2 py-1 rounded text-sm bg-muted/40">
                      <span className="truncate">{opt}</span>
                      <span className="text-[10px] text-muted-foreground">fixe</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">Vos options personnalisées</p>
              {customOptions.filter((o) => !fixedOptions.includes(o)).length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-2 py-1">Aucune option personnalisée</p>
              ) : (
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {customOptions.filter((o) => !fixedOptions.includes(o)).map((opt) => (
                    <div key={`manage-custom-${opt}`} className="flex items-center justify-between px-2 py-1 rounded text-sm group hover:bg-destructive/10 transition-colors">
                      <span className="truncate">{opt}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5 opacity-50 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive" onClick={() => handleDeleteOption(opt)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
