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
import { Loader2, Save, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomVariables } from "@/hooks/useCustomVariables";
import { CustomizableMultiSelect } from "./CustomizableMultiSelect";

const ENTRY_MODEL_FIXED_OPTIONS = [
  "Englobante M1", "Englobante M3", "Englobante M5",
  "High-Low 3 bougies", "WICK", "Prise de liquidité",
];
const SETUP_TYPE_FIXED_OPTIONS = ["A", "B", "C"];
const TIMING_FIXED_OPTIONS = ["US Open 15:30", "London Close (16h)"];
const CONTEXT_TIMEFRAME_OPTIONS = ["H4", "H1", "M15"];
const ENTRY_TIMEFRAME_OPTIONS = ["M15", "M5", "M3", "M1", "30s", "15s", "5s"];

interface Trade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  direction_structure: string;
  entry_time: string;
  exit_time: string;
  trade_duration: string;
  rr: number;
  stop_loss_size: string;
  setup_type: string;
  entry_timing: string;
  entry_model: string;
  target_timing: string;
  speculation_hl_valid: boolean;
  target_hl_valid: boolean;
  news_day: boolean;
  news_label: string;
  screenshot_m15_m5: string | null;
  screenshot_m1: string | null;
  contributor?: string;
  sl_placement?: string | null;
  tp_placement?: string | null;
  context_timeframe?: string | null;
  entry_timeframe?: string | null;
  comment?: string | null;
}

interface OracleTradeEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  trade: Trade;
}

const DAYS_MAP: Record<number, string> = {
  0: "Dimanche", 1: "Lundi", 2: "Mardi", 3: "Mercredi",
  4: "Jeudi", 5: "Vendredi", 6: "Samedi",
};

const ScreenshotUploadField = ({
  label, file, preview, existingUrl, uploading, onFileSelect, onClear,
}: {
  label: string; file: File | null; preview: string | null; existingUrl: string | null;
  uploading: boolean; onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentScreenshot = preview || existingUrl;
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />
      {currentScreenshot ? (
        <div className="relative border border-border rounded-md p-2">
          <img src={currentScreenshot} alt={label} className="max-h-32 object-contain mx-auto rounded" />
          <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={onClear}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full h-16 border-dashed gap-2 text-xs" disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {label}
        </Button>
      )}
    </div>
  );
};

