import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Save, Trash2, X, Image as ImageIcon, Clock } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useCustomVariables } from "@/hooks/useCustomVariables";
import { CustomizableSelect } from "@/components/dashboard/CustomizableSelect";

// ── Fixed options for Entry Model (non-deletable) ──
const ENTRY_MODEL_FIXED_OPTIONS = [
  "Englobante M1",
  "Englobante M3",
  "Englobante M5",
  "High-Low 3 bougies",
  "WICK",
  "Prise de liquidité",
];

// (EntryModelCombo and VariableCombo removed — replaced by CustomizableSelect)

// ── Types ──
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
  screenshot_url?: string | null;
  comment?: string | null;
  entry_price?: number | null;
  exit_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  result?: string | null;
  exit_date?: string | null;
}

interface PersonalTradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingTrade: PersonalTrade | null;
  nextTradeNumber: number;
}

const DAYS_MAP: Record<number, string> = {
  0: "Dimanche", 1: "Lundi", 2: "Mardi", 3: "Mercredi",
  4: "Jeudi", 5: "Vendredi", 6: "Samedi",
};

interface FormData {
  trade_number: string;
  trade_date: string;
  exit_date: string;
  direction: "Long" | "Short";
  direction_structure: string;
  entry_time: string;
  exit_time: string;
  setup_type: string;
  entry_model: string;
  entry_timing: string;
  rr: string;
  entry_price: string;
  exit_price: string;
  stop_loss: string;
  take_profit: string;
  result: "Win" | "Loss" | "BE" | "";
  notes: string;
}

const initialFormData: FormData = {
  trade_number: "",
  trade_date: new Date().toISOString().split("T")[0],
  exit_date: new Date().toISOString().split("T")[0],
  direction: "Long",
  direction_structure: "",
  entry_time: "",
  exit_time: "",
  setup_type: "",
  entry_model: "",
  entry_timing: "",
  rr: "",
  entry_price: "",
  exit_price: "",
  stop_loss: "",
  take_profit: "",
  result: "",
  notes: "",
};

