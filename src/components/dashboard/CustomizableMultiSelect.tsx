import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  /** compact: trigger h-9 instead of h-10 */
  compact?: boolean;
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
}: CustomizableMultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const allOptions = [
    ...fixedOptions,
    ...customOptions.filter((o) => !fixedOptions.includes(o)),
  ];

  const selectedValues = value
    ? value.split(",").map((v) => v.trim()).filter(Boolean)
    : [];

  const toggleValue = (opt: string) => {
    const newSelected = selectedValues.includes(opt)
      ? selectedValues.filter((v) => v !== opt)
      : [...selectedValues, opt];
    onChange(newSelected.join(", "));
  };

  const removeValue = (opt: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== opt).join(", "));
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
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setNewValue("");
      onOptionsChanged();
      toast({ title: "Option ajoutée", description: `"${trimmed}" ajouté.` });
    }
  };

  const handleDeleteOption = async (optionValue: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_custom_variables")
      .delete()
      .eq("user_id", user.id)
      .eq("variable_type", variableType)
      .eq("variable_value", optionValue);
    if (selectedValues.includes(optionValue)) {
      onChange(selectedValues.filter((v) => v !== optionValue).join(", "));
    }
    onOptionsChanged();
    toast({ title: "Option supprimée" });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {/* Styled exactly like an Input field */}
        <button
          type="button"
          className={cn(
            "flex w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm",
            "ring-offset-background transition-colors",
            "hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            compact ? "h-9 min-h-9" : "h-10 min-h-10",
            selectedValues.length === 0 && "text-muted-foreground"
          )}
        >
          {selectedValues.length > 0 ? (
            <div className="flex flex-wrap gap-1 flex-1 overflow-hidden min-w-0">
              {selectedValues.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-0.5 bg-primary/15 text-primary text-xs px-1.5 py-0.5 rounded font-medium"
                >
                  <span className="truncate max-w-[100px]">{v}</span>
                  <button
                    type="button"
                    onClick={(e) => removeValue(v, e)}
                    className="hover:text-destructive shrink-0 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className="flex-1 text-left truncate">{placeholder}</span>
          )}
          <ChevronDown className={cn(
            "ml-1 shrink-0 text-muted-foreground/60 transition-transform duration-150",
            "w-4 h-4",
            isOpen && "rotate-180"
          )} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-2 z-[100]" align="start" onWheel={(e) => e.stopPropagation()}>
        {/* Add custom option inline */}
        <div className="flex gap-1.5 mb-2">
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Nouvelle option…"
            className="h-8 text-xs"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddOption(); } }}
          />
          <Button type="button" size="sm" className="h-8 px-2 shrink-0" onClick={handleAddOption} disabled={isAdding || !newValue.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="h-px bg-border/40 mb-2" />
        {/* Options */}
        <div className="space-y-0.5 max-h-52 overflow-y-auto">
          {allOptions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3 italic">
              Tapez ci-dessus pour ajouter une option
            </p>
          )}
          {allOptions.map((opt) => {
            const isSelected = selectedValues.includes(opt);
            const isCustom = !fixedOptions.includes(opt);
            return (
              <div key={opt} className="flex items-center gap-1 group">
                <button
                  type="button"
                  className={cn(
                    "flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-left",
                    isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                  )}
                  onClick={() => toggleValue(opt)}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors",
                    isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                  )}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <span className="truncate flex-1">{opt}</span>
                  {isCustom && (
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">perso</span>
                  )}
                </button>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => handleDeleteOption(opt)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
