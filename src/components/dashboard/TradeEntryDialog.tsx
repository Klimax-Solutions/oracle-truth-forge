/**
 * src/components/dashboard/TradeEntryDialog.tsx
 *
 * Composant partagé Trade UI — Phase 3.
 * Dialog de saisie / édition — Oracle et Personal.
 * Basé sur OracleTradeDialog v2 avec prop `mode`.
 *
 * Différences par mode :
 *   oracle  : hard validation, readOnly lock, pas de bouton delete en création,
 *             champ notes, stocke dans user_executions
 *   personal: soft validation (warn si RR vide), delete visible en édition,
 *             champ commentaire + actif, stocke dans user_personal_trades
 *
 * Règles :
 *   R1 : Aucune logique de vérification/cycle ici — injectée par le parent
 *   R2 : Discriminated union — aucune perte de champ
 *
 * Spec : docs/trade-ui-components-2026-04-30.md §5 Phase 3
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
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Save, Trash2, X, Image as ImageIcon,
  Clock, Lock,
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
import { useUserRoles } from "@/hooks/useUserRoles";
import { TradeCardData, isOracleTrade, isPersonalTrade } from "@/lib/trade/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const sanitizeDecimal = (v: string) =>
  v.replace(/,/g, ".").replace(/[^0-9.]/g, "").replace(/\.(?=.*\.)/g, "");

const DAYS_MAP: Record<number, string> = {
  0: "Dimanche", 1: "Lundi", 2: "Mardi", 3: "Mercredi",
  4: "Jeudi", 5: "Vendredi", 6: "Samedi",
};

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
    if (days > 0)    parts.push(`${days}j`);
    if (hours > 0)   parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);
    return parts.join(" ");
  } catch { return ""; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft helpers — persiste le brouillon dans localStorage pour survivre aux
// changements d'onglet navigateur, rechargements accidentels, etc.
// Clé séparée par mode pour éviter les collisions oracle / personal.
// ─────────────────────────────────────────────────────────────────────────────

const DRAFT_KEY_ORACLE   = "oracle_trade_draft";
const DRAFT_KEY_PERSONAL = "personal_trade_draft";
const getDraftKey = (mode: "oracle" | "personal") => mode === "oracle" ? DRAFT_KEY_ORACLE : DRAFT_KEY_PERSONAL;
const saveDraft    = (mode: "oracle" | "personal", data: FormData) => { try { localStorage.setItem(getDraftKey(mode), JSON.stringify(data)); } catch {} };
const loadDraft    = (mode: "oracle" | "personal"): FormData | null => { try { const r = localStorage.getItem(getDraftKey(mode)); return r ? JSON.parse(r) : null; } catch { return null; } };
const clearDraft   = (mode: "oracle" | "personal") => { try { localStorage.removeItem(getDraftKey(mode)); } catch {} };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
  notes: string;        // oracle
  comment: string;      // personal
  news_day: boolean;
  news_label: string;
  sl_placement: string;
  tp_placement: string;
  context_timeframe: string;
  stop_loss_size: string;
  asset: string;        // personal
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
  comment: "",
  news_day: false,
  news_label: "",
  sl_placement: "",
  tp_placement: "",
  context_timeframe: "",
  stop_loss_size: "",
  asset: "",
};

export interface TradeEntryDialogProps {
  /** oracle | personal */
  mode: "oracle" | "personal";
  isOpen: boolean;
  onClose: () => void;
  /** Appelé après save ou delete — le parent refetch */
  onSaved: () => void;
  /** null → création, TradeCardData → édition */
  editingTrade: TradeCardData | null;
  nextTradeNumber: number;
  /** Oracle only */
  currentCycleNum?: number | null;
  /** Oracle only — lecture seule si vérification en cours */
  readOnly?: boolean;
  /** Personal only — session parente */
  sessionId?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader = ({ label, extra }: { label: string; extra?: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-foreground/45 shrink-0 select-none">
      {label}
    </span>
    <div className="flex-1 h-px bg-gradient-to-r from-white/[.10] via-white/[.04] to-transparent" />
    {extra}
  </div>
);

const Field = ({ label, required, children, className }: {
  label: string; required?: boolean; children: React.ReactNode; className?: string;
}) => (
  <div className={cn("space-y-2 min-w-0", className)}>
    <label className="block text-xs font-medium text-foreground/60 leading-none">
      {label}
      {required && <span className="text-destructive/80 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const ScreenshotUploadField = ({
  label, file, preview, existingUrl, uploading, onFileSelect, onClear, required,
  linkUrl, onLinkUrlChange,
}: {
  label: string; file: File | null; preview: string | null; existingUrl: string | null;
  uploading: boolean; onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void; required?: boolean;
  /** URL saisie en mode lien (optionnel — si absent, le toggle lien est masqué) */
  linkUrl?: string;
  /** Callback quand l'URL change en mode lien */
  onLinkUrlChange?: (url: string) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<"file" | "link">(
    // Si existingUrl est un lien externe → ouvrir en mode lien
    existingUrl && (existingUrl.startsWith("http://") || existingUrl.startsWith("https://")) ? "link" : "file"
  );
  const current = preview || existingUrl;
  // En mode lien, l'URL est soit linkUrl (saisie en cours) soit existingUrl (existant)
  const effectiveLinkUrl = linkUrl || (inputMode === "link" ? existingUrl : null);
  const isExternalUrl = (url: string | null) => url?.startsWith("http://") || url?.startsWith("https://");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-foreground/60 leading-none">
          {label}
          {required && <span className="text-destructive/80 ml-0.5">*</span>}
        </label>
        {onLinkUrlChange && (
          <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-white/[.04] border border-white/[.08]">
            <button
              type="button"
              onClick={() => setInputMode("file")}
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors",
                inputMode === "file"
                  ? "bg-white/[.12] text-foreground/80"
                  : "text-foreground/30 hover:text-foreground/50"
              )}
              title="Uploader un fichier"
            >
              📁
            </button>
            <button
              type="button"
              onClick={() => setInputMode("link")}
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors",
                inputMode === "link"
                  ? "bg-white/[.12] text-foreground/80"
                  : "text-foreground/30 hover:text-foreground/50"
              )}
              title="Coller un lien (TradingView, Lightshot...)"
            >
              🔗
            </button>
          </div>
        )}
      </div>

      {inputMode === "link" && onLinkUrlChange ? (
        /* ── Mode lien : input URL ── */
        <div className="space-y-2">
          <Input
            type="url"
            value={linkUrl ?? ""}
            onChange={(e) => onLinkUrlChange(e.target.value)}
            placeholder="https://www.tradingview.com/x/..."
            className="h-9 text-xs border-white/[.18] bg-white/[.04]"
          />
          {effectiveLinkUrl && isExternalUrl(effectiveLinkUrl) && (
            <div className="relative border border-white/[.12] rounded-xl p-2.5 bg-white/[.02]">
              <img
                src={effectiveLinkUrl}
                alt={label}
                className="max-h-48 w-full object-contain rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <p className="text-[9px] text-foreground/30 mt-1 truncate">{effectiveLinkUrl}</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Mode fichier : upload classique ── */
        <>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />
          {current && !isExternalUrl(current) ? (
            <div className="relative border border-white/[.12] rounded-xl p-2.5 bg-white/[.02]">
              <img src={current} alt={label} className="max-h-48 w-full object-contain rounded-lg" />
              <button
                type="button"
                onClick={onClear}
                className="absolute top-2 right-2 h-7 w-7 rounded-md bg-destructive/85 hover:bg-destructive flex items-center justify-center transition-colors shadow-lg"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "w-full h-32 rounded-xl border border-dashed border-white/[.15] bg-white/[.02]",
                "flex flex-col items-center justify-center gap-2.5 text-foreground/40",
                "hover:border-white/30 hover:bg-white/[.05] hover:text-foreground/60 transition-all text-xs font-medium",
              )}
            >
              {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
              <span>{label}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const TradeEntryDialog = ({
  mode,
  isOpen,
  onClose,
  onSaved,
  editingTrade,
  nextTradeNumber,
  currentCycleNum,
  readOnly = false,
  sessionId,
}: TradeEntryDialogProps) => {
  const { state } = useUserRoles();
  const isAdmin = state.status === "ready" && (state.data.isAdmin || state.data.isSuperAdmin);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving,   setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);

  const [contextFile,        setContextFile]        = useState<File | null>(null);
  const [contextPreview,     setContextPreview]      = useState<string | null>(null);
  const [existingContextUrl, setExistingContextUrl]  = useState<string | null>(null);

  const [entryFile,        setEntryFile]        = useState<File | null>(null);
  const [entryPreview,     setEntryPreview]      = useState<string | null>(null);
  const [existingEntryUrl, setExistingEntryUrl]  = useState<string | null>(null);

  // Mode lien — URL externe (TradingView, Lightshot, etc.)
  const [contextLinkUrl,   setContextLinkUrl]    = useState("");
  const [entryLinkUrl,     setEntryLinkUrl]      = useState("");

  const { toast } = useToast();
  const { globalVariables, personalVariables, refetch: refetchVariables } = useCustomVariables();

  // §13 dans le marbre (2026-05-01) — Oracle = options DB admin-only, perso interdit.
  // Personal = globalOptions DB + perso user (autorisé en backtesting/live).
  // Doc référence : src/lib/oracle-trade-options.ts
  const personalOptionsFor = (key: keyof typeof personalVariables): string[] =>
    mode === "oracle" ? [] : (personalVariables[key] || []);

  const tradeDuration = calculateDuration(
    formData.trade_date, formData.entry_time,
    formData.exit_date,  formData.exit_time,
  );

  // Setup fields locked for non-admins when editing
  const setupFieldsLocked = !!editingTrade && !isAdmin && mode === "oracle";

  // ── Reset form on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (editingTrade) {
      // Populate from existing trade
      const t = editingTrade;
      setFormData({
        trade_number:       t.trade_number.toString(),
        trade_date:         t.trade_date,
        exit_date:          t.exit_date || t.trade_date,
        direction:          (t.direction as "Long" | "Short") || "Long",
        direction_structure: t.direction_structure || "",
        entry_time:         t.entry_time || "",
        exit_time:          t.exit_time  || "",
        setup_type:         t.setup_type  || "",
        entry_model:        t.entry_model || "",
        entry_timing:       t.entry_timing || "",
        entry_timeframe:    t.entry_timeframe || "",
        rr:                 t.rr?.toString() || "",
        entry_price:        t.entry_price?.toString() || "",
        exit_price:         t.exit_price?.toString()  || "",
        stop_loss:          t.stop_loss?.toString()   || "",
        take_profit:        t.take_profit?.toString() || "",
        result:             (t.result as "Win" | "Loss" | "BE") || "",
        notes:              isOracleTrade(t) ? (t.notes || "") : "",
        comment:            isPersonalTrade(t) ? (t.comment || "") : "",
        news_day:           t.news_day || false,
        news_label:         t.news_label || "",
        sl_placement:       t.sl_placement || "",
        tp_placement:       t.tp_placement || "",
        context_timeframe:  t.context_timeframe || "",
        stop_loss_size:     t.stop_loss_size || "",
        asset:              isPersonalTrade(t) ? (t.asset || "") : "",
      });
      const ctxUrl = t.screenshot_url || null;
      const entUrl = t.screenshot_entry_url || null;
      setExistingContextUrl(ctxUrl);
      setExistingEntryUrl(entUrl);
      // Pré-remplir les champs lien si l'URL existante est externe
      const isExt = (u: string | null) => u?.startsWith("http://") || u?.startsWith("https://");
      setContextLinkUrl(isExt(ctxUrl) ? ctxUrl! : "");
      setEntryLinkUrl(isExt(entUrl) ? entUrl! : "");
    } else {
      const today = new Date().toISOString().split("T")[0];
      const draft = loadDraft(mode);
      if (draft) {
        setFormData({ ...draft, trade_number: nextTradeNumber.toString() });
      } else {
        setFormData({ ...initialFormData, trade_number: nextTradeNumber.toString(), trade_date: today, exit_date: today });
      }
      setExistingContextUrl(null);
      setExistingEntryUrl(null);
      setContextLinkUrl("");
      setEntryLinkUrl("");
    }
    setContextFile(null); setContextPreview(null);
    setEntryFile(null);   setEntryPreview(null);
  }, [isOpen, editingTrade, nextTradeNumber, mode]);

  // Auto-save draft (creation only — oracle + personal)
  // Persiste le formulaire dans localStorage pour survivre aux changements
  // d'onglet navigateur, rechargements accidentels, crashs React, etc.
  useEffect(() => {
    if (!isOpen || editingTrade) return;
    saveDraft(mode, formData);
  }, [formData, isOpen, editingTrade, mode]);

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
    file: File | null, existingUrl: string | null, linkUrl: string, suffix: string,
  ): Promise<string | null> => {
    // Mode lien : si une URL est renseignée et pas de fichier uploadé, utiliser l'URL directement
    if (!file && linkUrl) return linkUrl;
    if (!file) return existingUrl;
    const prefix = mode === "oracle" ? "execution" : "perso";
    const ext = file.name.split(".").pop();
    const fileName = `${userId}/${prefix}_${tradeNumber}_${suffix}_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("trade-screenshots").upload(fileName, file, { upsert: true });
    if (error) { console.error(`Upload ${suffix}:`, error); return existingUrl; }
    return data.path;
  };

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const tradeNum = parseInt(formData.trade_number);

    // ── Validation ─────────────────────────────────────────────────────
    if (mode === "oracle") {
      // Hard validation
      const missingFields: string[] = [];
      if (!formData.trade_number)        missingFields.push("N° Trade");
      if (!formData.trade_date)          missingFields.push("Date Entrée");
      if (!formData.exit_date)           missingFields.push("Date Sortie");
      if (!formData.direction)           missingFields.push("Direction");
      if (!formData.setup_type)          missingFields.push("Type de Config.");
      if (!formData.direction_structure) missingFields.push("Contexte");
      if (!formData.entry_model)         missingFields.push("Entry Model");
      if (!formData.result)              missingFields.push("Résultat");
      if (!formData.rr)                  missingFields.push("RR");
      if (!formData.entry_time)          missingFields.push("Heure d'entrée");
      if (!formData.exit_time)           missingFields.push("Heure de sortie");
      if (!formData.stop_loss_size)      missingFields.push("Taille du SL");
      if (missingFields.length > 0) {
        toast({ title: "Champs requis manquants", description: missingFields.join(", "), variant: "destructive" });
        return;
      }
      const hasContext = !!contextFile || !!existingContextUrl || !!contextLinkUrl;
      const hasEntry   = !!entryFile   || !!existingEntryUrl   || !!entryLinkUrl;
      if (!hasContext || !hasEntry) {
        toast({ title: "Action requise", description: "Vous devez fournir 2 screenshots (Contexte + Entrée).", variant: "destructive" });
        return;
      }
    } else {
      // Soft validation — warn only, don't block
      if (!formData.rr) {
        toast({ title: "RR manquant", description: "Le trade sera enregistré sans RR. Pensez à le renseigner.", variant: "default" });
        // continue save — non-blocking
      }
    }

    setSaving(true); setUploading(true);
    const [contextUrl, entryUrl] = await Promise.all([
      uploadScreenshot(user.id, tradeNum, contextFile, existingContextUrl, contextLinkUrl, "context"),
      uploadScreenshot(user.id, tradeNum, entryFile,   existingEntryUrl,   entryLinkUrl,   "entry"),
    ]);
    setUploading(false);

    try {
      if (mode === "oracle") {
        const tradeData = {
          user_id:             user.id,
          trade_number:        tradeNum,
          trade_date:          formData.trade_date,
          exit_date:           formData.exit_date || null,
          direction:           formData.direction,
          direction_structure: formData.direction_structure || null,
          entry_time:          formData.entry_time || null,
          exit_time:           formData.exit_time  || null,
          trade_duration:      tradeDuration || null,
          setup_type:          formData.setup_type    || null,
          entry_model:         formData.entry_model   || null,
          entry_timing:        formData.entry_timing  || null,
          entry_timeframe:     formData.entry_timeframe || null,
          rr:                  formData.rr          ? parseFloat(formData.rr)         : null,
          entry_price:         formData.entry_price  ? parseFloat(formData.entry_price) : null,
          exit_price:          formData.exit_price   ? parseFloat(formData.exit_price)  : null,
          stop_loss:           formData.stop_loss    ? parseFloat(formData.stop_loss)   : null,
          take_profit:         formData.take_profit  ? parseFloat(formData.take_profit) : null,
          result:              formData.result || null,
          notes:               formData.notes  || null,
          news_day:            formData.news_day,
          news_label:          formData.news_day ? (formData.news_label || null) : null,
          screenshot_url:      contextUrl,
          screenshot_entry_url: entryUrl,
          sl_placement:        formData.sl_placement    || null,
          tp_placement:        formData.tp_placement    || null,
          context_timeframe:   formData.context_timeframe || null,
          stop_loss_size:      formData.stop_loss_size  || null,
        };

        if (editingTrade) {
          const { error } = await supabase.from("user_executions").update(tradeData).eq("id", editingTrade.id);
          if (error) throw error;
          toast({ title: "Trade mis à jour", description: `Trade #${tradeNum} modifié.` });
        } else {
          const { error } = await supabase.from("user_executions").insert(tradeData);
          if (error) {
            if (error.code === "23505") {
              toast({ title: "Erreur", description: `Le trade #${tradeNum} existe déjà.`, variant: "destructive" });
              setSaving(false); return;
            }
            throw error;
          }
          toast({ title: "Trade créé", description: `Trade #${tradeNum} ajouté.` });
          clearDraft(mode);
        }

      } else {
        // Personal mode
        const dayOfWeek = DAYS_MAP[new Date(formData.trade_date).getDay()] || "Inconnu";
        const tradeData = {
          user_id:             user.id,
          trade_number:        tradeNum,
          trade_date:          formData.trade_date,
          exit_date:           formData.exit_date || null,
          day_of_week:         dayOfWeek,
          direction:           formData.direction,
          direction_structure: formData.direction_structure || null,
          entry_time:          formData.entry_time || null,
          exit_time:           formData.exit_time  || null,
          trade_duration:      tradeDuration || null,
          setup_type:          formData.setup_type    || null,
          entry_model:         formData.entry_model   || null,
          entry_timing:        formData.entry_timing  || null,
          entry_timeframe:     formData.entry_timeframe || null,
          rr:                  formData.rr          ? parseFloat(formData.rr)         : null,
          entry_price:         formData.entry_price  ? parseFloat(formData.entry_price) : null,
          exit_price:          formData.exit_price   ? parseFloat(formData.exit_price)  : null,
          stop_loss:           formData.stop_loss    ? parseFloat(formData.stop_loss)   : null,
          take_profit:         formData.take_profit  ? parseFloat(formData.take_profit) : null,
          stop_loss_size:      formData.stop_loss_size  || null,
          result:              formData.result || null,
          comment:             formData.comment || null,
          news_day:            formData.news_day,
          news_label:          formData.news_day ? (formData.news_label || null) : null,
          screenshot_url:      contextUrl,
          screenshot_entry_url: entryUrl,
          sl_placement:        formData.sl_placement    || null,
          tp_placement:        formData.tp_placement    || null,
          context_timeframe:   formData.context_timeframe || null,
          asset:               formData.asset || null,
          session_id:          sessionId || null,
        };

        if (editingTrade) {
          const { error } = await supabase.from("user_personal_trades").update(tradeData).eq("id", editingTrade.id);
          if (error) throw error;
          toast({ title: "Trade mis à jour", description: `Trade #${tradeNum} modifié.` });
        } else {
          const { error } = await supabase.from("user_personal_trades").insert(tradeData);
          if (error) {
            if (error.code === "23505") {
              toast({ title: "Erreur", description: `Le trade #${tradeNum} existe déjà.`, variant: "destructive" });
              setSaving(false); return;
            }
            throw error;
          }
          toast({ title: "Trade créé", description: `Trade #${tradeNum} ajouté.` });
          clearDraft(mode);
        }
      }

      onSaved();
    } catch (err: any) {
      console.error("Save error:", err);
      toast({ title: "Erreur", description: err.message || "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTrade) return;
    const table = mode === "oracle" ? "user_executions" : "user_personal_trades";
    const { error } = await supabase.from(table as any).delete().eq("id", editingTrade.id);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
    } else {
      toast({ title: "Trade supprimé", description: `Trade #${editingTrade.trade_number} supprimé.` });
      onSaved();
    }
  };

  const set = (key: keyof FormData, value: any) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  // ── Disable submit button ───────────────────────────────────────────────
  const submitDisabled =
    saving || uploading ||
    (mode === "oracle" && (
      !formData.trade_number || !formData.trade_date || !formData.exit_date ||
      !formData.direction || !formData.setup_type || !formData.direction_structure ||
      !formData.entry_model || !formData.result || !formData.rr ||
      !formData.entry_time || !formData.exit_time || !formData.stop_loss_size ||
      !((contextFile || existingContextUrl) && (entryFile || existingEntryUrl))
    ));

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-6xl w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-h-[96vh] sm:max-h-[94vh] flex flex-col overflow-hidden p-0 gap-0 border border-white/[.14] rounded-xl sm:rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* ── HEADER ── */}
        <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-5 border-b border-white/[.06] shrink-0 flex items-center gap-2 sm:gap-3 flex-wrap">
          <DialogTitle className="text-base font-semibold tracking-tight">
            {editingTrade ? `Trade #${editingTrade.trade_number}` : "Nouveau Trade"}
          </DialogTitle>
          {mode === "oracle" && currentCycleNum != null && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
              Cycle {currentCycleNum}
            </span>
          )}
          {mode === "personal" && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">
              Personnel
            </span>
          )}
          {readOnly && mode === "oracle" && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-orange-400/90 bg-orange-500/10 border border-orange-500/25 px-2.5 py-1 rounded-md">
              <Lock className="w-3 h-3" /> Vérification en cours — lecture seule
            </span>
          )}
          {!readOnly && setupFieldsLocked && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-amber-400/75 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">
              <Lock className="w-3 h-3" /> <span className="hidden sm:inline">Paramètres setup verrouillés</span><span className="sm:hidden">Verrouillé</span>
            </span>
          )}
        </div>

        {/* ── BODY ── */}
        <div className={cn("flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden", readOnly && "pointer-events-none select-none opacity-60")}>

          {/* ── LEFT — form ── */}
          <div className="lg:overflow-y-auto lg:flex-1 px-4 sm:px-8 py-5 sm:py-7 space-y-6 sm:space-y-8">

            {/* ── INFORMATIONS ── */}
            <div className="space-y-3">
              <SectionHeader label="Informations" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="N° Trade" required>
                  <div className="flex items-center h-10 rounded-md border border-white/[.18] bg-white/[.03] px-3 text-sm font-mono text-foreground/60 gap-1.5">
                    <Lock className="w-3 h-3 shrink-0 text-foreground/25" />
                    {formData.trade_number}
                  </div>
                </Field>
                <Field label="Date Entrée" required={mode === "oracle"}>
                  <DatePicker value={formData.trade_date} onChange={handleEntryDateChange} />
                </Field>
                <Field label="Date Sortie" required={mode === "oracle"}>
                  <DatePicker value={formData.exit_date} onChange={(v) => set("exit_date", v)} />
                </Field>
                <Field label="Direction" required>
                  <div className="relative flex h-10 rounded-md border border-white/[.18] bg-white/[.03] p-0.5 overflow-hidden">
                    <div
                      className={cn(
                        "absolute inset-y-0.5 w-[calc(50%-2px)] rounded-[5px] transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)]",
                        formData.direction === "Long"
                          ? "left-0.5 bg-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                          : "left-[calc(50%+1px)] bg-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.25)]",
                      )}
                    />
                    <button type="button" onClick={() => set("direction", "Long")}
                      className={cn("relative flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-[5px] transition-colors duration-200 z-10",
                        formData.direction === "Long" ? "text-emerald-400" : "text-foreground/35 hover:text-foreground/60")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", formData.direction === "Long" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-foreground/20")} />
                      Long
                    </button>
                    <button type="button" onClick={() => set("direction", "Short")}
                      className={cn("relative flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-[5px] transition-colors duration-200 z-10",
                        formData.direction === "Short" ? "text-rose-400" : "text-foreground/35 hover:text-foreground/60")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", formData.direction === "Short" ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]" : "bg-foreground/20")} />
                      Short
                    </button>
                  </div>
                </Field>
              </div>
              {/* Personal: Actif */}
              {mode === "personal" && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                  <Field label="Actif concerné">
                    <Input
                      value={formData.asset}
                      onChange={(e) => set("asset", e.target.value)}
                      placeholder="Ex: NQ, ES, GBP/USD..."
                      className="h-10"
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* ── PARAMÈTRES DU SETUP ── */}
            <div className="space-y-3">
              <SectionHeader
                label="Paramètres du Setup"
                extra={setupFieldsLocked
                  ? <span className="flex items-center gap-1 text-[10px] text-amber-400/55 font-mono shrink-0">
                      <Lock className="w-3 h-3" /> admin requis pour modifier
                    </span>
                  : undefined}
              />
              <div className={cn(setupFieldsLocked && "opacity-50 pointer-events-none select-none")}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <Field label="Type de Config." required={mode === "oracle"}>
                    <CustomizableMultiSelect compact singleSelect canManage={isAdmin}
                      value={formData.setup_type} onChange={(v) => set("setup_type", v)}
                      globalOptions={globalVariables.setup_type} personalOptions={personalOptionsFor("setup_type")}
                      variableType="setup_type" placeholder="Sélectionne..." onOptionsChanged={refetchVariables} />
                  </Field>
                  <Field label="Contexte" required={mode === "oracle"}>
                    <CustomizableMultiSelect compact singleSelect canManage={isAdmin}
                      value={formData.direction_structure} onChange={(v) => set("direction_structure", v)}
                      globalOptions={globalVariables.direction_structure} personalOptions={personalOptionsFor("direction_structure")}
                      variableType="direction_structure" placeholder="Sélectionne..." onOptionsChanged={refetchVariables} />
                  </Field>
                  <Field label="Entry Model" required={mode === "oracle"}>
                    <CustomizableMultiSelect compact canManage={isAdmin}
                      value={formData.entry_model} onChange={(v) => set("entry_model", v)}
                      globalOptions={globalVariables.entry_model} personalOptions={personalOptionsFor("entry_model")}
                      variableType="entry_model" placeholder="Sélectionne..." onOptionsChanged={refetchVariables} />
                  </Field>
                  <Field label="Timing">
                    <CustomizableMultiSelect compact singleSelect canManage={isAdmin}
                      value={formData.entry_timing} onChange={(v) => set("entry_timing", v)}
                      globalOptions={globalVariables.entry_timing} personalOptions={personalOptionsFor("entry_timing")}
                      variableType="entry_timing" placeholder="Sélectionne..." onOptionsChanged={refetchVariables} />
                  </Field>
                  <Field label="Time Frame d'entrée">
                    <CustomizableMultiSelect compact singleSelect canManage={isAdmin}
                      value={formData.entry_timeframe} onChange={(v) => set("entry_timeframe", v)}
                      globalOptions={globalVariables.entry_timeframe} personalOptions={personalOptionsFor("entry_timeframe")}
                      variableType="entry_timeframe" placeholder="Sélectionne..." onOptionsChanged={refetchVariables} />
                  </Field>
                </div>
              </div>
            </div>

            {/* ── EXÉCUTION ── */}
            <div className="space-y-3">
              <SectionHeader label="Exécution" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Résultat — toggle 3 états */}
                <Field label="Résultat" required={mode === "oracle"}>
                  <div className="relative flex h-10 rounded-md border border-white/[.18] bg-white/[.03] p-0.5 overflow-hidden">
                    {formData.result && (
                      <div className={cn(
                        "absolute inset-y-0.5 w-[calc(33.33%-1.5px)] rounded-[5px] transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)]",
                        formData.result === "Win"  && "left-[1.5px]  bg-emerald-500/25 shadow-[0_0_14px_rgba(16,185,129,0.3)]",
                        formData.result === "BE"   && "left-[calc(33.33%+0.5px)] bg-amber-500/25  shadow-[0_0_14px_rgba(245,158,11,0.3)]",
                        formData.result === "Loss" && "left-[calc(66.67%+0.5px)] bg-rose-500/25   shadow-[0_0_14px_rgba(244,63,94,0.3)]",
                      )} />
                    )}
                    {(["Win", "BE", "Loss"] as const).map((r) => (
                      <button key={r} type="button"
                        onClick={() => set("result", formData.result === r ? "" : r)}
                        className={cn("relative flex-1 flex items-center justify-center gap-1 text-xs font-semibold rounded-[5px] transition-colors duration-200 z-10",
                          formData.result === r
                            ? r === "Win" ? "text-emerald-400" : r === "BE" ? "text-amber-400" : "text-rose-400"
                            : "text-foreground/35 hover:text-foreground/60")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300",
                          formData.result === r
                            ? r === "Win" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                              : r === "BE"  ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]"
                              : "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.9)]"
                            : "bg-foreground/20")} />
                        {r}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="RR" required={mode === "oracle"}>
                  <Input type="text" inputMode="decimal" value={formData.rr}
                    onChange={(e) => { const s = e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,"").replace(/\.(?=.*\.)/g,""); set("rr", s); }}
                    onKeyDown={(e) => { if (e.key === ",") e.preventDefault(); }}
                    placeholder="Ex: 2.5" className="h-10" />
                </Field>
                <Field label="Heure d'entrée" required={mode === "oracle"}>
                  <TimePicker value={formData.entry_time} onChange={(v) => set("entry_time", v)} />
                </Field>
                <Field label="Heure de sortie" required={mode === "oracle"}>
                  <TimePicker value={formData.exit_time} onChange={(v) => set("exit_time", v)} />
                </Field>
              </div>
              <div className={cn("flex items-center gap-2 text-xs font-mono transition-colors", tradeDuration ? "text-foreground/50" : "text-foreground/25")}>
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Durée : <span className={tradeDuration ? "text-foreground/70 font-semibold" : ""}>{tradeDuration || "—"}</span></span>
              </div>
            </div>

            {/* ── COMPLÉMENT ── */}
            <div className="space-y-3">
              <SectionHeader label="Complément" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                <Field label="Taille du SL" required={mode === "oracle"}>
                  <Input type="text" inputMode="decimal" value={formData.stop_loss_size}
                    onChange={(e) => set("stop_loss_size", sanitizeDecimal(e.target.value))}
                    onKeyDown={(e) => { if (e.key === ",") e.preventDefault(); }}
                    placeholder="Ex: 12.5" className="h-10 border-white/[.18] bg-white/[.04]" />
                </Field>
                <Field label="Placement du SL">
                  <CustomizableMultiSelect compact singleSelect canManage={isAdmin}
                    value={formData.sl_placement} onChange={(v) => set("sl_placement", v)}
                    globalOptions={globalVariables.sl_placement || []} personalOptions={personalOptionsFor("sl_placement")}
                    variableType="sl_placement" placeholder="Sélectionner..." onOptionsChanged={refetchVariables} />
                </Field>
                <Field label="Placement du TP">
                  <CustomizableMultiSelect compact singleSelect canManage={isAdmin}
                    value={formData.tp_placement} onChange={(v) => set("tp_placement", v)}
                    globalOptions={globalVariables.tp_placement || []} personalOptions={personalOptionsFor("tp_placement")}
                    variableType="tp_placement" placeholder="Sélectionner..." onOptionsChanged={refetchVariables} />
                </Field>
                <div className="space-y-2.5 pt-[28px]">
                  <div className="flex items-center gap-2.5 h-10">
                    <Checkbox id="news_day" checked={formData.news_day}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, news_day: !!checked, news_label: !!checked ? prev.news_label : "" }))} />
                    <Label htmlFor="news_day" className="text-sm cursor-pointer">Jour de news</Label>
                  </div>
                  {formData.news_day && (
                    <Input value={formData.news_label} onChange={(e) => set("news_label", e.target.value)}
                      placeholder="Ex: NFP, CPI, FOMC..." className="h-10 border-white/[.18] bg-white/[.04]" />
                  )}
                </div>
              </div>
            </div>

            {/* ── DONNÉES MANUELLES (optionnel) ── */}
            <div className="space-y-3">
              <SectionHeader label="Données Manuelles"
                extra={<span className="text-[10px] text-foreground/25 font-mono shrink-0">optionnel</span>} />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Prix Entrée">
                  <Input type="text" inputMode="decimal" value={formData.entry_price}
                    onChange={(e) => set("entry_price", sanitizeDecimal(e.target.value))}
                    onKeyDown={(e) => { if (e.key === ",") e.preventDefault(); }}
                    placeholder="Ex: 1.08542" className="h-10 border-white/[.18] bg-white/[.04]" />
                </Field>
                <Field label="Prix Sortie">
                  <Input type="text" inputMode="decimal" value={formData.exit_price}
                    onChange={(e) => set("exit_price", sanitizeDecimal(e.target.value))}
                    onKeyDown={(e) => { if (e.key === ",") e.preventDefault(); }}
                    placeholder="Ex: 1.08650" className="h-10 border-white/[.18] bg-white/[.04]" />
                </Field>
                <Field label="Stop Loss">
                  <Input type="text" inputMode="decimal" value={formData.stop_loss}
                    onChange={(e) => set("stop_loss", sanitizeDecimal(e.target.value))}
                    onKeyDown={(e) => { if (e.key === ",") e.preventDefault(); }}
                    placeholder="Ex: 1.08500" className="h-10 border-white/[.18] bg-white/[.04]" />
                </Field>
                <Field label="Take Profit">
                  <Input type="text" inputMode="decimal" value={formData.take_profit}
                    onChange={(e) => set("take_profit", sanitizeDecimal(e.target.value))}
                    onKeyDown={(e) => { if (e.key === ",") e.preventDefault(); }}
                    placeholder="Ex: 1.08700" className="h-10 border-white/[.18] bg-white/[.04]" />
                </Field>
              </div>
            </div>

          </div>{/* /left */}

          {/* ── RIGHT — screenshots + notes/comment ── */}
          <div className="w-full lg:w-[360px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/[.06] bg-white/[.012] lg:overflow-y-auto flex flex-col px-4 sm:px-6 lg:px-7 py-5 sm:py-7 gap-5 sm:gap-7">

            <div className="space-y-4">
              <SectionHeader label="Screenshots" />
              <ScreenshotUploadField
                label="Contexte (M15)"
                file={contextFile} preview={contextPreview} existingUrl={existingContextUrl}
                uploading={uploading} required={mode === "oracle"}
                onFileSelect={(e) => handleFileSelect(e, setContextFile, setContextPreview)}
                onClear={() => { setContextFile(null); setContextPreview(null); setExistingContextUrl(null); }}
                linkUrl={contextLinkUrl}
                onLinkUrlChange={setContextLinkUrl}
              />
              <ScreenshotUploadField
                label="Entrée (TF modèle d'entrée)"
                file={entryFile} preview={entryPreview} existingUrl={existingEntryUrl}
                uploading={uploading} required={mode === "oracle"}
                onFileSelect={(e) => handleFileSelect(e, setEntryFile, setEntryPreview)}
                onClear={() => { setEntryFile(null); setEntryPreview(null); setExistingEntryUrl(null); }}
                linkUrl={entryLinkUrl}
                onLinkUrlChange={setEntryLinkUrl}
              />
            </div>

            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <label className="block text-xs font-medium text-foreground/60 leading-none">
                {mode === "oracle" ? "Notes" : "Commentaire"}
              </label>
              <Textarea
                value={mode === "oracle" ? formData.notes : formData.comment}
                onChange={(e) => set(mode === "oracle" ? "notes" : "comment", e.target.value)}
                placeholder={mode === "oracle" ? "Observations, contexte du trade..." : "Commentaire sur le trade..."}
                className="resize-none flex-1 min-h-[200px] border-white/[.18] bg-white/[.03] focus-visible:bg-white/[.05] rounded-xl text-sm leading-relaxed"
              />
            </div>

          </div>{/* /right */}

        </div>{/* /body */}

        {/* ── FOOTER ── */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-white/[.06] flex items-center justify-between shrink-0 bg-white/[.012] gap-2">
          {/* Delete button */}
          {editingTrade && (mode === "personal" || !readOnly) ? (
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

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} className="gap-1.5 h-10 px-5">
              <X className="w-3.5 h-3.5" /> Fermer
            </Button>
            {!readOnly && (
              <Button onClick={handleSave} disabled={submitDisabled} className="gap-2 h-10 px-6 font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};
