import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Save, Trash2, X, Image as ImageIcon, Clock, Link as LinkIcon } from "lucide-react";
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
import { CustomizableMultiSelect } from "@/components/dashboard/CustomizableMultiSelect";

// ── Fixed options (non-deletable) ──
const ENTRY_MODEL_FIXED_OPTIONS = [
  "Englobante M1",
  "Englobante M3",
  "Englobante M5",
  "High-Low 3 bougies",
  "WICK",
  "Prise de liquidité",
];

const SETUP_TYPE_FIXED_OPTIONS = ["A", "B", "C"];

const TIMING_FIXED_OPTIONS = ["US Open 15:30", "London Close (16h)"];

const ENTRY_TIMEFRAME_FIXED_OPTIONS = ["15s", "30s", "M1", "M3", "M5", "M15"];
const CONTEXT_TIMEFRAME_OPTIONS = ["H4", "H1", "M15"];
const ENTRY_TF_SCREENSHOT_OPTIONS = ["M15", "M5", "M3", "M1", "30s", "15s", "5s"];

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
  screenshot_context_url?: string | null;
  screenshot_entry_url?: string | null;
  chart_link?: string | null;
  comment?: string | null;
  entry_price?: number | null;
  exit_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  result?: string | null;
  exit_date?: string | null;
  news_day?: boolean | null;
  news_label?: string | null;
}

interface PersonalTradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingTrade: PersonalTrade | null;
  nextTradeNumber: number;
  customSetupId?: string;
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
  entry_timeframe: string;
  rr: string;
  entry_price: string;
  exit_price: string;
  stop_loss: string;
  take_profit: string;
  result: "Win" | "Loss" | "BE" | "";
  notes: string;
  news_day: boolean;
  news_label: string;
  chart_link: string;
  sl_placement: string;
  tp_placement: string;
  context_timeframe: string;
  screenshot_entry_timeframe: string;
  stop_loss_size: string;
  asset: string;
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
  entry_timeframe: "",
  rr: "",
  entry_price: "",
  exit_price: "",
  stop_loss: "",
  take_profit: "",
  result: "",
  notes: "",
  news_day: false,
  news_label: "",
  chart_link: "",
  sl_placement: "",
  tp_placement: "",
  context_timeframe: "",
  screenshot_entry_timeframe: "",
  stop_loss_size: "",
  asset: "",
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

// ── TradingView embed helper ──
function getTradingViewEmbedUrl(url: string): string | null {
  if (!url) return null;
  // TradingView chart links like https://www.tradingview.com/chart/xxx/
  // or TradingView snapshot links like https://www.tradingview.com/x/xxx/
  if (url.includes("tradingview.com/x/") || url.includes("tradingview.com/chart/")) {
    return url;
  }
  return null;
}

// ── Screenshot Upload Component ──
const ScreenshotUploadField = ({
  label,
  file,
  preview,
  existingUrl,
  uploading,
  onFileSelect,
  onClear,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  existingUrl: string | null;
  uploading: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentScreenshot = preview || existingUrl;

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label} <span className="text-muted-foreground">(facultatif)</span></Label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelect}
        className="hidden"
      />
      {currentScreenshot ? (
        <div className="relative border border-border rounded-md p-2">
          <img src={currentScreenshot} alt={label} className="max-h-32 object-contain mx-auto rounded" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-5 w-5"
            onClick={onClear}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-16 border-dashed gap-2 text-xs"
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {label}
        </Button>
      )}
    </div>
  );
};

