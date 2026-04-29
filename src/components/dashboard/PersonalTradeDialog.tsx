/**
 * PersonalTradeDialog — v2
 * Layout repensé (même style qu'OracleTradeDialog v2). Logique métier inchangée.
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Save, Trash2, X, Image as ImageIcon,
  Clock, Lock, Link as LinkIcon,
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

// ── Options locales non-gérables (sélecteurs internes) ────────────────────────
// Les options des dropdowns trade (setup_type, entry_model, etc.) sont entièrement
// gérées en DB (user_custom_variables). Seed → migration 20260429250000.
const CONTEXT_TIMEFRAME_OPTIONS   = ["H4", "H1", "M15"];
const ENTRY_TF_SCREENSHOT_OPTIONS = ["M15", "M5", "M3", "M1", "30s", "15s", "5s"];

// ── Types ──────────────────────────────────────────────────────────────────────
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
  sessionId?: string;
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

// ── Duration calculator ────────────────────────────────────────────────────────
function calculateDuration(
  entryDate: string, entryTime: string,
  exitDate: string, exitTime: string,
): string {
  if (!entryDate || !entryTime || !exitDate || !exitTime) return "";
  try {
    const entry = new Date(`${entryDate}T${entryTime}:00`);
    const exit  = new Date(`${exitDate}T${exitTime}:00`);
    const diffMs = exit.getTime() - entry.getTime();
    if (diffMs < 0) return "";
    const totalMinutes = Math.floor(diffMs / 60000);
    const days    = Math.floor(totalMinutes / 1440);
    const hours   = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts: string[] = [];
    if (days > 0)   parts.push(`${days}j`);
    if (hours > 0)  parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);
    return parts.join(" ");
  } catch {
    return "";
  }
}

// ── TradingView embed helper ───────────────────────────────────────────────────
function getTradingViewEmbedUrl(url: string): string | null {
  if (!url) return null;
  if (url.includes("tradingview.com/x/") || url.includes("tradingview.com/chart/")) return url;
  return null;
}

// ── Local helper components ────────────────────────────────────────────────────
const SectionHeader = ({
  label,
  extra,
}: {
  label: string;
  extra?: React.ReactNode;
}) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/35">{label}</span>
    <div className="flex-1 h-px bg-white/[.06]" />
    {extra}
  </div>
);

const Field = ({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] font-medium text-foreground/55 leading-none">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const ScreenshotUploadField = ({
  label,
  file,
  preview,
  existingUrl,
  uploading,
  required,
  onFileSelect,
  onClear,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  existingUrl: string | null;
  uploading: boolean;
  required?: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const current = preview || existingUrl;
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-foreground/55 leading-none">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />
      {current ? (
        <div className="relative rounded-lg border border-white/[.10] bg-white/[.02] p-2">
          <img src={current} alt={label} className="max-h-36 object-contain mx-auto rounded" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-destructive/80 hover:bg-destructive flex items-center justify-center transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-20 rounded-lg border border-dashed border-white/[.12] bg-white/[.02] hover:bg-white/[.04] hover:border-white/[.20] transition-all flex flex-col items-center justify-center gap-1.5 text-foreground/30 hover:text-foreground/50"
        >
          {uploading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <ImageIcon className="w-4 h-4" />}
          <span className="text-[11px]">{label}</span>
        </button>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const PersonalTradeDialog = ({
  isOpen,
  onClose,
  onSaved,
  editingTrade,
  nextTradeNumber,
  customSetupId,
  sessionId,
}: PersonalTradeDialogProps) => {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin]   = useState(false);

  const [contextFile, setContextFile]     = useState<File | null>(null);
  const [contextPreview, setContextPreview] = useState<string | null>(null);
  const [existingContextUrl, setExistingContextUrl] = useState<string | null>(null);

  const [entryFile, setEntryFile]       = useState<File | null>(null);
  const [entryPreview, setEntryPreview] = useState<string | null>(null);
  const [existingEntryUrl, setExistingEntryUrl] = useState<string | null>(null);

  const { toast } = useToast();
  const { globalVariables, personalVariables, refetch: refetchVariables } = useCustomVariables();

  // Admin check — détermine si l'utilisateur peut gérer les options des dropdowns
  useEffect(() => {
    Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_super_admin"),
    ]).then(([{ data: admin }, { data: superAdmin }]) => {
      setIsAdmin(!!admin || !!superAdmin);
    });
  }, []);

  const tradeDuration = calculateDuration(
    formData.trade_date, formData.entry_time,
    formData.exit_date,  formData.exit_time,
  );

  // ── Reset on open ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (editingTrade) {
      setFormData({
        trade_number:       editingTrade.trade_number.toString(),
        trade_date:         editingTrade.trade_date,
        exit_date:          editingTrade.exit_date || editingTrade.trade_date,
        direction:          editingTrade.direction as "Long" | "Short",
        direction_structure: editingTrade.direction_structure || "",
        entry_time:         editingTrade.entry_time || "",
        exit_time:          editingTrade.exit_time  || "",
        setup_type:         editingTrade.setup_type  || "",
        entry_model:        editingTrade.entry_model || "",
        entry_timing:       editingTrade.entry_timing || "",
        entry_timeframe:    (editingTrade as any).entry_timeframe || "",
        rr:                 editingTrade.rr?.toString() || "",
        entry_price:        editingTrade.entry_price?.toString()  || "",
        exit_price:         editingTrade.exit_price?.toString()   || "",
        stop_loss:          editingTrade.stop_loss?.toString()    || "",
        take_profit:        editingTrade.take_profit?.toString()  || "",
        result:             (editingTrade.result as "Win" | "Loss" | "BE") || "",
        notes:              editingTrade.comment || "",
        news_day:           editingTrade.news_day || false,
        news_label:         editingTrade.news_label || "",
        chart_link:         editingTrade.chart_link || "",
        sl_placement:       (editingTrade as any).sl_placement || "",
        tp_placement:       (editingTrade as any).tp_placement || "",
        context_timeframe:  (editingTrade as any).context_timeframe || "",
        screenshot_entry_timeframe: "",
        stop_loss_size:     editingTrade.stop_loss_size || "",
        asset:              (editingTrade as any).asset || "",
      });
      setExistingContextUrl(editingTrade.screenshot_context_url || editingTrade.screenshot_url || null);
      setExistingEntryUrl(editingTrade.screenshot_entry_url || null);
    } else {
      const today = new Date().toISOString().split("T")[0];
      setFormData({ ...initialFormData, trade_number: nextTradeNumber.toString(), trade_date: today, exit_date: today });
      setExistingContextUrl(null);
      setExistingEntryUrl(null);
    }
    setContextFile(null); setContextPreview(null);
    setEntryFile(null);   setEntryPreview(null);
  }, [isOpen, editingTrade, nextTradeNumber]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const set = (key: keyof FormData, value: any) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const handleEntryDateChange = (newDate: string) => {
    setFormData(prev => ({
      ...prev,
      trade_date: newDate,
      exit_date: (!prev.exit_date || prev.exit_date === prev.trade_date) ? newDate : prev.exit_date,
    }));
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux", description: "Max 10 MB.", variant: "destructive" });
      return;
    }
    setFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadScreenshot = async (
    userId: string, tradeNumber: number,
    file: File | null, existingUrl: string | null, suffix: string,
  ): Promise<string | null> => {
    if (!file) return existingUrl;
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/perso_${tradeNumber}_${suffix}_${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from('trade-screenshots').upload(fileName, file, { upsert: true });
    if (error) { console.error(`Error uploading ${suffix}:`, error); return existingUrl; }
    return data.path;
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // ── Validation champs requis ────────────────────────────────────────────────
    const missingFields: string[] = [];
    if (!formData.trade_number)        missingFields.push("N° Trade");
    if (!formData.trade_date)          missingFields.push("Date Entrée");
    if (!formData.exit_date)           missingFields.push("Date Sortie");
    if (!formData.direction)           missingFields.push("Direction");
    if (!formData.asset)               missingFields.push("Actif concerné");
    if (!formData.setup_type)          missingFields.push("Type de Config.");
    if (!formData.direction_structure) missingFields.push("Contexte");
    if (!formData.entry_model)         missingFields.push("Entry Model");
    if (!formData.result)              missingFields.push("Résultat");
    if (!formData.rr)                  missingFields.push("RR");
    if (!formData.entry_time)          missingFields.push("Heure Entrée");
    if (!formData.exit_time)           missingFields.push("Heure Sortie");
    if (!formData.stop_loss_size)      missingFields.push("Taille du SL");
    const hasContextScreenshot = !!contextFile || !!existingContextUrl;
    const hasEntryScreenshot   = !!entryFile   || !!existingEntryUrl;
    if (!hasContextScreenshot || !hasEntryScreenshot) missingFields.push("Screenshots (Contexte + Entrée)");
    if (missingFields.length > 0) {
      toast({
        title: "Champs requis manquants",
        description: missingFields.join(", "),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    setUploading(true);

    const tradeNum = parseInt(formData.trade_number);
    const [contextUrl, entryUrl] = await Promise.all([
      uploadScreenshot(user.id, tradeNum, contextFile, existingContextUrl, "context"),
      uploadScreenshot(user.id, tradeNum, entryFile,   existingEntryUrl,   "entry"),
    ]);
    setUploading(false);

    const dayOfWeek = DAYS_MAP[new Date(formData.trade_date).getDay()] || "Inconnu";

    const tradeData = {
      user_id:        user.id,
      trade_number:   tradeNum,
      trade_date:     formData.trade_date,
      exit_date:      formData.exit_date  || null,
      day_of_week:    dayOfWeek,
      direction:      formData.direction,
      direction_structure: formData.direction_structure || null,
      entry_time:     formData.entry_time  || null,
      exit_time:      formData.exit_time   || null,
      trade_duration: tradeDuration        || null,
      setup_type:     formData.setup_type  || null,
      entry_model:    formData.entry_model || null,
      entry_timing:   formData.entry_timing || null,
      entry_timeframe: formData.entry_timeframe || null,
      rr:             formData.rr          ? parseFloat(formData.rr)          : null,
      entry_price:    formData.entry_price ? parseFloat(formData.entry_price) : null,
      exit_price:     formData.exit_price  ? parseFloat(formData.exit_price)  : null,
      stop_loss:      formData.stop_loss   ? parseFloat(formData.stop_loss)   : null,
      take_profit:    formData.take_profit ? parseFloat(formData.take_profit) : null,
      result:         formData.result      || null,
      comment:        formData.notes       || null,
      news_day:       formData.news_day,
      news_label:     formData.news_day ? (formData.news_label || null) : null,
      screenshot_context_url: contextUrl,
      screenshot_entry_url:   entryUrl,
      screenshot_url:         contextUrl, // backward compat
      chart_link:     formData.chart_link  || null,
      sl_placement:   formData.sl_placement || null,
      tp_placement:   formData.tp_placement || null,
      context_timeframe: formData.context_timeframe || null,
      stop_loss_size: formData.stop_loss_size || null,
      asset:          formData.asset       || null,
      custom_setup_id: customSetupId       || null,
      session_id:     sessionId            || null,
    } as any;

    try {
      if (editingTrade) {
        const { error } = await supabase.from("user_personal_trades").update(tradeData).eq("id", editingTrade.id);
        if (error) throw error;
        toast({ title: "Trade mis à jour", description: `Trade #${formData.trade_number} modifié.` });
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
        toast({ title: "Trade ajouté", description: `Trade #${formData.trade_number} créé.` });
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
      toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
    } else {
      toast({ title: "Trade supprimé", description: `Trade #${editingTrade.trade_number} supprimé.` });
      onSaved();
    }
  };

  const embedUrl = getTradingViewEmbedUrl(formData.chart_link);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >

        {/* ── HEADER ── */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/[.07] shrink-0 flex items-center gap-3">
          <DialogTitle className="text-[15px] font-semibold tracking-tight">
            {editingTrade ? `Trade Perso #${editingTrade.trade_number}` : "Nouveau Trade Perso"}
          </DialogTitle>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6">

          {/* ── INFORMATIONS ── */}
          <div className="space-y-3">
            <SectionHeader label="Informations" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="N° Trade" required>
                {editingTrade ? (
                  <div className="flex items-center h-9 rounded-md border border-white/[.12] bg-white/[.03] px-3 text-sm font-mono text-foreground/60 gap-1.5">
                    <Lock className="w-3 h-3 shrink-0 text-foreground/25" />
                    {formData.trade_number}
                  </div>
                ) : (
                  <Input
                    type="number"
                    value={formData.trade_number}
                    onChange={(e) => set("trade_number", e.target.value)}
                    className="h-9 font-mono"
                  />
                )}
              </Field>
              <Field label="Date Entrée" required>
                <DatePicker
                  value={formData.trade_date}
                  onChange={handleEntryDateChange}
                />
              </Field>
              <Field label="Date Sortie" required>
                <DatePicker
                  value={formData.exit_date}
                  onChange={(v) => set("exit_date", v)}
                />
              </Field>
              <Field label="Direction" required>
                <div className="relative flex h-9 rounded-md border border-white/[.12] bg-white/[.03] p-0.5 overflow-hidden">
                  <div className={cn(
                    "absolute inset-y-0.5 w-[calc(50%-2px)] rounded-[5px] transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)]",
                    formData.direction === "Long"
                      ? "left-0.5 bg-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                      : "left-[calc(50%+1px)] bg-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.25)]",
                  )} />
                  <button type="button" onClick={() => set("direction", "Long")}
                    className={cn(
                      "relative flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-[5px] transition-colors duration-200 z-10",
                      formData.direction === "Long" ? "text-emerald-400" : "text-foreground/35 hover:text-foreground/60",
                    )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300",
                      formData.direction === "Long" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-foreground/20",
                    )} />
                    Long
                  </button>
                  <button type="button" onClick={() => set("direction", "Short")}
                    className={cn(
                      "relative flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-[5px] transition-colors duration-200 z-10",
                      formData.direction === "Short" ? "text-rose-400" : "text-foreground/35 hover:text-foreground/60",
                    )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300",
                      formData.direction === "Short" ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]" : "bg-foreground/20",
                    )} />
                    Short
                  </button>
                </div>
              </Field>
            </div>
            {/* Actif — full width row */}
            <Field label="Actif concerné" required>
              <Input
                value={formData.asset}
                onChange={(e) => set("asset", e.target.value)}
                placeholder="Ex: NAS100, EUR/USD, GOLD, BTC…"
                className="h-9"
              />
            </Field>
          </div>

          {/* ── PARAMÈTRES DU SETUP ── */}
          <div className="space-y-3">
            <SectionHeader label="Paramètres du Setup" />
            {/* 5 colonnes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Field label="Type de Config.">
                <CustomizableMultiSelect
                  compact singleSelect canManage={isAdmin}
                  value={formData.setup_type}
                  onChange={(v) => set("setup_type", v)}
                  globalOptions={globalVariables.setup_type}
                  personalOptions={personalVariables.setup_type}
                  variableType="setup_type"
                  placeholder="Sélectionne..."
                  onOptionsChanged={refetchVariables}
                />
              </Field>
              <Field label="Contexte">
                <CustomizableMultiSelect
                  compact singleSelect canManage={isAdmin}
                  value={formData.direction_structure}
                  onChange={(v) => set("direction_structure", v)}
                  globalOptions={globalVariables.direction_structure}
                  personalOptions={personalVariables.direction_structure}
                  variableType="direction_structure"
                  placeholder="Sélectionne..."
                  onOptionsChanged={refetchVariables}
                />
              </Field>
              <Field label="Entry Model">
                <CustomizableMultiSelect
                  compact canManage={isAdmin}
                  value={formData.entry_model}
                  onChange={(v) => set("entry_model", v)}
                  globalOptions={globalVariables.entry_model}
                  personalOptions={personalVariables.entry_model}
                  variableType="entry_model"
                  placeholder="Sélectionne..."
                  onOptionsChanged={refetchVariables}
                />
              </Field>
              <Field label="Timing">
                <CustomizableMultiSelect
                  compact singleSelect canManage={isAdmin}
                  value={formData.entry_timing}
                  onChange={(v) => set("entry_timing", v)}
                  globalOptions={globalVariables.entry_timing}
                  personalOptions={personalVariables.entry_timing}
                  variableType="entry_timing"
                  placeholder="Sélectionne..."
                  onOptionsChanged={refetchVariables}
                />
              </Field>
              <Field label="Time Frame d'entrée">
                <CustomizableMultiSelect
                  compact singleSelect canManage={isAdmin}
                  value={formData.entry_timeframe}
                  onChange={(v) => set("entry_timeframe", v)}
                  globalOptions={globalVariables.entry_timeframe}
                  personalOptions={personalVariables.entry_timeframe}
                  variableType="entry_timeframe"
                  placeholder="Sélectionne..."
                  onOptionsChanged={refetchVariables}
                />
              </Field>
            </div>
            {/* Placement SL/TP */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Placement du SL">
                <CustomizableMultiSelect
                  singleSelect canManage={isAdmin}
                  value={formData.sl_placement}
                  onChange={(v) => set("sl_placement", v)}
                  globalOptions={globalVariables.sl_placement || []}
                  personalOptions={personalVariables.sl_placement || []}
                  variableType="sl_placement"
                  placeholder="Sélectionner..."
                  onOptionsChanged={refetchVariables}
                />
              </Field>
              <Field label="Placement du TP">
                <CustomizableMultiSelect
                  singleSelect canManage={isAdmin}
                  value={formData.tp_placement}
                  onChange={(v) => set("tp_placement", v)}
                  globalOptions={globalVariables.tp_placement || []}
                  personalOptions={personalVariables.tp_placement || []}
                  variableType="tp_placement"
                  placeholder="Sélectionner..."
                  onOptionsChanged={refetchVariables}
                />
              </Field>
            </div>
          </div>

          {/* ── EXÉCUTION ── */}
          <div className="space-y-3">
            <SectionHeader label="Exécution" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Heure Entrée" required>
                <TimePicker value={formData.entry_time} onChange={(v) => set("entry_time", v)} />
              </Field>
              <Field label="Heure Sortie" required>
                <TimePicker value={formData.exit_time}  onChange={(v) => set("exit_time", v)} />
              </Field>
              <Field label="Résultat" required>
                <Select
                  value={formData.result}
                  onValueChange={(v: "Win" | "Loss" | "BE" | "") => set("result", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Win">Win</SelectItem>
                    <SelectItem value="Loss">Loss</SelectItem>
                    <SelectItem value="BE">BE (Break Even)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="RR" required>
                <Input
                  type="number" step="0.01"
                  value={formData.rr}
                  onChange={(e) => set("rr", e.target.value)}
                  placeholder="Ex: 2.5"
                  className="h-9"
                />
              </Field>
            </div>
            <div className={cn(
              "flex items-center gap-2 text-xs font-mono transition-colors",
              tradeDuration ? "text-foreground/50" : "text-foreground/25",
            )}>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Durée : <span className={tradeDuration ? "text-foreground/70 font-semibold" : ""}>{tradeDuration || "—"}</span></span>
            </div>
          </div>

          {/* ── COMPLÉMENT ── */}
          <div className="space-y-3">
            <SectionHeader label="Complément" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <Field label="Taille du SL" required>
                <Input
                  value={formData.stop_loss_size}
                  onChange={(e) => set("stop_loss_size", e.target.value)}
                  placeholder="Taille du stop loss en points/pips"
                  className="h-9"
                />
              </Field>
              <div className="space-y-2 pt-[22px]">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id="news_day_personal"
                    checked={formData.news_day}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev, news_day: !!checked, news_label: !!checked ? prev.news_label : "",
                    }))}
                  />
                  <Label htmlFor="news_day_personal" className="text-sm cursor-pointer">Jour de news</Label>
                </div>
                {formData.news_day && (
                  <Input
                    value={formData.news_label}
                    onChange={(e) => set("news_label", e.target.value)}
                    placeholder="Ex: NFP, CPI, FOMC..."
                    className="h-9"
                  />
                )}
              </div>
            </div>
          </div>

          {/* ── DONNÉES MANUELLES (optionnel) ── */}
          <div className="space-y-3">
            <SectionHeader
              label="Données Manuelles"
              extra={<span className="text-[10px] text-foreground/25 font-mono shrink-0">optionnel</span>}
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Prix Entrée">
                <Input type="number" step="0.00001" value={formData.entry_price}
                  onChange={(e) => set("entry_price", e.target.value)}
                  placeholder="Ex: 1.08542" className="h-9" />
              </Field>
              <Field label="Prix Sortie">
                <Input type="number" step="0.00001" value={formData.exit_price}
                  onChange={(e) => set("exit_price", e.target.value)}
                  placeholder="Ex: 1.08650" className="h-9" />
              </Field>
              <Field label="Stop Loss">
                <Input type="number" step="0.00001" value={formData.stop_loss}
                  onChange={(e) => set("stop_loss", e.target.value)}
                  placeholder="Ex: 1.08500" className="h-9" />
              </Field>
              <Field label="Take Profit">
                <Input type="number" step="0.00001" value={formData.take_profit}
                  onChange={(e) => set("take_profit", e.target.value)}
                  placeholder="Ex: 1.08700" className="h-9" />
              </Field>
            </div>
          </div>

          {/* ── SCREENSHOTS ── */}
          <div className="space-y-3">
            <SectionHeader label="Screenshots" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <ScreenshotUploadField
                  label="Contexte"
                  file={contextFile}
                  preview={contextPreview}
                  existingUrl={existingContextUrl}
                  uploading={uploading}
                  required
                  onFileSelect={(e) => handleFileSelect(e, setContextFile, setContextPreview)}
                  onClear={() => { setContextFile(null); setContextPreview(null); setExistingContextUrl(null); }}
                />
                <Select value={formData.context_timeframe} onValueChange={(v) => set("context_timeframe", v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Time frame contexte" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTEXT_TIMEFRAME_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <ScreenshotUploadField
                  label="Entrée (TF modèle d'entrée)"
                  file={entryFile}
                  preview={entryPreview}
                  existingUrl={existingEntryUrl}
                  uploading={uploading}
                  required
                  onFileSelect={(e) => handleFileSelect(e, setEntryFile, setEntryPreview)}
                  onClear={() => { setEntryFile(null); setEntryPreview(null); setExistingEntryUrl(null); }}
                />
                <Select value={formData.screenshot_entry_timeframe} onValueChange={(v) => set("screenshot_entry_timeframe", v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Time frame entrée" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_TF_SCREENSHOT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── LIEN GRAPHIQUE ── */}
          <div className="space-y-3">
            <SectionHeader
              label="Lien Graphique"
              extra={<span className="text-[10px] text-foreground/25 font-mono shrink-0">optionnel</span>}
            />
            <Field label="TradingView / FX Replay">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 shrink-0 text-foreground/30" />
                <Input
                  value={formData.chart_link}
                  onChange={(e) => set("chart_link", e.target.value)}
                  placeholder="https://www.tradingview.com/chart/…"
                  className="h-9 flex-1"
                />
              </div>
            </Field>
            {embedUrl && (
              <div className="rounded-lg border border-white/[.10] overflow-hidden">
                <iframe
                  src={embedUrl}
                  className="w-full h-48"
                  title="TradingView Chart"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            )}
          </div>

          {/* ── NOTES ── */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-foreground/55 leading-none">Notes</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Observations, contexte du trade..."
              rows={3}
              className="resize-y min-h-[80px]"
            />
          </div>

        </div>{/* /scrollable body */}

        {/* ── FOOTER ── */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-white/[.07] flex items-center justify-between shrink-0 gap-2">
          {editingTrade ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1.5 h-8 text-xs">
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
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
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 h-9 px-4">
              <X className="w-3.5 h-3.5" /> Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving || uploading ||
                !formData.trade_number || !formData.trade_date || !formData.exit_date ||
                !formData.direction || !formData.asset || !formData.setup_type ||
                !formData.direction_structure || !formData.entry_model ||
                !formData.result || !formData.rr || !formData.entry_time ||
                !formData.exit_time || !formData.stop_loss_size ||
                !((contextFile || existingContextUrl) && (entryFile || existingEntryUrl))
              }
              size="sm"
              className="gap-1.5 h-9 px-5"
            >
              {saving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Save className="w-3.5 h-3.5" />}
              Enregistrer
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};
