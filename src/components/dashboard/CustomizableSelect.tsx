import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2, Settings2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CustomizableSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Fixed (non-deletable) options */
  fixedOptions?: string[];
  /** User-created custom options from the database */
  customOptions: string[];
  /** The variable_type key for user_custom_variables table */
  variableType: string;
  placeholder?: string;
  /** Callback after adding/deleting to refresh variables */
  onOptionsChanged: () => void;
}

export const CustomizableSelect = ({
  value,
  onChange,
  fixedOptions = [],
  customOptions,
  variableType,
  placeholder = "Sélectionner...",
  onOptionsChanged,
}: CustomizableSelectProps) => {
  const [isManaging, setIsManaging] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const allOptions = [
    ...fixedOptions,
    ...customOptions.filter((o) => !fixedOptions.includes(o)),
  ];

  const handleAddOption = async () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;

    if (allOptions.includes(trimmed)) {
      toast({
        title: "Option existante",
        description: `"${trimmed}" existe déjà.`,
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsAdding(false);
      return;
    }

    const { error } = await supabase.from("user_custom_variables").insert({
      user_id: user.id,
      variable_type: variableType,
      variable_value: trimmed,
    });

    setIsAdding(false);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'option.",
        variant: "destructive",
      });
      return;
    }

    setNewValue("");
    onOptionsChanged();
    toast({ title: "Option ajoutée", description: `"${trimmed}" ajouté.` });
  };

  const handleDeleteOption = async (optionValue: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_custom_variables")
      .delete()
      .eq("user_id", user.id)
      .eq("variable_type", variableType)
      .eq("variable_value", optionValue);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'option.",
        variant: "destructive",
      });
      return;
    }

    // If the deleted option was selected, clear the value
    if (value === optionValue) {
      onChange("");
    }

    onOptionsChanged();
    toast({
      title: "Option supprimée",
      description: `"${optionValue}" supprimé.`,
    });
  };

  return (
    <div className="flex gap-1.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allOptions.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              Aucune option. Cliquez sur ⚙ pour en ajouter.
            </div>
          )}
          {fixedOptions.map((opt) => (
            <SelectItem key={`fixed-${opt}`} value={opt}>
              {opt}
            </SelectItem>
          ))}
          {customOptions
            .filter((o) => !fixedOptions.includes(o))
            .map((opt) => (
              <SelectItem key={`custom-${opt}`} value={opt}>
                <span className="flex items-center gap-1">
                  {opt}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    (perso)
                  </span>
                </span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Popover open={isManaging} onOpenChange={setIsManaging}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            title="Gérer les options"
          >
            <Settings2 className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-3"
          align="end"
          side="bottom"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Gérer les options</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsManaging(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Add new option */}
            <div className="flex gap-1.5">
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Nouvelle option..."
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddOption();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                className="h-8 px-2"
                onClick={handleAddOption}
                disabled={isAdding || !newValue.trim()}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Fixed options (non-deletable) */}
            {fixedOptions.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                  Options fixes
                </p>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {fixedOptions.map((opt) => (
                    <div
                      key={`manage-fixed-${opt}`}
                      className="flex items-center justify-between px-2 py-1 rounded text-sm bg-muted/40"
                    >
                      <span className="truncate">{opt}</span>
                      <span className="text-[10px] text-muted-foreground">
                        fixe
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom options (deletable) */}
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                Vos options personnalisées
              </p>
              {customOptions.filter((o) => !fixedOptions.includes(o)).length ===
              0 ? (
                <p className="text-xs text-muted-foreground italic px-2 py-1">
                  Aucune option personnalisée
                </p>
              ) : (
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {customOptions
                    .filter((o) => !fixedOptions.includes(o))
                    .map((opt) => (
                      <div
                        key={`manage-custom-${opt}`}
                        className="flex items-center justify-between px-2 py-1 rounded text-sm group hover:bg-destructive/10 transition-colors"
                      >
                        <span className="truncate">{opt}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-50 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
                          onClick={() => handleDeleteOption(opt)}
                        >
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
