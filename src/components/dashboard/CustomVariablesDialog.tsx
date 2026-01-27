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
import { Plus, Trash2, Loader2, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomVariable {
  id: string;
  variable_type: string;
  variable_value: string;
}

const VARIABLE_TYPES = [
  { value: "direction_structure", label: "Structure" },
  { value: "setup_type", label: "Type de Setup" },
  { value: "entry_model", label: "Entry Model" },
  { value: "entry_timing", label: "Entry Timing" },
];

interface CustomVariablesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomVariablesDialog = ({ isOpen, onClose }: CustomVariablesDialogProps) => {
  const [variables, setVariables] = useState<CustomVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newVariableType, setNewVariableType] = useState<string>("");
  const [newVariableValue, setNewVariableValue] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchVariables();
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

  const getVariablesByType = (type: string) => {
    return variables.filter(v => v.variable_type === type);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Gérer les Variables
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add new variable */}
          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <Label className="text-sm font-medium mb-3 block">Ajouter une variable</Label>
            <div className="flex items-center gap-3">
              <Select value={newVariableType} onValueChange={setNewVariableType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Type..." />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
              {VARIABLE_TYPES.map(type => {
                const typeVariables = getVariablesByType(type.value);
                return (
                  <div key={type.value} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">{type.label}</h3>
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