// ── Main Component ──
export const PersonalTradeDialog = ({
  isOpen,
  onClose,
  onSaved,
  editingTrade,
  nextTradeNumber,
  customSetupId,
}: PersonalTradeDialogProps) => {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Context screenshot state
  const [contextFile, setContextFile] = useState<File | null>(null);
  const [contextPreview, setContextPreview] = useState<string | null>(null);
  const [existingContextUrl, setExistingContextUrl] = useState<string | null>(null);

  // Entry screenshot state
  const [entryFile, setEntryFile] = useState<File | null>(null);
  const [entryPreview, setEntryPreview] = useState<string | null>(null);
  const [existingEntryUrl, setExistingEntryUrl] = useState<string | null>(null);

  const { toast } = useToast();
  const { variables, refetch: refetchVariables } = useCustomVariables();

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
          entry_timeframe: (editingTrade as any).entry_timeframe || "",
          rr: editingTrade.rr?.toString() || "",
          entry_price: editingTrade.entry_price?.toString() || "",
          exit_price: editingTrade.exit_price?.toString() || "",
          stop_loss: editingTrade.stop_loss?.toString() || "",
          take_profit: editingTrade.take_profit?.toString() || "",
          result: (editingTrade.result as "Win" | "Loss" | "BE") || "",
          notes: editingTrade.comment || "",
          news_day: editingTrade.news_day || false,
          news_label: editingTrade.news_label || "",
          chart_link: editingTrade.chart_link || "",
          sl_placement: (editingTrade as any).sl_placement || "",
          tp_placement: (editingTrade as any).tp_placement || "",
          context_timeframe: (editingTrade as any).context_timeframe || "",
          screenshot_entry_timeframe: "",
          stop_loss_size: editingTrade.stop_loss_size || "",
          asset: (editingTrade as any).asset || "",
        });
        // Handle existing screenshots - prioritize new fields, fallback to old screenshot_url
        setExistingContextUrl(editingTrade.screenshot_context_url || editingTrade.screenshot_url || null);
        setExistingEntryUrl(editingTrade.screenshot_entry_url || null);
      } else {
        const today = new Date().toISOString().split("T")[0];
        setFormData({
          ...initialFormData,
          trade_number: nextTradeNumber.toString(),
          trade_date: today,
          exit_date: today,
        });
        setExistingContextUrl(null);
        setExistingEntryUrl(null);
      }
      setContextFile(null);
      setContextPreview(null);
      setEntryFile(null);
      setEntryPreview(null);
    }
  }, [isOpen, editingTrade, nextTradeNumber]);

  // Auto-sync exit_date when entry date changes
  const handleEntryDateChange = (newDate: string) => {
    setFormData(prev => ({
      ...prev,
      trade_date: newDate,
      exit_date: (!prev.exit_date || prev.exit_date === prev.trade_date) ? newDate : prev.exit_date,
    }));
  };

  // Handle file selection for screenshots
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Fichier trop volumineux", description: "La taille maximale est de 5 MB.", variant: "destructive" });
        return;
      }
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Upload a screenshot file
  const uploadScreenshot = async (
    userId: string,
    tradeNumber: number,
    file: File | null,
    existingUrl: string | null,
    suffix: string
  ): Promise<string | null> => {
    if (!file) return existingUrl;
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/perso_${tradeNumber}_${suffix}_${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('trade-screenshots').upload(fileName, file, { upsert: true });
    if (error) {
      console.error(`Error uploading ${suffix} screenshot:`, error);
      return existingUrl;
    }
    return data.path;
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!formData.trade_number || !formData.trade_date || !formData.direction) {
      toast({ title: "Champs requis manquants", description: "Veuillez remplir les champs obligatoires.", variant: "destructive" });
      return;
    }

    setSaving(true);
    setUploading(true);

    const tradeNum = parseInt(formData.trade_number);
    const [contextUrl, entryUrl] = await Promise.all([
      uploadScreenshot(user.id, tradeNum, contextFile, existingContextUrl, "context"),
      uploadScreenshot(user.id, tradeNum, entryFile, existingEntryUrl, "entry"),
    ]);
    setUploading(false);

    const date = new Date(formData.trade_date);
    const dayOfWeek = DAYS_MAP[date.getDay()] || "Inconnu";

    const tradeData = {
      user_id: user.id,
      trade_number: tradeNum,
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
      entry_timeframe: formData.entry_timeframe || null,
      rr: formData.rr ? parseFloat(formData.rr) : null,
      entry_price: formData.entry_price ? parseFloat(formData.entry_price) : null,
      exit_price: formData.exit_price ? parseFloat(formData.exit_price) : null,
      stop_loss: formData.stop_loss ? parseFloat(formData.stop_loss) : null,
      take_profit: formData.take_profit ? parseFloat(formData.take_profit) : null,
      result: formData.result || null,
      comment: formData.notes || null,
      news_day: formData.news_day,
      news_label: formData.news_day ? (formData.news_label || null) : null,
      screenshot_context_url: contextUrl,
      screenshot_entry_url: entryUrl,
      screenshot_url: contextUrl, // backward compat
      chart_link: formData.chart_link || null,
      sl_placement: formData.sl_placement || null,
      tp_placement: formData.tp_placement || null,
      context_timeframe: formData.context_timeframe || null,
      stop_loss_size: formData.stop_loss_size || null,
      asset: formData.asset || null,
      custom_setup_id: customSetupId || null,
    } as any;

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

  const embedUrl = getTradingViewEmbedUrl(formData.chart_link);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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

          {/* Actif */}
          <div className="space-y-2">
            <Label>Actif concerné *</Label>
            <Input
              value={formData.asset}
              onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
              placeholder="Ex: NAS100, EUR/USD, GOLD, BTC..."
            />
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

          {/* Row 4: Structure & Type de Setup (multi-select) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Structure</Label>
              <CustomizableMultiSelect
                value={formData.direction_structure}
                onChange={(value) => setFormData({ ...formData, direction_structure: value })}
                customOptions={variables.direction_structure}
                variableType="direction_structure"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
            <div className="space-y-2">
              <Label>Type de Setup</Label>
              <CustomizableMultiSelect
                value={formData.setup_type}
                onChange={(value) => setFormData({ ...formData, setup_type: value })}
                fixedOptions={SETUP_TYPE_FIXED_OPTIONS}
                customOptions={variables.setup_type}
                variableType="setup_type"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
          </div>

          {/* Row 5: Entry Model & Timing (multi-select) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entry Model</Label>
              <CustomizableMultiSelect
                value={formData.entry_model}
                onChange={(value) => setFormData({ ...formData, entry_model: value })}
                fixedOptions={ENTRY_MODEL_FIXED_OPTIONS}
                customOptions={variables.entry_model}
                variableType="entry_model"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
            <div className="space-y-2">
              <Label>Timing</Label>
              <CustomizableMultiSelect
                value={formData.entry_timing}
                onChange={(value) => setFormData({ ...formData, entry_timing: value })}
                fixedOptions={TIMING_FIXED_OPTIONS}
                customOptions={variables.entry_timing}
                variableType="entry_timing"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
            <div className="space-y-2">
              <Label>Time Frame d'entrée</Label>
              <CustomizableMultiSelect
                value={formData.entry_timeframe}
                onChange={(value) => setFormData({ ...formData, entry_timeframe: value })}
                fixedOptions={ENTRY_TIMEFRAME_FIXED_OPTIONS}
                customOptions={variables.entry_timeframe}
                variableType="entry_timeframe"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
          </div>

          {/* Placement SL / TP */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Placement du SL</Label>
              <CustomizableMultiSelect
                value={formData.sl_placement}
                onChange={(value) => setFormData({ ...formData, sl_placement: value })}
                customOptions={variables.sl_placement || []}
                variableType="sl_placement"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
            <div className="space-y-2">
              <Label>Placement du TP</Label>
              <CustomizableMultiSelect
                value={formData.tp_placement}
                onChange={(value) => setFormData({ ...formData, tp_placement: value })}
                customOptions={variables.tp_placement || []}
                variableType="tp_placement"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
           </div>

          {/* Taille du SL */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Taille du SL</Label>
              <Input
                value={formData.stop_loss_size}
                onChange={(e) => setFormData({ ...formData, stop_loss_size: e.target.value })}
                placeholder="Taille du stop loss en points/pips"
              />
            </div>
          </div>

          {/* News section */}
          <div className="border-t border-border my-2" />
          <p className="text-xs text-muted-foreground font-mono uppercase">News & Contexte</p>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="news_day"
                checked={formData.news_day}
                onCheckedChange={(checked) => setFormData({ ...formData, news_day: !!checked, news_label: !!checked ? formData.news_label : "" })}
              />
              <Label htmlFor="news_day" className="cursor-pointer">Jour de news</Label>
            </div>
            {formData.news_day && (
              <div className="space-y-2 ml-7">
                <Label>Label de la news</Label>
                <Input
                  value={formData.news_label}
                  onChange={(e) => setFormData({ ...formData, news_label: e.target.value })}
                  placeholder="Ex: NFP, CPI, FOMC..."
                />
              </div>
            )}
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

          {/* Screenshots section */}
          <div className="border-t border-border my-2" />
          <p className="text-xs text-muted-foreground font-mono uppercase">Screenshots & Graphique</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <ScreenshotUploadField
                label="Screenshot Contexte"
                file={contextFile}
                preview={contextPreview}
                existingUrl={existingContextUrl}
                uploading={uploading}
                onFileSelect={(e) => handleFileSelect(e, setContextFile, setContextPreview)}
                onClear={() => { setContextFile(null); setContextPreview(null); setExistingContextUrl(null); }}
              />
              <Select value={formData.context_timeframe} onValueChange={(v) => setFormData({ ...formData, context_timeframe: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Time frame contexte" /></SelectTrigger>
                <SelectContent>
                  {CONTEXT_TIMEFRAME_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <ScreenshotUploadField
                label="Screenshot Entrée"
                file={entryFile}
                preview={entryPreview}
                existingUrl={existingEntryUrl}
                uploading={uploading}
                onFileSelect={(e) => handleFileSelect(e, setEntryFile, setEntryPreview)}
                onClear={() => { setEntryFile(null); setEntryPreview(null); setExistingEntryUrl(null); }}
              />
              <Select value={formData.screenshot_entry_timeframe} onValueChange={(v) => setFormData({ ...formData, screenshot_entry_timeframe: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Time frame entrée" /></SelectTrigger>
                <SelectContent>
                  {ENTRY_TF_SCREENSHOT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* TradingView / FX Replay link */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
              Lien TradingView / FX Replay
              <span className="text-muted-foreground text-xs">(facultatif)</span>
            </Label>
            <Input
              value={formData.chart_link}
              onChange={(e) => setFormData({ ...formData, chart_link: e.target.value })}
              placeholder="https://www.tradingview.com/chart/..."
            />
            {embedUrl && (
              <div className="border border-border rounded-md overflow-hidden mt-2">
                <iframe
                  src={embedUrl}
                  className="w-full h-48"
                  title="TradingView Chart"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
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
