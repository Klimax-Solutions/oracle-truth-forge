import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Settings2, Tag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CustomVariable {
  id: string;
  variable_type: string;
  variable_value: string;
}

interface CustomVariableType {
  id: string;
  type_key: string;
  type_label: string;
}

const DEFAULT_VARIABLE_TYPES = [
  { value: "direction_structure", label: "Structure" },
  { value: "setup_type", label: "Type de Setup" },
  { value: "entry_model", label: "Modèle d'entrée" },
  { value: "entry_timing", label: "Entry Timing" },
];

interface CustomVariablesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  suggestedVariables?: { type: string; values: string[] }[];
  onSuggestionsProcessed?: () => void;
}

export const CustomVariablesDialog = ({ 
  isOpen, 
  onClose, 
  suggestedVariables = [],
  onSuggestionsProcessed 
}: CustomVariablesDialogProps) => {
  const [variables, setVariables] = useState<CustomVariable[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomVariableType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newVariableType, setNewVariableType] = useState<string>("");
  const [newVariableValue, setNewVariableValue] = useState("");
  const [showNewTypeForm, setShowNewTypeForm] = useState(false);
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [savingType, setSavingType] = useState(false);
  const { toast } = useToast();

  // Combine default types with custom types
  const allVariableTypes = [
    ...DEFAULT_VARIABLE_TYPES,
    ...customTypes.map(t => ({ value: t.type_key, label: t.type_label, isCustom: true }))
  ];

  useEffect(() => {
    if (isOpen) {
      fetchVariables();
      fetchCustomTypes();
    }
  }, [isOpen]);

  const fetchVariables = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("user_custom_variables")
      .select("*")
      .eq("user_id", user.id)
      .order("variable_type", { ascending: true })
      .order("variable_value", { ascending: true });

    if (data) {
      setVariables(data);
    }
    setLoading(false);
  };

  const fetchCustomTypes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_variable_types")
      .select("*")
      .eq("user_id", user.id)
      .order("type_label", { ascending: true });

    if (data) {
      setCustomTypes(data);
    }
  };

  const handleAddVariable = async () => {
    if (!newVariableType || !newVariableValue.trim()) {
      toast({
        title: "Champs requis",
        description: "Veuillez sélectionner un type et entrer une valeur.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from("user_custom_variables")
      .insert({
        user_id: user.id,
        variable_type: newVariableType,
        variable_value: newVariableValue.trim(),
      });

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Variable existante",
          description: "Cette variable existe déjà.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible d'ajouter la variable.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Variable ajoutée",
        description: `"${newVariableValue}" ajoutée avec succès.`,
      });
      setNewVariableValue("");
      fetchVariables();
    }
    setSaving(false);
  };

  const handleAddNewType = async () => {
    if (!newTypeKey.trim() || !newTypeLabel.trim()) {
      toast({
        title: "Champs requis",
        description: "Veuillez entrer une clé et un label pour le nouveau type.",
        variant: "destructive",
      });
      return;
    }

    // Check if key already exists in default types
    const keyNormalized = newTypeKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (DEFAULT_VARIABLE_TYPES.some(t => t.value === keyNormalized)) {
      toast({
        title: "Type existant",
        description: "Ce type de variable existe déjà par défaut.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSavingType(true);
    const { error } = await supabase
      .from("user_variable_types")
      .insert({
        user_id: user.id,
        type_key: keyNormalized,
        type_label: newTypeLabel.trim(),
      });

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Type existant",
          description: "Ce type de variable existe déjà.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de créer le type de variable.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Type créé",
        description: `Le type "${newTypeLabel}" a été créé avec succès.`,
      });
      setNewTypeKey("");
      setNewTypeLabel("");
      setShowNewTypeForm(false);
      fetchCustomTypes();
    }
    setSavingType(false);
  };

  const handleDeleteVariable = async (id: string) => {
    const { error } = await supabase
      .from("user_custom_variables")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la variable.",
        variant: "destructive",
      });
    } else {
      setVariables(variables.filter(v => v.id !== id));
      toast({
        title: "Variable supprimée",
      });
    }
  };

  const handleDeleteType = async (id: string, typeKey: string) => {
    // First delete all variables of this type
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("user_custom_variables")
      .delete()
      .eq("user_id", user.id)
      .eq("variable_type", typeKey);

    const { error } = await supabase
      .from("user_variable_types")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le type.",
        variant: "destructive",
      });
    } else {
      setCustomTypes(customTypes.filter(t => t.id !== id));
      setVariables(variables.filter(v => v.variable_type !== typeKey));
      toast({
        title: "Type supprimé",
      });
    }
  };

  const handleAddSuggestedVariable = async (type: string, value: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_custom_variables")
      .insert({
        user_id: user.id,
        variable_type: type,
        variable_value: value,
      });

    if (!error) {
      toast({
        title: "Variable ajoutée",
        description: `"${value}" ajoutée avec succès.`,
      });
      fetchVariables();
    }
  };

  const handleAddAllSuggestions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    let addedCount = 0;

    for (const suggestion of suggestedVariables) {
      for (const value of suggestion.values) {
        // Check if already exists
        const exists = variables.some(
          v => v.variable_type === suggestion.type && v.variable_value === value
        );
        if (!exists) {
          const { error } = await supabase
            .from("user_custom_variables")
            .insert({
              user_id: user.id,
              variable_type: suggestion.type,
              variable_value: value,
            });
          if (!error) addedCount++;
        }
      }
    }

    toast({
      title: "Variables ajoutées",
      description: `${addedCount} nouvelles variables ajoutées.`,
    });
    
    fetchVariables();
    onSuggestionsProcessed?.();
    setSaving(false);
  };

  const getVariablesByType = (type: string) => {
    return variables.filter(v => v.variable_type === type);
  };

  const getSuggestionsForType = (type: string) => {
    const suggestion = suggestedVariables.find(s => s.type === type);
    if (!suggestion) return [];
    
    // Filter out values that already exist
    const existingValues = getVariablesByType(type).map(v => v.variable_value.toLowerCase());
    return suggestion.values.filter(v => !existingValues.includes(v.toLowerCase()));
  };

  const totalSuggestions = suggestedVariables.reduce((sum, s) => {
    const existingValues = getVariablesByType(s.type).map(v => v.variable_value.toLowerCase());
    return sum + s.values.filter(v => !existingValues.includes(v.toLowerCase())).length;
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] max-h-[95vh] sm:max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Gérer les Variables
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Suggestions from CSV import */}
          {totalSuggestions > 0 && (
            <div className="border border-primary/50 rounded-lg p-4 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-medium">Variables détectées depuis l'import CSV</Label>
                </div>
                <Button size="sm" onClick={handleAddAllSuggestions} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Tout ajouter ({totalSuggestions})
                </Button>
              </div>
              <div className="space-y-2">
                {suggestedVariables.map(suggestion => {
                  const newValues = getSuggestionsForType(suggestion.type);
                  if (newValues.length === 0) return null;
                  
                  const typeLabel = allVariableTypes.find(t => t.value === suggestion.type)?.label || suggestion.type;
                  return (
                    <div key={suggestion.type} className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">{typeLabel}:</span>
                      {newValues.map(value => (
                        <Badge 
                          key={value} 
                          variant="outline" 
                          className="cursor-pointer hover:bg-primary/20 transition-colors gap-1"
                          onClick={() => handleAddSuggestedVariable(suggestion.type, value)}
                        >
                          <Plus className="w-3 h-3" />
                          {value}
                        </Badge>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Create new type */}
          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Types de variables</Label>
              {!showNewTypeForm && (
                <Button size="sm" variant="outline" onClick={() => setShowNewTypeForm(true)} className="gap-2">
                  <Tag className="w-4 h-4" />
                  Nouveau type
                </Button>
              )}
            </div>
            
            {showNewTypeForm && (
              <div className="flex items-center gap-3 mb-4 p-3 border border-dashed border-primary/50 rounded-md bg-primary/5">
                <Input
                  value={newTypeKey}
                  onChange={(e) => setNewTypeKey(e.target.value)}
                  placeholder="Clé (ex: session)"
                  className="w-32"
                />
                <Input
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  placeholder="Label (ex: Session de trading)"
                  className="flex-1"
                />
                <Button onClick={handleAddNewType} disabled={savingType} size="sm" className="gap-2">
                  {savingType ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Créer
                </Button>
                <Button onClick={() => setShowNewTypeForm(false)} variant="ghost" size="sm">
                  Annuler
                </Button>
              </div>
            )}

            {/* Show custom types */}
            {customTypes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customTypes.map(type => (
                  <div
                    key={type.id}
                    className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-md px-2.5 py-1.5 group"
                  >
                    <Tag className="w-3 h-3 text-primary" />
                    <span className="text-sm">{type.type_label}</span>
                    <button
                      onClick={() => handleDeleteType(type.id, type.type_key)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new variable */}
          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <Label className="text-sm font-medium mb-3 block">Ajouter une variable</Label>
            <div className="flex items-center gap-3">
              <Select value={newVariableType} onValueChange={setNewVariableType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Type..." />
                </SelectTrigger>
                <SelectContent>
                  {allVariableTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        {t.label}
                        {'isCustom' in t && t.isCustom && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">Perso</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newVariableValue}
                onChange={(e) => setNewVariableValue(e.target.value)}
                placeholder="Valeur..."
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAddVariable()}
              />
              <Button onClick={handleAddVariable} disabled={saving} size="sm" className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Ajouter
              </Button>
            </div>
          </div>

          {/* Variables list by type */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {allVariableTypes.map(type => {
                const typeVariables = getVariablesByType(type.value);
                return (
                  <div key={type.value} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {type.label}
                        {'isCustom' in type && type.isCustom && (
                          <Badge variant="secondary" className="text-[10px]">Perso</Badge>
                        )}
                      </h3>
                      <span className="text-xs text-muted-foreground font-mono">{typeVariables.length} variables</span>
                    </div>
                    {typeVariables.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Aucune variable définie</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {typeVariables.map(v => (
                          <div
                            key={v.id}
                            className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-md px-2.5 py-1.5 group"
                          >
                            <span className="text-sm">{v.variable_value}</span>
                            <button
                              onClick={() => handleDeleteVariable(v.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};