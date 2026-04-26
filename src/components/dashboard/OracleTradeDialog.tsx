/**
 * OracleTradeDialog
 * ─────────────────
 * Dialog de saisie de trade pour la **saisie Oracle** (cycles).
 * Clone visuel/UX de PersonalTradeDialog mais :
 *  - sauvegarde dans `user_executions` (pas user_personal_trades)
 *  - le numéro de trade est imposé / verrouillé (suit la séquence Oracle)
 *  - affiche la fenêtre du cycle Oracle en cours et bloque hors fenêtre
 *  - aucun champ "asset" (Oracle = NAS100/indices US)
 */
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
import {
  Loader2, Save, Trash2, X, Image as ImageIcon, Clock, Link as LinkIcon,
  Lock, Calendar as CalendarIcon, AlertTriangle,
} from "lucide-react";
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
import {
  RecommendedWindow,
  checkDateInWindow,
  formatDateShort,
} from "@/lib/oracle-cycle-windows";

// ── Fixed options (alignés sur PersonalTradeDialog) ──
const ENTRY_MODEL_FIXED_OPTIONS = [
  "Englobante M1", "Englobante M3", "Englobante M5",
  "High-Low 3 bougies", "WICK", "Prise de liquidité",
];
const SETUP_TYPE_FIXED_OPTIONS = ["A", "B", "C"];
const TIMING_FIXED_OPTIONS = ["US Open 15:30", "London Close (16h)"];
const ENTRY_TIMEFRAME_FIXED_OPTIONS = ["15s", "30s", "M1", "M3", "M5", "M15"];
const CONTEXT_TIMEFRAME_OPTIONS = ["H4", "H1", "M15"];
const ENTRY_TF_SCREENSHOT_OPTIONS = ["M15", "M5", "M3", "M1", "30s", "15s", "5s"];

const DAYS_MAP: Record<number, string> = {
  0: "Dimanche", 1: "Lundi", 2: "Mardi", 3: "Mercredi",
  4: "Jeudi", 5: "Vendredi", 6: "Samedi",
};

// ── Types ──
export interface OracleExecution {
  id: string;
  trade_number: number;
  trade_date: string;
  exit_date?: string | null;
  direction: "Long" | "Short";
  direction_structure?: string | null;
  entry_time?: string | null;
  exit_time?: string | null;
  trade_duration?: string | null;
  rr?: number | null;
  stop_loss_size?: string | null;
  setup_type?: string | null;
  entry_timing?: string | null;
  entry_model?: string | null;
  entry_timeframe?: string | null;
  context_timeframe?: string | null;
  sl_placement?: string | null;
  tp_placement?: string | null;
  screenshot_url?: string | null;
  screenshot_entry_url?: string | null;
  result?: string | null;
  notes?: string | null;
  news_day?: boolean | null;
  news_label?: string | null;
  entry_price?: number | null;
  exit_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
}

interface OracleTradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Trade en cours d'édition (null = création). */
  editingTrade: OracleExecution | null;
  /** Numéro imposé pour un nouveau trade (séquence Oracle). */
  nextTradeNumber: number;
  /** Fenêtre de cycle Oracle recommandée pour ce nouveau trade (null = pas de contrainte). */
  recommendedWindow?: RecommendedWindow | null;
  /** Numéro du cycle en cours (affichage badge). */
  currentCycleNum?: number | null;
  /** Date minimale autorisée (chaînage cycles précédents). */
  minTradeDate?: string | null;
}

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
  sl_placement: string;
  tp_placement: string;
  context_timeframe: string;
  screenshot_entry_timeframe: string;
  stop_loss_size: string;
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
  sl_placement: "",
  tp_placement: "",
  context_timeframe: "",
  screenshot_entry_timeframe: "",
  stop_loss_size: "",
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