export const OracleTradeEditDialog = ({ isOpen, onClose, onSaved, trade }: OracleTradeEditDialogProps) => {
  const [formData, setFormData] = useState({
    trade_date: "", direction: "Long" as "Long" | "Short",
    direction_structure: "", entry_time: "", exit_time: "",
    setup_type: "", entry_model: "", entry_timing: "",
    rr: "", stop_loss_size: "", trade_duration: "",
    target_timing: "", news_day: false, news_label: "",
    comment: "", sl_placement: "", tp_placement: "",
    context_timeframe: "", entry_timeframe: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contextFile, setContextFile] = useState<File | null>(null);
  const [contextPreview, setContextPreview] = useState<string | null>(null);
  const [existingContextUrl, setExistingContextUrl] = useState<string | null>(null);
  const [entryFile, setEntryFile] = useState<File | null>(null);
  const [entryPreview, setEntryPreview] = useState<string | null>(null);
  const [existingEntryUrl, setExistingEntryUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { variables, refetch: refetchVariables } = useCustomVariables();

  useEffect(() => {
    if (isOpen && trade) {
      setFormData({
        trade_date: trade.trade_date,
        direction: trade.direction as "Long" | "Short",
        direction_structure: trade.direction_structure || "",
        entry_time: trade.entry_time || "",
        exit_time: trade.exit_time || "",
        setup_type: trade.setup_type || "",
        entry_model: trade.entry_model || "",
        entry_timing: trade.entry_timing || "",
        rr: trade.rr?.toString() || "",
        stop_loss_size: trade.stop_loss_size || "",
        trade_duration: trade.trade_duration || "",
        target_timing: trade.target_timing || "",
        news_day: trade.news_day || false,
        news_label: trade.news_label || "",
        comment: trade.comment || "",
        sl_placement: trade.sl_placement || "",
        tp_placement: trade.tp_placement || "",
        context_timeframe: trade.context_timeframe || "",
        entry_timeframe: trade.entry_timeframe || "",
      });
      setExistingContextUrl(trade.screenshot_m15_m5 || null);
      setExistingEntryUrl(trade.screenshot_m1 || null);
      setContextFile(null); setContextPreview(null);
      setEntryFile(null); setEntryPreview(null);
    }
  }, [isOpen, trade]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, setFile: (f: File | null) => void, setPreview: (p: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { toast({ title: "Fichier trop volumineux", description: "La taille maximale est de 10 MB.", variant: "destructive" }); return; }
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadScreenshot = async (file: File | null, existingUrl: string | null, suffix: string): Promise<string | null> => {
    if (!file) return existingUrl;
    const fileExt = file.name.split('.').pop();
    const fileName = `oracle/${trade.id}_${suffix}_${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('trade-screenshots').upload(fileName, file, { upsert: true });
    if (error) { console.error(`Upload error:`, error); return existingUrl; }
    return data.path;
  };

  const handleSave = async () => {
    setSaving(true);
    setUploading(true);

    const [contextUrl, entryUrl] = await Promise.all([
      uploadScreenshot(contextFile, existingContextUrl, "context"),
      uploadScreenshot(entryFile, existingEntryUrl, "entry"),
    ]);
    setUploading(false);

    const date = new Date(formData.trade_date);
    const dayOfWeek = DAYS_MAP[date.getDay()] || "Inconnu";

    const updateData: any = {
      trade_date: formData.trade_date,
      day_of_week: dayOfWeek,
      direction: formData.direction,
      direction_structure: formData.direction_structure || null,
      entry_time: formData.entry_time || null,
      exit_time: formData.exit_time || null,
      trade_duration: formData.trade_duration || null,
      setup_type: formData.setup_type || null,
      entry_model: formData.entry_model || null,
      entry_timing: formData.entry_timing || null,
      rr: formData.rr ? parseFloat(formData.rr) : null,
      stop_loss_size: formData.stop_loss_size || null,
      target_timing: formData.target_timing || null,
      news_day: formData.news_day,
      news_label: formData.news_day ? (formData.news_label || null) : null,
      comment: formData.comment || null,
      screenshot_m15_m5: contextUrl,
      screenshot_m1: entryUrl,
      sl_placement: formData.sl_placement || null,
      tp_placement: formData.tp_placement || null,
      context_timeframe: formData.context_timeframe || null,
      entry_timeframe: formData.entry_timeframe || null,
    };

    try {
      const { error } = await supabase.from("trades").update(updateData).eq("id", trade.id);
      if (error) throw error;
      toast({ title: "Trade mis à jour", description: "Les modifications ont été enregistrées." });
      onSaved();
    } catch (error: any) {
      console.error("Error updating trade:", error);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[calc(100vw-1rem)] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Modifier — {new Date(trade.trade_date).toLocaleDateString("fr-FR")} • {trade.direction}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* INFORMATIONS */}
          <p className="text-xs text-muted-foreground font-mono uppercase border-b border-border pb-1">Informations</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <DatePicker value={formData.trade_date} onChange={(v) => setFormData({ ...formData, trade_date: v })} />
            </div>
            <div className="space-y-2">
              <Label>Direction *</Label>
              <Select value={formData.direction} onValueChange={(v: "Long" | "Short") => setFormData({ ...formData, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* PARAMÈTRES DU SETUP */}
          <p className="text-xs text-muted-foreground font-mono uppercase border-b border-border pb-1 mt-2">Paramètres du Setup</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Structure</Label>
              <CustomizableMultiSelect value={formData.direction_structure} onChange={(v) => setFormData({ ...formData, direction_structure: v })} customOptions={variables.direction_structure} variableType="direction_structure" placeholder="Sélectionner..." onOptionsChanged={refetchVariables} />
            </div>
            <div className="space-y-2">
              <Label>Type de Setup</Label>
              <CustomizableMultiSelect value={formData.setup_type} onChange={(v) => setFormData({ ...formData, setup_type: v })} fixedOptions={SETUP_TYPE_FIXED_OPTIONS} customOptions={variables.setup_type} variableType="setup_type" placeholder="Sélectionner..." onOptionsChanged={refetchVariables} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Entry Model</Label>
              <CustomizableMultiSelect value={formData.entry_model} onChange={(v) => setFormData({ ...formData, entry_model: v })} fixedOptions={ENTRY_MODEL_FIXED_OPTIONS} customOptions={variables.entry_model} variableType="entry_model" placeholder="Sélectionner..." onOptionsChanged={refetchVariables} />
            </div>
            <div className="space-y-2">
              <Label>Timing</Label>
              <CustomizableMultiSelect value={formData.entry_timing} onChange={(v) => setFormData({ ...formData, entry_timing: v })} fixedOptions={TIMING_FIXED_OPTIONS} customOptions={variables.entry_timing} variableType="entry_timing" placeholder="Sélectionner..." onOptionsChanged={refetchVariables} />
            </div>
          </div>

          {/* PLACEMENT SL / TP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Placement du SL</Label>
              <CustomizableMultiSelect value={formData.sl_placement} onChange={(v) => setFormData({ ...formData, sl_placement: v })} customOptions={variables.sl_placement || []} variableType="sl_placement" placeholder="Sélectionner..." onOptionsChanged={refetchVariables} />
            </div>
            <div className="space-y-2">
              <Label>Placement du TP</Label>
              <CustomizableMultiSelect value={formData.tp_placement} onChange={(v) => setFormData({ ...formData, tp_placement: v })} customOptions={variables.tp_placement || []} variableType="tp_placement" placeholder="Sélectionner..." onOptionsChanged={refetchVariables} />
            </div>
          </div>

          {/* EXÉCUTION */}
          <p className="text-xs text-muted-foreground font-mono uppercase border-b border-border pb-1 mt-2">Exécution</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Heure d'entrée</Label>
              <TimePicker value={formData.entry_time} onChange={(v) => setFormData({ ...formData, entry_time: v })} />
            </div>
            <div className="space-y-2">
              <Label>Heure de sortie</Label>
              <TimePicker value={formData.exit_time} onChange={(v) => setFormData({ ...formData, exit_time: v })} />
            </div>
            <div className="space-y-2">
              <Label>RR</Label>
              <Input type="number" step="0.01" value={formData.rr} onChange={(e) => setFormData({ ...formData, rr: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Taille du SL</Label>
              <Input value={formData.stop_loss_size} onChange={(e) => setFormData({ ...formData, stop_loss_size: e.target.value })} placeholder="Taille du stop loss en points/pips" />
            </div>
            <div className="space-y-2">
              <Label>Durée du trade</Label>
              <Input value={formData.trade_duration} onChange={(e) => setFormData({ ...formData, trade_duration: e.target.value })} />
            </div>
          </div>

          {/* NEWS */}
          <div className="flex items-center gap-3 mt-2">
            <Checkbox id="news_edit" checked={formData.news_day} onCheckedChange={(c) => setFormData({ ...formData, news_day: !!c })} />
            <Label htmlFor="news_edit" className="cursor-pointer">Jour de news</Label>
          </div>
          {formData.news_day && (
            <Input value={formData.news_label} onChange={(e) => setFormData({ ...formData, news_label: e.target.value })} placeholder="NFP, CPI, FOMC..." />
          )}

          {/* SCREENSHOTS */}
          <p className="text-xs text-muted-foreground font-mono uppercase border-b border-border pb-1 mt-2">Screenshots</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <ScreenshotUploadField
                label="Screenshot Contexte"
                file={contextFile} preview={contextPreview} existingUrl={existingContextUrl} uploading={uploading}
                onFileSelect={(e) => handleFileSelect(e, setContextFile, setContextPreview)}
                onClear={() => { setContextFile(null); setContextPreview(null); setExistingContextUrl(null); }}
              />
              <Select value={formData.context_timeframe} onValueChange={(v) => setFormData({ ...formData, context_timeframe: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Time frame" /></SelectTrigger>
                <SelectContent>
                  {CONTEXT_TIMEFRAME_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <ScreenshotUploadField
                label="Screenshot Entrée"
                file={entryFile} preview={entryPreview} existingUrl={existingEntryUrl} uploading={uploading}
                onFileSelect={(e) => handleFileSelect(e, setEntryFile, setEntryPreview)}
                onClear={() => { setEntryFile(null); setEntryPreview(null); setExistingEntryUrl(null); }}
              />
              <Select value={formData.entry_timeframe} onValueChange={(v) => setFormData({ ...formData, entry_timeframe: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Time frame" /></SelectTrigger>
                <SelectContent>
                  {ENTRY_TIMEFRAME_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* NOTES */}
          <p className="text-xs text-muted-foreground font-mono uppercase border-b border-border pb-1 mt-2">Notes</p>
          <Textarea value={formData.comment} onChange={(e) => setFormData({ ...formData, comment: e.target.value })} placeholder="Observations..." rows={3} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || uploading} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