// ── Duration calculator ──
function calculateDuration(entryDate: string, entryTime: string, exitDate: string, exitTime: string): string {
  if (!entryDate || !entryTime || !exitDate || !exitTime) return "";

  try {
    const entry = new Date(`${entryDate}T${entryTime}:00`);
    const exit = new Date(`${exitDate}T${exitTime}:00`);
    const diffMs = exit.getTime() - entry.getTime();

    if (diffMs < 0) return "";

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}j`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);

    return parts.join(" ");
  } catch {
    return "";
  }
}

// ── Main Component ──
export const PersonalTradeDialog = ({
  isOpen,
  onClose,
  onSaved,
  editingTrade,
  nextTradeNumber,
}: PersonalTradeDialogProps) => {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [existingScreenshot, setExistingScreenshot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { variables } = useCustomVariables();

  // Auto-computed duration
  const tradeDuration = calculateDuration(
    formData.trade_date, formData.entry_time,
    formData.exit_date, formData.exit_time
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (editingTrade) {
        setFormData({
          trade_number: editingTrade.trade_number.toString(),
          trade_date: editingTrade.trade_date,
          exit_date: editingTrade.exit_date || editingTrade.trade_date,
          direction: editingTrade.direction as "Long" | "Short",
          direction_structure: editingTrade.direction_structure || "",
          entry_time: editingTrade.entry_time || "",
          exit_time: editingTrade.exit_time || "",
          setup_type: editingTrade.setup_type || "",
          entry_model: editingTrade.entry_model || "",
          entry_timing: editingTrade.entry_timing || "",
          rr: editingTrade.rr?.toString() || "",
          entry_price: editingTrade.entry_price?.toString() || "",
          exit_price: editingTrade.exit_price?.toString() || "",
          stop_loss: editingTrade.stop_loss?.toString() || "",
          take_profit: editingTrade.take_profit?.toString() || "",
          result: (editingTrade.result as "Win" | "Loss" | "BE") || "",
          notes: editingTrade.comment || "",
        });
        setExistingScreenshot(editingTrade.screenshot_url || null);
      } else {
        const today = new Date().toISOString().split("T")[0];
        setFormData({
          ...initialFormData,
          trade_number: nextTradeNumber.toString(),
          trade_date: today,
          exit_date: today,
        });
        setExistingScreenshot(null);
      }
      setScreenshotFile(null);
      setScreenshotPreview(null);
    }
  }, [isOpen, editingTrade, nextTradeNumber]);

  // Auto-sync exit_date when entry date changes (only if they were the same)
  const handleEntryDateChange = (newDate: string) => {
    setFormData(prev => ({
      ...prev,
      trade_date: newDate,
      // Auto-set exit_date to match entry date if exit_date was same as old entry date or empty
      exit_date: (!prev.exit_date || prev.exit_date === prev.trade_date) ? newDate : prev.exit_date,
    }));
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Fichier trop volumineux", description: "La taille maximale est de 5 MB.", variant: "destructive" });
        return;
      }
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setScreenshotPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Upload screenshot
  const uploadScreenshot = async (userId: string, tradeNumber: number): Promise<string | null> => {
    if (!screenshotFile) return existingScreenshot;
    setUploading(true);
    const fileExt = screenshotFile.name.split('.').pop();
    const fileName = `${userId}/perso_${tradeNumber}_${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('trade-screenshots').upload(fileName, screenshotFile, { upsert: true });
    setUploading(false);
    if (error) {
      console.error("Error uploading screenshot:", error);
      toast({ title: "Erreur d'upload", description: "Impossible d'envoyer le screenshot.", variant: "destructive" });
      return existingScreenshot;
    }
    return data.path;
  };

  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setExistingScreenshot(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!formData.trade_number || !formData.trade_date || !formData.direction) {
      toast({ title: "Champs requis manquants", description: "Veuillez remplir les champs obligatoires.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const screenshotUrl = await uploadScreenshot(user.id, parseInt(formData.trade_number));

    const date = new Date(formData.trade_date);
    const dayOfWeek = DAYS_MAP[date.getDay()] || "Inconnu";

    const tradeData = {
      user_id: user.id,
      trade_number: parseInt(formData.trade_number),
      trade_date: formData.trade_date,
      exit_date: formData.exit_date || null,
      day_of_week: dayOfWeek,
      direction: formData.direction,
      direction_structure: formData.direction_structure || null,
      entry_time: formData.entry_time || null,
      exit_time: formData.exit_time || null,
      trade_duration: tradeDuration || null,
      setup_type: formData.setup_type || null,
      entry_model: formData.entry_model || null,
      entry_timing: formData.entry_timing || null,
      rr: formData.rr ? parseFloat(formData.rr) : null,
      entry_price: formData.entry_price ? parseFloat(formData.entry_price) : null,
      exit_price: formData.exit_price ? parseFloat(formData.exit_price) : null,
      stop_loss: formData.stop_loss ? parseFloat(formData.stop_loss) : null,
      take_profit: formData.take_profit ? parseFloat(formData.take_profit) : null,
      result: formData.result || null,
      comment: formData.notes || null,
      screenshot_url: screenshotUrl,
    };

    try {
      if (editingTrade) {
        const { error } = await supabase.from("user_personal_trades").update(tradeData).eq("id", editingTrade.id);
        if (error) throw error;
        toast({ title: "Trade mis à jour", description: `Trade #${formData.trade_number} modifié avec succès.` });
      } else {
        const { error } = await supabase.from("user_personal_trades").insert(tradeData);
        if (error) {
          if (error.code === "23505") {
            toast({ title: "Erreur", description: `Le trade #${formData.trade_number} existe déjà.`, variant: "destructive" });
            setSaving(false);
            return;
          }
          throw error;
        }
        toast({ title: "Trade ajouté", description: `Trade #${formData.trade_number} créé avec succès.` });
      }
      onSaved();
    } catch (error: any) {
      console.error("Error saving trade:", error);
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTrade) return;
    const { error } = await supabase.from("user_personal_trades").delete().eq("id", editingTrade.id);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer le trade.", variant: "destructive" });
    } else {
      toast({ title: "Trade supprimé", description: `Trade #${editingTrade.trade_number} supprimé.` });
      onSaved();
    }
  };

  const currentScreenshot = screenshotPreview || existingScreenshot;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTrade ? `Modifier Trade #${editingTrade.trade_number}` : "Nouveau Trade"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Row 1: Trade Number & Date d'entrée */}
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
              <Label>Date d'entrée *</Label>
              <DatePicker
                value={formData.trade_date}
                onChange={handleEntryDateChange}
              />
            </div>
          </div>

          {/* Row 2: Direction & Result */}
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
              <Label>Résultat</Label>
              <Select
                value={formData.result}
                onValueChange={(value: "Win" | "Loss" | "BE" | "") => setFormData({ ...formData, result: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Win">Win</SelectItem>
                  <SelectItem value="Loss">Loss</SelectItem>
                  <SelectItem value="BE">BE (Break Even)</SelectItem>
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

          {/* Row 3b: Exit Date & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date de sortie</Label>
              <DatePicker
                value={formData.exit_date}
                onChange={(value) => setFormData({ ...formData, exit_date: value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Durée du trade
              </Label>
              <div className={cn(
                "flex h-10 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-mono",
                !tradeDuration && "text-muted-foreground"
              )}>
                {tradeDuration || "—"}
              </div>
            </div>
          </div>

          {/* Row 4: Structure & Type de Setup */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Structure</Label>
              <VariableCombo
                value={formData.direction_structure}
                onChange={(value) => setFormData({ ...formData, direction_structure: value })}
                options={variables.direction_structure}
                placeholder="Sélectionner ou saisir..."
              />
            </div>
            <div className="space-y-2">
              <Label>Type de Setup</Label>
              <VariableCombo
                value={formData.setup_type}
                onChange={(value) => setFormData({ ...formData, setup_type: value })}
                options={variables.setup_type}
                placeholder="Sélectionner ou saisir..."
              />
            </div>
          </div>

          {/* Row 5: Entry Model & Timing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entry Model</Label>
              <EntryModelCombo
                value={formData.entry_model}
                onChange={(value) => setFormData({ ...formData, entry_model: value })}
                userOptions={variables.entry_model}
                placeholder="Sélectionner ou saisir..."
              />
            </div>
            <div className="space-y-2">
              <Label>Timing</Label>
              <VariableCombo
                value={formData.entry_timing}
                onChange={(value) => setFormData({ ...formData, entry_timing: value })}
                options={variables.entry_timing}
                placeholder="Sélectionner ou saisir..."
              />
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-border my-2" />
          <p className="text-xs text-muted-foreground font-mono uppercase">Données Financières</p>

          {/* Row 6: Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prix d'entrée</Label>
              <Input
                type="number"
                step="0.00001"
                value={formData.entry_price}
                onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                placeholder="Ex: 1.08550"
              />
            </div>
            <div className="space-y-2">
              <Label>Prix de sortie</Label>
              <Input
                type="number"
                step="0.00001"
                value={formData.exit_price}
                onChange={(e) => setFormData({ ...formData, exit_price: e.target.value })}
                placeholder="Ex: 1.08750"
              />
            </div>
          </div>

          {/* Row 7: SL & TP */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stop Loss</Label>
              <Input
                type="number"
                step="0.00001"
                value={formData.stop_loss}
                onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value })}
                placeholder="Ex: 1.08450"
              />
            </div>
            <div className="space-y-2">
              <Label>Take Profit</Label>
              <Input
                type="number"
                step="0.00001"
                value={formData.take_profit}
                onChange={(e) => setFormData({ ...formData, take_profit: e.target.value })}
                placeholder="Ex: 1.08850"
              />
            </div>
          </div>

          {/* Row 8: RR */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>RR (Risk/Reward)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.rr}
                onChange={(e) => setFormData({ ...formData, rr: e.target.value })}
                placeholder="Ex: 2.5 ou -1"
              />
            </div>
          </div>

          {/* Screenshot Upload */}
          <div className="space-y-2">
            <Label>Screenshot</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {currentScreenshot ? (
              <div className="relative border border-border rounded-md p-2">
                <img src={currentScreenshot} alt="Screenshot" className="max-h-40 object-contain mx-auto rounded" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={clearScreenshot}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-20 border-dashed gap-2"
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                Ajouter un screenshot
              </Button>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notes, observations, analyse post-trade..."
              rows={3}
            />
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
                  <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || uploading} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingTrade ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
