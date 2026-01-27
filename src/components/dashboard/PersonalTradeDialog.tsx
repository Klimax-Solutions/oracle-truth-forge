import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PersonalTrade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  direction_structure: string | null;
  entry_time: string | null;
  exit_time: string | null;
  trade_duration: string | null;
  rr: number | null;
  stop_loss_size: string | null;
  setup_type: string | null;
  entry_timing: string | null;
  entry_model: string | null;
}

interface PersonalTradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingTrade: PersonalTrade | null;
  nextTradeNumber: number;
}

const DAYS_MAP: Record<number, string> = {
  0: "Dimanche",
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
};

const SETUP_TYPES = ["A", "B", "C"];
const ENTRY_MODELS = ["BOS", "MSS", "OB", "FVG", "EQH/L", "Liquidity Sweep", "Breaker", "Mitigation"];
const DIRECTION_STRUCTURES = ["Continuation", "Retracement"];
const ENTRY_TIMINGS = ["Open US 15:30", "London Close 16:00", "New York Close 20:00"];

interface FormData {
  trade_number: string;
  trade_date: string;
  direction: "Long" | "Short";
  direction_structure: string;
  entry_time: string;
  exit_time: string;
  setup_type: string;
  entry_model: string;
  entry_timing: string;
  rr: string;
}

const initialFormData: FormData = {
  trade_number: "",
  trade_date: new Date().toISOString().split("T")[0],
  direction: "Long",
  direction_structure: "",
  entry_time: "",
  exit_time: "",
  setup_type: "",
  entry_model: "",
  entry_timing: "",
  rr: "",
};

export const PersonalTradeDialog = ({
  isOpen,
  onClose,
  onSaved,
  editingTrade,
  nextTradeNumber,
}: PersonalTradeDialogProps) => {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (editingTrade) {
        setFormData({
          trade_number: editingTrade.trade_number.toString(),
          trade_date: editingTrade.trade_date,
          direction: editingTrade.direction as "Long" | "Short",
          direction_structure: editingTrade.direction_structure || "",
          entry_time: editingTrade.entry_time || "",
          exit_time: editingTrade.exit_time || "",
          setup_type: editingTrade.setup_type || "",
          entry_model: editingTrade.entry_model || "",
          entry_timing: editingTrade.entry_timing || "",
          rr: editingTrade.rr?.toString() || "",
        });
      } else {
        setFormData({
          ...initialFormData,
          trade_number: nextTradeNumber.toString(),
        });
      }
    }
  }, [isOpen, editingTrade, nextTradeNumber]);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!formData.trade_number || !formData.trade_date || !formData.direction) {
      toast({
        title: "Champs requis manquants",
        description: "Veuillez remplir les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const date = new Date(formData.trade_date);
    const dayOfWeek = DAYS_MAP[date.getDay()] || "Inconnu";

    const tradeData = {
      user_id: user.id,
      trade_number: parseInt(formData.trade_number),
      trade_date: formData.trade_date,
      day_of_week: dayOfWeek,
      direction: formData.direction,
      direction_structure: formData.direction_structure || null,
      entry_time: formData.entry_time || null,
      exit_time: formData.exit_time || null,
      setup_type: formData.setup_type || null,
      entry_model: formData.entry_model || null,
      entry_timing: formData.entry_timing || null,
      rr: formData.rr ? parseFloat(formData.rr) : null,
    };

    try {
      if (editingTrade) {
        const { error } = await supabase
          .from("user_personal_trades")
          .update(tradeData)
          .eq("id", editingTrade.id);

        if (error) throw error;

        toast({
          title: "Trade mis à jour",
          description: `Trade #${formData.trade_number} modifié avec succès.`,
        });
      } else {
        const { error } = await supabase
          .from("user_personal_trades")
          .insert(tradeData);

        if (error) {
          if (error.code === "23505") {
            toast({
              title: "Erreur",
              description: `Le trade #${formData.trade_number} existe déjà.`,
              variant: "destructive",
            });
            setSaving(false);
            return;
          }
          throw error;
        }

        toast({
          title: "Trade ajouté",
          description: `Trade #${formData.trade_number} créé avec succès.`,
        });
      }

      onSaved();
    } catch (error: any) {
      console.error("Error saving trade:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTrade) return;

    const { error } = await supabase
      .from("user_personal_trades")
      .delete()
      .eq("id", editingTrade.id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le trade.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Trade supprimé",
        description: `Trade #${editingTrade.trade_number} supprimé.`,
      });
      onSaved();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTrade ? `Modifier Trade #${editingTrade.trade_number}` : "Nouveau Trade"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Row 1: Trade Number & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trade_number">Numéro du Trade *</Label>
              <Input
                id="trade_number"
                type="number"
                value={formData.trade_number}
                onChange={(e) => setFormData({ ...formData, trade_number: e.target.value })}
                disabled={!!editingTrade}
              />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <DatePicker
                value={formData.trade_date}
                onChange={(value) => setFormData({ ...formData, trade_date: value })}
              />
            </div>
          </div>

          {/* Row 2: Direction & Structure */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Direction *</Label>
              <Select
                value={formData.direction}
                onValueChange={(value: "Long" | "Short") => setFormData({ ...formData, direction: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Structure</Label>
              <Select
                value={formData.direction_structure}
                onValueChange={(value) => setFormData({ ...formData, direction_structure: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTION_STRUCTURES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Entry & Exit Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heure d'entrée</Label>
              <TimePicker
                value={formData.entry_time}
                onChange={(value) => setFormData({ ...formData, entry_time: value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Heure de sortie</Label>
              <TimePicker
                value={formData.exit_time}
                onChange={(value) => setFormData({ ...formData, exit_time: value })}
              />
            </div>
          </div>

          {/* Row 4: Setup & Model */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Setup Type</Label>
              <Select
                value={formData.setup_type}
                onValueChange={(value) => setFormData({ ...formData, setup_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {SETUP_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entry Model</Label>
              <Select
                value={formData.entry_model}
                onValueChange={(value) => setFormData({ ...formData, entry_model: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 5: Timing & RR */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entry Timing</Label>
              <Select
                value={formData.entry_timing}
                onValueChange={(value) => setFormData({ ...formData, entry_timing: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_TIMINGS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>RR (Risk/Reward)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.rr}
                onChange={(e) => setFormData({ ...formData, rr: e.target.value })}
                placeholder="Ex: 2.5"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {editingTrade ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce trade ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div />
          )}
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editingTrade ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