// ── Screenshot Upload Component ──
const ScreenshotUploadField = ({
  label, file, preview, existingUrl, uploading, onFileSelect, onClear,
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
      <Label className="text-xs">{label} <span className="text-destructive">*</span></Label>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />
      {currentScreenshot ? (
        <div className="relative border border-border rounded-md p-2">
          <img src={currentScreenshot} alt={label} className="max-h-32 object-contain mx-auto rounded" />
          <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={onClear}>
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
export const OracleTradeDialog = ({
  isOpen,
  onClose,
  onSaved,
  editingTrade,
  nextTradeNumber,
  recommendedWindow,
  currentCycleNum,
  minTradeDate,
}: OracleTradeDialogProps) => {
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

  const tradeDuration = calculateDuration(
    formData.trade_date, formData.entry_time,
    formData.exit_date, formData.exit_time,
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    if (editingTrade) {
      setFormData({
        trade_number: editingTrade.trade_number.toString(),
        trade_date: editingTrade.trade_date,
        exit_date: editingTrade.exit_date || editingTrade.trade_date,
        direction: editingTrade.direction,
        direction_structure: editingTrade.direction_structure || "",
        entry_time: editingTrade.entry_time || "",
        exit_time: editingTrade.exit_time || "",
        setup_type: editingTrade.setup_type || "",
        entry_model: editingTrade.entry_model || "",
        entry_timing: editingTrade.entry_timing || "",
        entry_timeframe: editingTrade.entry_timeframe || "",
        rr: editingTrade.rr?.toString() || "",
        entry_price: editingTrade.entry_price?.toString() || "",
        exit_price: editingTrade.exit_price?.toString() || "",
        stop_loss: editingTrade.stop_loss?.toString() || "",
        take_profit: editingTrade.take_profit?.toString() || "",
        result: (editingTrade.result as "Win" | "Loss" | "BE") || "",
        notes: editingTrade.notes || "",
        news_day: editingTrade.news_day || false,
        news_label: editingTrade.news_label || "",
        sl_placement: editingTrade.sl_placement || "",
        tp_placement: editingTrade.tp_placement || "",
        context_timeframe: editingTrade.context_timeframe || "",
        screenshot_entry_timeframe: "",
        stop_loss_size: editingTrade.stop_loss_size || "",
      });
      setExistingContextUrl(editingTrade.screenshot_url || null);
      setExistingEntryUrl(editingTrade.screenshot_entry_url || null);
    } else {
      // Nouveau trade : pré-remplir avec le numéro imposé + date dans la fenêtre recommandée
      const today = new Date().toISOString().split("T")[0];
      const defaultDate =
        recommendedWindow?.start && recommendedWindow?.end
          ? // si "today" est dans la fenêtre on prend today, sinon début fenêtre
            today >= recommendedWindow.start && today <= recommendedWindow.end
              ? today
              : recommendedWindow.start
          : today;
      setFormData({
        ...initialFormData,
        trade_number: nextTradeNumber.toString(),
        trade_date: defaultDate,
        exit_date: defaultDate,
      });
      setExistingContextUrl(null);
      setExistingEntryUrl(null);
    }
    setContextFile(null);
    setContextPreview(null);
    setEntryFile(null);
    setEntryPreview(null);
  }, [isOpen, editingTrade, nextTradeNumber, recommendedWindow]);

  const handleEntryDateChange = (newDate: string) => {
    setFormData(prev => ({
      ...prev,
      trade_date: newDate,
      exit_date: (!prev.exit_date || prev.exit_date === prev.trade_date) ? newDate : prev.exit_date,
    }));
  };

  // ── Validation contraintes Oracle ──
  const dateWindowStatus = (() => {
    if (!recommendedWindow || !formData.trade_date) return "unknown" as const;
    return checkDateInWindow(formData.trade_date, recommendedWindow);
  })();

  const dateBeforeMin = !!minTradeDate && !!formData.trade_date && formData.trade_date < minTradeDate;

  const dateBlocked = !editingTrade && (dateWindowStatus === "outside" || dateBeforeMin);

  // ── File upload helpers ──
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Fichier trop volumineux", description: "La taille maximale est de 10 MB.", variant: "destructive" });
        return;
      }
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadScreenshot = async (
    userId: string,
    tradeNumber: number,
    file: File | null,
    existingUrl: string | null,
    suffix: string,
  ): Promise<string | null> => {
    if (!file) return existingUrl;
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/execution_${tradeNumber}_${suffix}_${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('trade-screenshots').upload(fileName, file, { upsert: true });
    if (error) {
      console.error(`Error uploading ${suffix} screenshot:`, error);
      return existingUrl;
    }
    return data.path;
  };

  // ── Save ──
  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!formData.trade_number || !formData.trade_date || !formData.direction) {
      toast({ title: "Champs requis manquants", description: "Veuillez remplir les champs obligatoires.", variant: "destructive" });
      return;
    }

    if (dateBlocked) {
      toast({
        title: "Date hors fenêtre Oracle",
        description: dateBeforeMin
          ? `La date doit être ≥ ${formatDateShort(minTradeDate!)}.`
          : `La date doit être comprise entre ${formatDateShort(recommendedWindow!.start)} et ${formatDateShort(recommendedWindow!.end)}.`,
        variant: "destructive",
      });
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

    const tradeData = {
      user_id: user.id,
      trade_number: tradeNum,
      trade_date: formData.trade_date,
      exit_date: formData.exit_date || null,
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
      notes: formData.notes || null,
      news_day: formData.news_day,
      news_label: formData.news_day ? (formData.news_label || null) : null,
      screenshot_url: contextUrl,
      screenshot_entry_url: entryUrl,
      sl_placement: formData.sl_placement || null,
      tp_placement: formData.tp_placement || null,
      context_timeframe: formData.context_timeframe || null,
      stop_loss_size: formData.stop_loss_size || null,
    } as any;

    try {
      if (editingTrade) {
        const { error } = await supabase.from("user_executions").update(tradeData).eq("id", editingTrade.id);
        if (error) throw error;
        toast({ title: "Trade mis à jour", description: `Trade #${formData.trade_number} modifié avec succès.` });
      } else {
        const { error } = await supabase.from("user_executions").insert(tradeData);
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
      console.error("Error saving execution:", error);
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTrade) return;
    const { error } = await supabase.from("user_executions").delete().eq("id", editingTrade.id);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer le trade.", variant: "destructive" });
    } else {
      toast({ title: "Trade supprimé", description: `Trade #${editingTrade.trade_number} supprimé.` });
      onSaved();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[calc(100vw-1rem)] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingTrade ? `Modifier Trade #${editingTrade.trade_number}` : `Nouveau Trade Oracle`}
            {!editingTrade && currentCycleNum != null && (
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                Cycle {currentCycleNum}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Bandeau fenêtre Oracle */}
        {!editingTrade && recommendedWindow && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-xs border",
            dateWindowStatus === "in_window"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              : dateWindowStatus === "outside"
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : dateWindowStatus === "warning"
              ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
              : "bg-muted/40 border-border text-muted-foreground",
          )}>
            <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono">
              Fenêtre Oracle : {formatDateShort(recommendedWindow.start)} → {formatDateShort(recommendedWindow.end)}
            </span>
            {dateWindowStatus === "outside" && (
              <span className="ml-auto flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3 h-3" /> Date hors fenêtre
              </span>
            )}
          </div>
        )}

        <div className="grid gap-4 py-4">
          {/* Row 1: Trade Number (verrouillé) & Date d'entrée */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="trade_number" className="flex items-center gap-1.5">
                Numéro du Trade *
                <Lock className="w-3 h-3 text-muted-foreground" />
              </Label>
              <Input
                id="trade_number"
                type="number"
                value={formData.trade_number}
                disabled
                className="bg-muted/40 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Date d'entrée *</Label>
              <DatePicker
                value={formData.trade_date}
                onChange={handleEntryDateChange}
              />
              {dateBeforeMin && (
                <p className="text-[10px] text-red-400 font-mono">
                  Doit être ≥ {formatDateShort(minTradeDate!)}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Direction & Result */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Direction *</Label>
              <Select
                value={formData.direction}
                onValueChange={(value: "Long" | "Short") => setFormData({ ...formData, direction: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Win">Win</SelectItem>
                  <SelectItem value="Loss">Loss</SelectItem>
                  <SelectItem value="BE">BE (Break Even)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Entry & Exit Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Heure d'entrée</Label>
              <TimePicker value={formData.entry_time} onChange={(v) => setFormData({ ...formData, entry_time: v })} />
            </div>
            <div className="space-y-2">
              <Label>Heure de sortie</Label>
              <TimePicker value={formData.exit_time} onChange={(v) => setFormData({ ...formData, exit_time: v })} />
            </div>
          </div>

          {/* Row 3b: Exit Date & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Date de sortie</Label>
              <DatePicker value={formData.exit_date} onChange={(v) => setFormData({ ...formData, exit_date: v })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Durée du trade
              </Label>
              <div className={cn(
                "flex h-10 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-mono",
                !tradeDuration && "text-muted-foreground",
              )}>
                {tradeDuration || "—"}
              </div>
            </div>
          </div>

          {/* Row 4: Structure & Setup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Structure</Label>
              <CustomizableMultiSelect
                value={formData.direction_structure}
                onChange={(v) => setFormData({ ...formData, direction_structure: v })}
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
                onChange={(v) => setFormData({ ...formData, setup_type: v })}
                fixedOptions={SETUP_TYPE_FIXED_OPTIONS}
                customOptions={variables.setup_type}
                variableType="setup_type"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
          </div>

          {/* Row 5: Entry Model / Timing / TF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Entry Model</Label>
              <CustomizableMultiSelect
                value={formData.entry_model}
                onChange={(v) => setFormData({ ...formData, entry_model: v })}
                fixedOptions={ENTRY_MODEL_FIXED_OPTIONS}
                customOptions={variables.entry_model}
                variableType="entry_model"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
            <div className="space-y-2">
              <Label>Entry Timing</Label>
              <CustomizableMultiSelect
                value={formData.entry_timing}
                onChange={(v) => setFormData({ ...formData, entry_timing: v })}
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
                onChange={(v) => setFormData({ ...formData, entry_timeframe: v })}
                fixedOptions={ENTRY_TIMEFRAME_FIXED_OPTIONS}
                customOptions={variables.entry_timeframe}
                variableType="entry_timeframe"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
          </div>

          {/* Placement SL / TP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Placement du SL</Label>
              <CustomizableMultiSelect
                value={formData.sl_placement}
                onChange={(v) => setFormData({ ...formData, sl_placement: v })}
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
                onChange={(v) => setFormData({ ...formData, tp_placement: v })}
                customOptions={variables.tp_placement || []}
                variableType="tp_placement"
                placeholder="Sélectionner..."
                onOptionsChanged={refetchVariables}
              />
            </div>
          </div>

          {/* Taille du SL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Taille du SL</Label>
              <Input
                value={formData.stop_loss_size}
                onChange={(e) => setFormData({ ...formData, stop_loss_size: e.target.value })}
                placeholder="Taille du stop loss en points/pips"
              />
            </div>
          </div>

          {/* News */}
          <div className="border-t border-border my-2" />
          <p className="text-xs text-muted-foreground font-mono uppercase">News & Contexte</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="news_day"
                checked={formData.news_day}
                onCheckedChange={(checked) => setFormData({
                  ...formData,
                  news_day: !!checked,
                  news_label: !!checked ? formData.news_label : "",
                })}
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

          {/* Données Financières */}
          <div className="border-t border-border my-2" />
          <p className="text-xs text-muted-foreground font-mono uppercase">Données Financières</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Prix d'entrée</Label>
              <Input type="number" step="0.00001" value={formData.entry_price}
                onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                placeholder="Ex: 18450.5" />
            </div>
            <div className="space-y-2">
              <Label>Prix de sortie</Label>
              <Input type="number" step="0.00001" value={formData.exit_price}
                onChange={(e) => setFormData({ ...formData, exit_price: e.target.value })}
                placeholder="Ex: 18475.0" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Stop Loss</Label>
              <Input type="number" step="0.00001" value={formData.stop_loss}
                onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Take Profit</Label>
              <Input type="number" step="0.00001" value={formData.take_profit}
                onChange={(e) => setFormData({ ...formData, take_profit: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>RR (Risk/Reward)</Label>
              <Input type="number" step="0.01" value={formData.rr}
                onChange={(e) => setFormData({ ...formData, rr: e.target.value })}
                placeholder="Ex: 2.5 ou -1" />
            </div>
          </div>

          {/* Screenshots */}
          <div className="border-t border-border my-2" />
          <p className="text-xs text-muted-foreground font-mono uppercase">Screenshots</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                label="Screenshot Entrée (TF modèle d'entrée)"
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
          ) : <div />}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || uploading || dateBlocked} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingTrade ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
