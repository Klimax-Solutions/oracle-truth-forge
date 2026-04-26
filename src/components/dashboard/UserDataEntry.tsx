import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  OracleCycleWindow,
  getMinTradeDate,
  getUserCurrentCycleNum,
  computeUserOffset,
  getRecommendedWindow,
  checkDateInWindow,
  formatDateShort,
  USER_CYCLE_THRESHOLDS,
} from "@/lib/oracle-cycle-windows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeField } from "@/components/ui/time-field";
// CustomizableSelect removed - using CustomizableMultiSelect for all fields
import { CustomizableMultiSelect } from "@/components/dashboard/CustomizableMultiSelect";
import { useCustomVariables } from "@/hooks/useCustomVariables";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus,
  Download,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Clock,
  Upload,
  Image as ImageIcon,
  Play,
  Pause,
  RotateCcw,
  Timer,
  Trophy,
  AlertTriangle,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScreenshotLink } from "./ScreenshotLink";
import { SignedImageCard } from "./SignedImageCard";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { OracleTradeDialog } from "./OracleTradeDialog";

interface UserExecution {
  id: string;
  trade_number: number;
  trade_date: string;
  direction: "Long" | "Short";
  entry_time: string | null;
  exit_time: string | null;
  exit_date: string | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rr: number | null;
  result: "Win" | "Loss" | "BE" | null;
  setup_type: string | null;
  entry_model: string | null;
  direction_structure: string | null;
  entry_timing: string | null;
  notes: string | null;
  screenshot_url: string | null;
  screenshot_entry_url: string | null;
}

interface OracleTrade {
  id: string;
  trade_number: number;
  trade_date: string;
  entry_time: string;
  direction: string;
}

interface TradeComparison {
  userExecution: {
    id: string;
    trade_number: number;
    trade_date: string;
    direction: string;
    entry_time: string | null;
    rr: number | null;
  };
  oracleTrade: OracleTrade | null;
  timeDifferenceHours: number | null;
  status: 'match' | 'warning' | 'error' | 'no-match';
}

interface FormData {
  trade_number: string;
  trade_date: string;
  exit_date: string;
  direction: "Long" | "Short";
  entry_time: string;
  exit_time: string;
  entry_price: string;
  exit_price: string;
  stop_loss: string;
  take_profit: string;
  rr: string;
  result: "Win" | "Loss" | "BE" | "";
  setup_type: string;
  entry_model: string;
  direction_structure: string;
  entry_timing: string;
  entry_timeframe: string;
  notes: string;
  sl_placement: string;
  tp_placement: string;
  context_timeframe: string;
  stop_loss_size: string;
  news_day: boolean;
  news_label: string;
}

// Fixed options (non-deletable)
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

// Time constraints removed — all hours are now selectable
const MIN_ENTRY_TIME = "00:00";
const MAX_TIME = "23:59";

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

// Cycle thresholds - comparison status only revealed after completing each cycle
const CYCLE_THRESHOLDS = [
  { max: 15, name: "Ébauche" },      // Trades 1-15
  { max: 40, name: "Cycle 1" },      // Trades 16-40 (25 trades)
  { max: 65, name: "Cycle 2" },      // Trades 41-65 (25 trades)
  { max: 90, name: "Cycle 3" },      // Trades 66-90 (25 trades)
  { max: 115, name: "Cycle 4" },     // Trades 91-115 (25 trades)
  { max: 165, name: "Cycle 5" },     // Trades 116-165 (50 trades)
  { max: 229, name: "Cycle 6" },     // Trades 166-229 (64 trades)
  { max: 293, name: "Cycle 7" },     // Trades 230-293 (64 trades)
  { max: 357, name: "Cycle 8" },     // Trades 294-357 (64 trades)
];

// Get cycle label and range for a trade number (for visual grouping)
const getCycleLabelForTrade = (tradeNumber: number): { label: string; start: number; end: number } | null => {
  let prevMax = 0;
  for (const cycle of CYCLE_THRESHOLDS) {
    if (tradeNumber > prevMax && tradeNumber <= cycle.max) {
      return { label: cycle.name, start: prevMax + 1, end: cycle.max };
    }
    prevMax = cycle.max;
  }
  return null;
};

// Get the current cycle threshold based on total trades
const getCurrentCycleThreshold = (totalTrades: number): number => {
  for (const cycle of CYCLE_THRESHOLDS) {
    if (totalTrades < cycle.max) {
      return cycle.max;
    }
  }
  return CYCLE_THRESHOLDS[CYCLE_THRESHOLDS.length - 1].max;
};

// Check if a trade should show comparison status (only after cycle completion)
const shouldShowComparisonStatus = (tradeNumber: number, totalTrades: number): boolean => {
  // Find which cycle this trade belongs to
  let cycleEnd = 0;
  for (const cycle of CYCLE_THRESHOLDS) {
    if (tradeNumber <= cycle.max) {
      cycleEnd = cycle.max;
      break;
    }
  }
  // Only show status if user has completed the cycle this trade belongs to
  return totalTrades >= cycleEnd;
};

interface UserDataEntryProps {
  tradeComparisons?: TradeComparison[];
  oracleTrades?: OracleTrade[];
  /** Fenêtres temporelles Oracle dérivées des trades réels — pour le guidage R4 */
  oracleCycleWindows?: OracleCycleWindow[];
}

const initialFormData: FormData = {
  trade_number: "",
  trade_date: new Date().toISOString().split("T")[0],
  exit_date: new Date().toISOString().split("T")[0],
  direction: "Long",
  entry_time: "",
  exit_time: "",
  entry_price: "",
  exit_price: "",
  stop_loss: "",
  take_profit: "",
  rr: "",
  result: "",
  setup_type: "",
  entry_model: "",
  direction_structure: "",
  entry_timing: "",
  entry_timeframe: "",
  notes: "",
  sl_placement: "",
  tp_placement: "",
  context_timeframe: "",
  stop_loss_size: "",
  news_day: false,
  news_label: "",
};


export const UserDataEntry = ({ tradeComparisons = [], oracleTrades = [], oracleCycleWindows = [] }: UserDataEntryProps) => {
  const [executions, setExecutions] = useState<UserExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvancedPrices, setShowAdvancedPrices] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingExec, setEditingExec] = useState<UserExecution | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  // Dual screenshot state (context M15 + entry M5)
  const [contextFile, setContextFile] = useState<File | null>(null);
  const [contextPreview, setContextPreview] = useState<string | null>(null);
  const [existingContextUrl, setExistingContextUrl] = useState<string | null>(null);
  const [entryFile, setEntryFile] = useState<File | null>(null);
  const [entryPreview, setEntryPreview] = useState<string | null>(null);
  const [existingEntryUrl, setExistingEntryUrl] = useState<string | null>(null);
  // Screenshot mode: file upload vs. direct URL link
  const [contextMode, setContextMode] = useState<"file" | "link">("file");
  const [entryMode, setEntryMode] = useState<"file" | "link">("file");
  const [contextLinkUrl, setContextLinkUrl] = useState("");
  const [entryLinkUrl, setEntryLinkUrl] = useState("");
  // Screenshot validation state
  const [screenshotError, setScreenshotError] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<UserExecution | null>(null);
  const contextFileRef = useRef<HTMLInputElement>(null);
  const entryFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { variables, refetch: refetchVariables } = useCustomVariables();

  // Timer state for gamification
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerRunning]);

  // Format timer display
  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get current cycle info based on total trades
  const getCurrentCycleInfo = (totalTrades: number) => {
    for (let i = 0; i < CYCLE_THRESHOLDS.length; i++) {
      const cycle = CYCLE_THRESHOLDS[i];
      const prevMax = i === 0 ? 0 : CYCLE_THRESHOLDS[i - 1].max;
      if (totalTrades < cycle.max) {
        return {
          name: cycle.name,
          current: totalTrades - prevMax,
          target: cycle.max - prevMax,
          totalCurrent: totalTrades,
          totalTarget: cycle.max,
          progress: ((totalTrades - prevMax) / (cycle.max - prevMax)) * 100,
          isComplete: false,
        };
      }
    }
    // All cycles complete
    const lastCycle = CYCLE_THRESHOLDS[CYCLE_THRESHOLDS.length - 1];
    return {
      name: "Terminé",
      current: lastCycle.max,
      target: lastCycle.max,
      totalCurrent: totalTrades,
      totalTarget: lastCycle.max,
      progress: 100,
      isComplete: true,
    };
  };

  // Get trade context for charts - ISOLATED 10 last trades (like OracleDatabase)
  const getTradeContext = useMemo(() => (execution: UserExecution) => {
    const executionIndex = executions.findIndex(e => e.id === execution.id);
    const tradesUpToNow = executions.slice(0, executionIndex + 1);
    const cumulativeRR = tradesUpToNow.reduce((sum, e) => sum + (e.rr || 0), 0);
    
    // Get last 10 trades and show ISOLATED cumul (as if trades 1-10)
    const recentTrades = executions.slice(Math.max(0, executionIndex - 9), executionIndex + 1);
    let isolatedCumul = 0;
    const chartData = recentTrades.map((e, idx) => {
      isolatedCumul += e.rr || 0;
      return {
        trade: idx + 1, // Trades 1-10 isolated
        tradeNum: e.trade_number,
        rr: parseFloat(isolatedCumul.toFixed(2)),
        individual: e.rr || 0,
        current: e.id === execution.id
      };
    });
    
    const isolatedTotal = recentTrades.reduce((sum, e) => sum + (e.rr || 0), 0);

    return { cumulativeRR, chartData, executionIndex, isolatedTotal };
  }, [executions]);

  // Fetch user executions
  useEffect(() => {
    fetchExecutions();
  }, []);

  const fetchExecutions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("user_executions")
      .select("*")
      .eq("user_id", user.id)
      .order("trade_number", { ascending: true });

    if (error) {
      console.error("Error fetching executions:", error);
    } else {
      setExecutions((data || []) as UserExecution[]);
    }
    setLoading(false);
  };

  // Get next trade number
  const getNextTradeNumber = () => {
    if (executions.length === 0) return 1;
    return Math.max(...executions.map(e => e.trade_number)) + 1;
  };

  // ── R2 + R3 — Date minimale pour un nouveau trade ───────────────────────────
  // Chaque trade doit être ≥ au trade précédent (trade_date ET exit_date).
  const minTradeDate = useMemo(() => {
    if (editingId) {
      // En édition : min = max des dates des trades avec trade_number inférieur
      const editingNum = parseInt(formData.trade_number);
      const prevTrades = executions.filter(e => e.trade_number < editingNum);
      return getMinTradeDate(prevTrades);
    }
    // Nouveau trade : min = max de toutes les dates existantes
    return getMinTradeDate(executions);
  }, [executions, editingId, formData.trade_number]);

  // ── R4 — Fenêtre temporelle Oracle et guidage doux ──────────────────────────
  const temporalGuidance = useMemo(() => {
    if (oracleCycleWindows.length === 0) return null;
    const currentCycleNum = getUserCurrentCycleNum(executions.length);
    if (currentCycleNum >= USER_CYCLE_THRESHOLDS.length) return null; // tout complété

    const offsetDays = computeUserOffset(
      currentCycleNum,
      oracleCycleWindows,
      executions
    );
    const recommendedWindow = getRecommendedWindow(
      currentCycleNum,
      oracleCycleWindows,
      offsetDays
    );
    const oracleWindow = oracleCycleWindows.find(w => w.cycleNum === currentCycleNum) ?? null;

    return { currentCycleNum, offsetDays, recommendedWindow, oracleWindow };
  }, [executions, oracleCycleWindows]);

  // Statut de la date saisie vis-à-vis de la fenêtre recommandée
  const dateWindowStatus = useMemo(() => {
    if (!temporalGuidance?.recommendedWindow || !formData.trade_date) return "unknown";
    return checkDateInWindow(formData.trade_date, temporalGuidance.recommendedWindow);
  }, [formData.trade_date, temporalGuidance]);

  // Validate entry time (15:20 - 22:00)
  const validateEntryTime = (time: string): boolean => {
    if (!time) return true; // Allow empty
    return time >= MIN_ENTRY_TIME && time <= MAX_TIME;
  };

  // Validate exit time (max 22:00 only)
  const validateExitTime = (time: string): boolean => {
    if (!time) return true; // Allow empty
    return time <= MAX_TIME;
  };

  // Handle file selection for dual screenshots
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille maximale est de 10 MB.",
          variant: "destructive",
        });
        return;
      }
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Upload a screenshot file — returns { path, error }
  const uploadScreenshot = async (
    userId: string,
    tradeNumber: number,
    file: File | null,
    existingUrl: string | null,
    suffix: string
  ): Promise<{ path: string | null; error: boolean }> => {
    if (!file) return { path: existingUrl, error: false };
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/execution_${tradeNumber}_${suffix}_${Date.now()}.${fileExt}`;
    console.log(`Uploading ${suffix} screenshot: ${fileName} (${file.size} bytes, type: ${file.type})`);
    const { data, error } = await supabase.storage
      .from('trade-screenshots')
      .upload(fileName, file, { upsert: true });
    if (error) {
      console.error(`Error uploading ${suffix} screenshot:`, error);
      return { path: existingUrl, error: true };
    }
    console.log(`Upload ${suffix} success:`, data.path);
    return { path: data.path, error: false };
  };

  // Open dialog for new entry
  const handleNewEntry = () => {
    setEditingId(null);
    setEditingExec(null);
    setIsDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (execution: UserExecution) => {
    setFormData({
      trade_number: execution.trade_number.toString(),
      trade_date: execution.trade_date,
      exit_date: execution.exit_date || execution.trade_date,
      direction: execution.direction,
      entry_time: execution.entry_time || "",
      exit_time: execution.exit_time || "",
      entry_price: execution.entry_price?.toString() || "",
      exit_price: execution.exit_price?.toString() || "",
      stop_loss: execution.stop_loss?.toString() || "",
      take_profit: execution.take_profit?.toString() || "",
      rr: execution.rr?.toString() || "",
      result: execution.result || "",
      setup_type: execution.setup_type || "",
      entry_model: execution.entry_model || "",
      direction_structure: execution.direction_structure || "",
      entry_timing: execution.entry_timing || "",
      entry_timeframe: (execution as any).entry_timeframe || "",
      notes: execution.notes || "",
      sl_placement: (execution as any).sl_placement || "",
      tp_placement: (execution as any).tp_placement || "",
      context_timeframe: (execution as any).context_timeframe || "",
      stop_loss_size: (execution as any).stop_loss_size || "",
      news_day: (execution as any).news_day || false,
      news_label: (execution as any).news_label || "",
    });
    setEditingId(execution.id);
    setContextFile(null);
    setContextPreview(null);
    setEntryFile(null);
    setEntryPreview(null);
    setScreenshotError(false);
    // Restore link mode if the stored value is an external URL
    const existCtx = execution.screenshot_url;
    const existEntry = (execution as any).screenshot_entry_url || null;
    if (existCtx?.startsWith("http")) {
      setContextMode("link");
      setContextLinkUrl(existCtx);
      setExistingContextUrl(null);
    } else {
      setContextMode("file");
      setContextLinkUrl("");
      setExistingContextUrl(existCtx);
    }
    if (existEntry?.startsWith("http") && !existEntry?.includes("supabase")) {
      setEntryMode("link");
      setEntryLinkUrl(existEntry);
      setExistingEntryUrl(null);
    } else {
      setEntryMode("file");
      setEntryLinkUrl("");
      setExistingEntryUrl(existEntry);
    }
    setIsDialogOpen(true);
  };

  // Auto-sync exit_date when trade_date changes
  const handleEntryDateChange = (newDate: string) => {
    setFormData(prev => ({
      ...prev,
      trade_date: newDate,
      exit_date: (!prev.exit_date || prev.exit_date === prev.trade_date) ? newDate : prev.exit_date,
    }));
  };

  // Save execution
  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // R2 + R3 — Validation chronologique stricte
    if (minTradeDate && formData.trade_date && formData.trade_date < minTradeDate) {
      toast({
        title: "Date invalide",
        description: `La date d'entrée doit être le ${new Date(minTradeDate).toLocaleDateString("fr-FR")} ou plus tard (ordre chronologique strict).`,
        variant: "destructive",
      });
      return;
    }
    if (minTradeDate && formData.exit_date && formData.exit_date < minTradeDate) {
      toast({
        title: "Date de sortie invalide",
        description: `La date de sortie doit être le ${new Date(minTradeDate).toLocaleDateString("fr-FR")} ou plus tard.`,
        variant: "destructive",
      });
      return;
    }

    // Validate times
    if (formData.entry_time && !validateEntryTime(formData.entry_time)) {
      toast({
        title: "Heure d'entrée invalide",
        description: `L'heure d'entrée doit être à partir de ${MIN_ENTRY_TIME}.`,
        variant: "destructive",
      });
      return;
    }

    if (formData.exit_time && !validateExitTime(formData.exit_time)) {
      toast({
        title: "Heure de sortie invalide",
        description: `L'heure de sortie doit être avant ${MAX_TIME}.`,
        variant: "destructive",
      });
      return;
    }

    // Hard constraint: both screenshots required before submit
    const hasContext = contextMode === "link" ? !!contextLinkUrl.trim() : !!(contextFile || existingContextUrl);
    const hasEntry = entryMode === "link" ? !!entryLinkUrl.trim() : !!(entryFile || existingEntryUrl);
    if (!hasContext || !hasEntry) {
      setScreenshotError(true);
      return;
    }
    setScreenshotError(false);

    setSaving(true);
    setUploading(true);

    const tradeNum = parseInt(formData.trade_number);
    // Upload dual screenshots (or resolve external links directly)
    const [contextResult, entryResult] = await Promise.all([
      contextMode === "link"
        ? Promise.resolve({ path: contextLinkUrl.trim() || null, error: false })
        : uploadScreenshot(user.id, tradeNum, contextFile, existingContextUrl, "context"),
      entryMode === "link"
        ? Promise.resolve({ path: entryLinkUrl.trim() || null, error: false })
        : uploadScreenshot(user.id, tradeNum, entryFile, existingEntryUrl, "entry"),
    ]);
    setUploading(false);

    // If any upload failed, block the save and show error
    if (contextResult.error || entryResult.error) {
      const failedParts = [];
      if (contextResult.error) failedParts.push("Contexte");
      if (entryResult.error) failedParts.push("Entrée");
      toast({
        title: "Erreur d'upload",
        description: `Impossible d'envoyer le(s) screenshot(s) : ${failedParts.join(", ")}. Vérifie ta connexion et réessaie.`,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    const tradeDuration = calculateDuration(
      formData.trade_date, formData.entry_time,
      formData.exit_date, formData.exit_time
    );

    const executionData = {
      user_id: user.id,
      trade_number: tradeNum,
      trade_date: formData.trade_date,
      exit_date: formData.exit_date || null,
      direction: formData.direction,
      entry_time: formData.entry_time || null,
      exit_time: formData.exit_time || null,
      entry_price: formData.entry_price ? parseFloat(formData.entry_price) : null,
      exit_price: formData.exit_price ? parseFloat(formData.exit_price) : null,
      stop_loss: formData.stop_loss ? parseFloat(formData.stop_loss) : null,
      take_profit: formData.take_profit ? parseFloat(formData.take_profit) : null,
      rr: formData.rr ? parseFloat(formData.rr) : null,
      result: formData.result || null,
      setup_type: formData.setup_type || null,
      entry_model: formData.entry_model || null,
      direction_structure: formData.direction_structure || null,
      entry_timing: formData.entry_timing || null,
      entry_timeframe: formData.entry_timeframe || null,
      notes: formData.notes || null,
      screenshot_url: contextResult.path,
      screenshot_entry_url: entryResult.path,
      sl_placement: formData.sl_placement || null,
      tp_placement: formData.tp_placement || null,
      context_timeframe: formData.context_timeframe || null,
      stop_loss_size: formData.stop_loss_size || null,
      news_day: formData.news_day,
      news_label: formData.news_day ? (formData.news_label || null) : null,
      trade_duration: tradeDuration || null,
    };

    try {
      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from("user_executions")
          .update(executionData)
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Trade mis à jour",
          description: `Trade #${formData.trade_number} modifié avec succès.`,
        });
      } else {
        // Insert new
        const { error } = await supabase
          .from("user_executions")
          .insert(executionData);

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
          description: `Trade #${formData.trade_number} enregistré avec succès.`,
        });
      }

      setIsDialogOpen(false);
      fetchExecutions();
    } catch (error) {
      console.error("Error saving execution:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete execution
  const handleDelete = async (id: string, tradeNumber: number) => {
    if (!confirm(`Supprimer le trade #${tradeNumber} ?`)) return;

    const { error } = await supabase
      .from("user_executions")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le trade.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Trade supprimé",
        description: `Trade #${tradeNumber} supprimé.`,
      });
      fetchExecutions();
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (executions.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Aucun trade à exporter.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Trade #",
      "Date Entrée",
      "Date Sortie",
      "Direction",
      "Heure Entrée",
      "Heure Sortie",
      "Prix Entrée",
      "Prix Sortie",
      "Stop Loss",
      "Take Profit",
      "RR",
      "Résultat",
      "Setup",
      "Entry Model",
      "Structure",
      "Timing",
      "Notes",
    ];

    const csvRows = [
      headers.join(","),
      ...executions.map((e) =>
        [
          e.trade_number,
          e.trade_date,
          e.exit_date || "",
          e.direction,
          e.entry_time || "",
          e.exit_time || "",
          e.entry_price || "",
          e.exit_price || "",
          e.stop_loss || "",
          e.take_profit || "",
          e.rr || "",
          e.result || "",
          e.setup_type || "",
          e.entry_model || "",
          e.direction_structure || "",
          e.entry_timing || "",
          `"${(e.notes || "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `oracle_executions_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();

    toast({
      title: "Export réussi",
      description: `${executions.length} trades exportés en CSV.`,
    });
  };

  // Calculate stats
  const stats = {
    total: executions.length,
    wins: executions.filter((e) => e.result === "Win").length,
    losses: executions.filter((e) => e.result === "Loss").length,
    totalRR: executions.reduce((sum, e) => sum + (e.rr || 0), 0),
  };
  const winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
  
  // Get current cycle progress info
  const cycleInfo = getCurrentCycleInfo(executions.length);

  // Check if exit is same day
  const isSameDay = formData.trade_date === formData.exit_date;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full overflow-auto">
      {/* Header - responsive */}
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1">
              Saisie des Exécutions
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground font-mono">
              Entrez vos trades pour validation et analyse
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 flex-1 md:flex-none">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={handleNewEntry} className="gap-1.5 flex-1 md:flex-none">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Nouveau</span> Trade
                </Button>
              </DialogTrigger>
              {/* ── DIALOG PLEIN ÉCRAN — 2 colonnes, zéro scroll ── */}
              <DialogContent className="w-[96vw] max-w-[96vw] h-[88vh] p-0 bg-card border-border flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                  <h2 className="text-base font-bold tracking-tight text-foreground">
                    {editingId ? `Modifier Trade #${formData.trade_number}` : "Nouveau Trade"}
                  </h2>
                  <div className="w-4" />
                </div>

                {/* Corps — 2 colonnes */}
                <div className="flex-1 flex overflow-hidden text-sm">

                  {/* ── COL GAUCHE ── */}
                  <div className="flex flex-col gap-0 w-[52%] border-r border-white/[.10] overflow-y-auto">

                    {/* Section: Direction */}
                    <div className="px-6 pt-5 pb-4 border-b border-white/[.10]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground mb-3">Direction</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button type="button" onClick={() => setFormData({ ...formData, direction: "Long" })}
                          className={cn("flex items-center justify-center gap-2.5 py-3.5 rounded-xl border-2 transition-all duration-150 font-bold text-sm",
                            formData.direction === "Long"
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_24px_-8px_theme(colors.emerald.500/80)]"
                              : "border-white/25 text-foreground/70 hover:border-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/5")}>
                          <TrendingUp className="w-4 h-4" /> Long
                        </button>
                        <button type="button" onClick={() => setFormData({ ...formData, direction: "Short" })}
                          className={cn("flex items-center justify-center gap-2.5 py-3.5 rounded-xl border-2 transition-all duration-150 font-bold text-sm",
                            formData.direction === "Short"
                              ? "border-red-500 bg-red-500/10 text-red-400 shadow-[0_0_24px_-8px_theme(colors.red.500/80)]"
                              : "border-white/25 text-foreground/70 hover:border-red-500/60 hover:text-red-400 hover:bg-red-500/5")}>
                          <TrendingDown className="w-4 h-4" /> Short
                        </button>
                      </div>
                    </div>

                    {/* Section: Timing */}
                    <div className="px-6 pt-4 pb-4 border-b border-white/[.10]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground mb-3">Timing</p>

                      {/* R4 — Fenêtre temporelle Oracle (guidage doux) */}
                      {temporalGuidance?.recommendedWindow && (
                        <div className={cn(
                          "mb-3 px-3 py-2 rounded-lg border text-[11px] leading-snug",
                          dateWindowStatus === "outside"
                            ? "border-orange-500/30 bg-orange-500/[.06]"
                            : dateWindowStatus === "warning"
                            ? "border-amber-500/25 bg-amber-500/[.05]"
                            : "border-white/[.08] bg-white/[.02]"
                        )}>
                          <div className="flex items-start gap-2">
                            <Calendar className={cn(
                              "w-3 h-3 shrink-0 mt-0.5",
                              dateWindowStatus === "outside" ? "text-orange-400" :
                              dateWindowStatus === "warning" ? "text-amber-400" : "text-foreground/40"
                            )} />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className={cn(
                                  "font-semibold",
                                  dateWindowStatus === "outside" ? "text-orange-400" :
                                  dateWindowStatus === "warning" ? "text-amber-400" : "text-foreground/60"
                                )}>
                                  Fenêtre {temporalGuidance.oracleWindow?.name}
                                </span>
                                <span className="font-mono text-foreground/50">
                                  {formatDateShort(temporalGuidance.recommendedWindow.start)}
                                  {" → "}
                                  {formatDateShort(temporalGuidance.recommendedWindow.end)}
                                </span>
                                {temporalGuidance.offsetDays !== 0 && (
                                  <span className="text-foreground/35 italic">
                                    (Oracle + {temporalGuidance.offsetDays > 0 ? "+" : ""}{temporalGuidance.offsetDays}j offset)
                                  </span>
                                )}
                              </div>
                              {dateWindowStatus === "outside" && (
                                <p className="mt-0.5 text-orange-400/80">
                                  ⚠ Date très éloignée de la fenêtre Oracle — vérifie que tu compares les mêmes conditions de marché.
                                </p>
                              )}
                              {dateWindowStatus === "warning" && (
                                <p className="mt-0.5 text-amber-400/80">
                                  Date en limite de fenêtre (±tolérance 30%).
                                </p>
                              )}
                            </div>
                          </div>
                          {/* Oracle reference */}
                          {temporalGuidance.oracleWindow?.oracleStart && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-foreground/30">
                              <span className="font-mono text-[10px]">Oracle réf.</span>
                              <span className="font-mono text-[10px]">
                                {formatDateShort(temporalGuidance.oracleWindow.oracleStart)}
                                {" → "}
                                {formatDateShort(temporalGuidance.oracleWindow.oracleEnd)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground/85">N°</Label>
                          <Input type="number" value={formData.trade_number} onChange={(e) => setFormData({ ...formData, trade_number: e.target.value })} className="h-9 border-white/30 bg-white/[.04]" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground/85">
                            Date
                            {minTradeDate && !editingId && (
                              <span className="ml-1 text-foreground/35 font-normal normal-case">min {new Date(minTradeDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
                            )}
                          </Label>
                          <DatePicker value={formData.trade_date} onChange={handleEntryDateChange} className="border-white/30 bg-white/[.04]" minDate={!editingId ? (minTradeDate ?? undefined) : undefined} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground/85">H. Entrée</Label>
                          <TimeField value={formData.entry_time} onChange={(v) => setFormData({ ...formData, entry_time: v })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground/85">H. Sortie</Label>
                          <TimeField value={formData.exit_time} onChange={(v) => setFormData({ ...formData, exit_time: v })} className="h-9" />
                        </div>
                      </div>
                      {(!isSameDay || !formData.exit_date) && (
                        <div className="mt-2 w-1/4 space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground/85">Date sortie</Label>
                          <DatePicker value={formData.exit_date} onChange={(v) => setFormData({ ...formData, exit_date: v })} className="border-white/30 bg-white/[.04]" />
                          {!isSameDay && formData.exit_date && (
                            <p className="text-[10px] text-orange-400 font-mono mt-1">
                              J+{Math.ceil((new Date(formData.exit_date).getTime() - new Date(formData.trade_date).getTime()) / 86400000)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Section: Résultat */}
                    <div className="px-6 pt-4 pb-4 border-b border-white/[.10]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground mb-3">Résultat</p>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {([
                          { value: "Win",  label: "Win",  icon: "↑", active: "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_-8px_theme(colors.emerald.500/80)]" },
                          { value: "Loss", label: "Loss", icon: "↓", active: "border-red-500 bg-red-500/10 text-red-400 shadow-[0_0_20px_-8px_theme(colors.red.500/80)]" },
                          { value: "BE",   label: "BE",   icon: "–", active: "border-amber-500 bg-amber-500/10 text-amber-400 shadow-[0_0_20px_-8px_theme(colors.amber.500/80)]" },
                        ] as const).map((opt) => (
                          <button key={opt.value} type="button" onClick={() => setFormData({ ...formData, result: opt.value })}
                            className={cn("py-3 rounded-xl border-2 font-bold text-sm transition-all duration-150 flex items-center justify-center gap-1.5",
                              formData.result === opt.value
                                ? opt.active
                                : "border-white/25 text-foreground/70 hover:border-white/50 hover:text-foreground")}>
                            <span className="font-mono text-lg leading-none">{opt.icon}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/85">Risk / Reward (RR)</Label>
                        <Input
                          type="number" step="0.1"
                          value={formData.rr}
                          onChange={(e) => setFormData({ ...formData, rr: e.target.value })}
                          placeholder="ex : 2.5"
                          className={cn(
                            "h-10 text-xl font-bold tabular-nums border-white/30 bg-white/[.04] tracking-tight",
                            formData.result === "Win" && formData.rr ? "text-emerald-400" : "",
                            formData.result === "Loss" && formData.rr ? "text-red-400" : "",
                            formData.result === "BE" && formData.rr ? "text-amber-400" : "",
                          )}
                        />
                      </div>
                    </div>

                    {/* Section: Optionnel */}
                    <div className="px-6 pt-4 pb-5 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70 mb-3">Optionnel</p>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground/75">Taille SL</Label>
                            <Input value={formData.stop_loss_size} onChange={(e) => setFormData({ ...formData, stop_loss_size: e.target.value })} placeholder="Points / pips" className="h-9 border-white/20 bg-white/[.03]" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground/75 invisible">_</Label>
                            <div
                              className="flex items-center gap-2.5 h-9 px-3 rounded-md border border-white/[.12] cursor-pointer hover:border-white/20 transition-colors"
                              onClick={() => setFormData({ ...formData, news_day: !formData.news_day, news_label: !formData.news_day ? formData.news_label : "" })}
                            >
                              <Checkbox id="news_day_exec" checked={formData.news_day} onCheckedChange={(c) => setFormData({ ...formData, news_day: !!c, news_label: !!c ? formData.news_label : "" })} />
                              <Label htmlFor="news_day_exec" className="cursor-pointer text-xs font-semibold text-foreground/75 leading-none">Jour de news</Label>
                            </div>
                          </div>
                        </div>
                        {formData.news_day && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground/75">Label news</Label>
                            <Input value={formData.news_label} onChange={(e) => setFormData({ ...formData, news_label: e.target.value })} placeholder="NFP, CPI, FOMC…" className="h-9 border-white/20 bg-white/[.03]" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowAdvancedPrices(!showAdvancedPrices)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-foreground/60 hover:text-foreground transition-colors"
                        >
                          <span className={cn("transition-transform duration-200 text-[10px]", showAdvancedPrices ? "rotate-90" : "")}>▶</span>
                          Prix exacts
                        </button>
                        {showAdvancedPrices && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Prix Entrée</Label><Input type="number" step="0.00001" value={formData.entry_price} onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })} placeholder="1.08542" className="h-9 border-white/20 bg-white/[.03]" /></div>
                            <div className="space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Prix Sortie</Label><Input type="number" step="0.00001" value={formData.exit_price} onChange={(e) => setFormData({ ...formData, exit_price: e.target.value })} placeholder="1.08650" className="h-9 border-white/20 bg-white/[.03]" /></div>
                            <div className="space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Stop Loss</Label><Input type="number" step="0.00001" value={formData.stop_loss} onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value })} placeholder="1.08500" className="h-9 border-white/20 bg-white/[.03]" /></div>
                            <div className="space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Take Profit</Label><Input type="number" step="0.00001" value={formData.take_profit} onChange={(e) => setFormData({ ...formData, take_profit: e.target.value })} placeholder="1.08700" className="h-9 border-white/20 bg-white/[.03]" /></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── COL DROITE ── */}
                  <div className="flex flex-col gap-0 flex-1 overflow-y-auto">

                    {/* Section: Screenshots */}
                    <div className="px-6 pt-5 pb-4 border-b border-white/[.10]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground mb-3">
                        Screenshots
                        <span className="text-destructive ml-1.5">*</span>
                        {screenshotError && (
                          <span className="text-destructive text-[10px] ml-2 normal-case tracking-normal font-normal">2 screenshots requis</span>
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Contexte M15 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-foreground/85">Contexte M15</Label>
                            <div className="flex items-center gap-px bg-white/[.05] rounded-md p-0.5 border border-white/[.08]">
                              <button type="button" onClick={() => { setContextMode("file"); setContextLinkUrl(""); }} className={cn("flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all font-medium", contextMode === "file" ? "bg-white/[.1] text-foreground" : "text-foreground/60 hover:text-foreground")}><ImageIcon className="w-2.5 h-2.5" /> Fichier</button>
                              <button type="button" onClick={() => { setContextMode("link"); setContextFile(null); setContextPreview(null); setExistingContextUrl(null); }} className={cn("flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all font-medium", contextMode === "link" ? "bg-white/[.1] text-foreground" : "text-foreground/60 hover:text-foreground")}><LinkIcon className="w-2.5 h-2.5" /> Lien</button>
                            </div>
                          </div>
                          <input ref={contextFileRef} type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setContextFile, setContextPreview)} className="hidden" />
                          {contextMode === "link" ? (
                            <div className="space-y-1.5">
                              <Input type="url" value={contextLinkUrl} onChange={(e) => setContextLinkUrl(e.target.value)} placeholder="https://tradingview.com/x/…" className={cn("h-9 text-xs border-white/30 bg-white/[.04]", screenshotError && !contextLinkUrl.trim() && "border-red-500")} />
                              {contextLinkUrl.trim() && (/\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(contextLinkUrl)
                                ? <div className="relative border border-white/[.12] rounded-lg p-1"><img src={contextLinkUrl} alt="M15" className="max-h-28 object-contain mx-auto rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-4 w-4" onClick={() => setContextLinkUrl("")}><X className="w-2.5 h-2.5" /></Button></div>
                                : <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[.04] border border-white/[.08] text-xs text-foreground/50"><ExternalLink className="w-3 h-3 shrink-0" /><a href={contextLinkUrl} target="_blank" rel="noopener noreferrer" className="truncate">{contextLinkUrl}</a></div>)}
                            </div>
                          ) : (contextPreview || existingContextUrl)
                            ? <div className="relative border border-white/[.12] rounded-lg p-1"><img src={contextPreview || existingContextUrl || ""} alt="M15" className="max-h-28 object-contain mx-auto rounded" /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-4 w-4" onClick={() => { setContextFile(null); setContextPreview(null); setExistingContextUrl(null); }}><X className="w-2.5 h-2.5" /></Button></div>
                            : <Button type="button" variant="ghost" onClick={() => contextFileRef.current?.click()} className={cn("w-full h-20 border border-dashed flex-col gap-1.5 rounded-xl", screenshotError ? "border-red-500/70 hover:border-red-500" : "border-white/[.12] hover:border-white/25 hover:bg-white/[.03]")} disabled={uploading}>
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-foreground/40" /> : <ImageIcon className="w-4 h-4 text-foreground/50" />}
                                <span className="text-[11px] text-foreground/60 font-medium">M15 — Contexte</span>
                              </Button>
                          }
                        </div>
                        {/* Entrée TF */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-foreground/85">Entrée TF</Label>
                            <div className="flex items-center gap-px bg-white/[.05] rounded-md p-0.5 border border-white/[.08]">
                              <button type="button" onClick={() => { setEntryMode("file"); setEntryLinkUrl(""); }} className={cn("flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all font-medium", entryMode === "file" ? "bg-white/[.1] text-foreground" : "text-foreground/60 hover:text-foreground")}><ImageIcon className="w-2.5 h-2.5" /> Fichier</button>
                              <button type="button" onClick={() => { setEntryMode("link"); setEntryFile(null); setEntryPreview(null); setExistingEntryUrl(null); }} className={cn("flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all font-medium", entryMode === "link" ? "bg-white/[.1] text-foreground" : "text-foreground/60 hover:text-foreground")}><LinkIcon className="w-2.5 h-2.5" /> Lien</button>
                            </div>
                          </div>
                          <input ref={entryFileRef} type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setEntryFile, setEntryPreview)} className="hidden" />
                          {entryMode === "link" ? (
                            <div className="space-y-1.5">
                              <Input type="url" value={entryLinkUrl} onChange={(e) => setEntryLinkUrl(e.target.value)} placeholder="https://tradingview.com/x/…" className={cn("h-9 text-xs border-white/30 bg-white/[.04]", screenshotError && !entryLinkUrl.trim() && "border-red-500")} />
                              {entryLinkUrl.trim() && (/\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(entryLinkUrl)
                                ? <div className="relative border border-white/[.12] rounded-lg p-1"><img src={entryLinkUrl} alt="TF" className="max-h-28 object-contain mx-auto rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-4 w-4" onClick={() => setEntryLinkUrl("")}><X className="w-2.5 h-2.5" /></Button></div>
                                : <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[.04] border border-white/[.08] text-xs text-foreground/50"><ExternalLink className="w-3 h-3 shrink-0" /><a href={entryLinkUrl} target="_blank" rel="noopener noreferrer" className="truncate">{entryLinkUrl}</a></div>)}
                            </div>
                          ) : (entryPreview || existingEntryUrl)
                            ? <div className="relative border border-white/[.12] rounded-lg p-1"><img src={entryPreview || existingEntryUrl || ""} alt="TF" className="max-h-28 object-contain mx-auto rounded" /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-4 w-4" onClick={() => { setEntryFile(null); setEntryPreview(null); setExistingEntryUrl(null); }}><X className="w-2.5 h-2.5" /></Button></div>
                            : <Button type="button" variant="ghost" onClick={() => entryFileRef.current?.click()} className={cn("w-full h-20 border border-dashed flex-col gap-1.5 rounded-xl", screenshotError ? "border-red-500/70 hover:border-red-500" : "border-white/[.12] hover:border-white/25 hover:bg-white/[.03]")} disabled={uploading}>
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-foreground/40" /> : <ImageIcon className="w-4 h-4 text-foreground/50" />}
                                <span className="text-[11px] text-foreground/60 font-medium">TF — Entrée</span>
                              </Button>
                          }
                        </div>
                      </div>
                    </div>

                    {/* Section: Classification */}
                    <div className="px-6 pt-4 pb-4 border-b border-white/[.10] flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70 mb-3">Classification du Setup</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                        <div className="space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Type de config</Label><CustomizableMultiSelect value={formData.setup_type} onChange={(v) => setFormData({ ...formData, setup_type: v })} fixedOptions={SETUP_TYPE_FIXED_OPTIONS} customOptions={variables.setup_type} variableType="setup_type" placeholder="Sélectionner…" onOptionsChanged={refetchVariables} compact /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Contexte</Label><CustomizableMultiSelect value={formData.direction_structure} onChange={(v) => setFormData({ ...formData, direction_structure: v })} customOptions={variables.direction_structure} variableType="direction_structure" placeholder="Sélectionner…" onOptionsChanged={refetchVariables} compact /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Entry Model</Label><CustomizableMultiSelect value={formData.entry_model} onChange={(v) => setFormData({ ...formData, entry_model: v })} fixedOptions={ENTRY_MODEL_FIXED_OPTIONS} customOptions={variables.entry_model} variableType="entry_model" placeholder="Sélectionner…" onOptionsChanged={refetchVariables} compact /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Timing</Label><CustomizableMultiSelect value={formData.entry_timing} onChange={(v) => setFormData({ ...formData, entry_timing: v })} fixedOptions={TIMING_FIXED_OPTIONS} customOptions={variables.entry_timing} variableType="entry_timing" placeholder="Sélectionner…" onOptionsChanged={refetchVariables} compact /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Time Frame</Label><CustomizableMultiSelect value={formData.entry_timeframe} onChange={(v) => setFormData({ ...formData, entry_timeframe: v })} fixedOptions={ENTRY_TIMEFRAME_FIXED_OPTIONS} customOptions={variables.entry_timeframe} variableType="entry_timeframe" placeholder="Sélectionner…" onOptionsChanged={refetchVariables} compact /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Placement SL</Label><CustomizableMultiSelect value={formData.sl_placement} onChange={(v) => setFormData({ ...formData, sl_placement: v })} customOptions={variables.sl_placement || []} variableType="sl_placement" placeholder="Sélectionner…" onOptionsChanged={refetchVariables} compact /></div>
                        <div className="col-span-2 space-y-1.5"><Label className="text-xs font-semibold text-foreground/75">Placement TP</Label><CustomizableMultiSelect value={formData.tp_placement} onChange={(v) => setFormData({ ...formData, tp_placement: v })} customOptions={variables.tp_placement || []} variableType="tp_placement" placeholder="Sélectionner…" onOptionsChanged={refetchVariables} compact /></div>
                      </div>
                    </div>

                    {/* Section: Notes */}
                    <div className="px-6 pt-4 pb-5">
                      <Label className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70 block mb-3">Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Observations, contexte du trade…"
                        className="resize-none h-16 border-white/20 bg-white/[.03] text-sm placeholder:text-foreground/25"
                      />
                    </div>

                  </div>{/* fin col droite */}
                </div>{/* fin corps 2 colonnes */}

                {/* Footer — actions */}
                <div className="flex items-center justify-between px-6 py-3.5 border-t border-border flex-shrink-0">
                  <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                    {editingId ? "Modification en cours" : "Nouveau trade"}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                      <X className="w-3.5 h-3.5 mr-1.5" /> Annuler
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving || uploading} className="gap-1.5 px-5">
                      {(saving || uploading) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {uploading ? "Upload en cours…" : "Enregistrer le trade"}
                    </Button>
                  </div>
                </div>

              </DialogContent>
          </Dialog>
        </div>
        </div>
      </div>

      {/* Cycle Progress & Timer - responsive */}
      <div className="p-3 md:p-6 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
          {/* Current Cycle Progress */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5 md:mb-2">
              <div className="flex items-center gap-1.5 md:gap-2">
                <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                <span className="text-xs md:text-sm font-medium text-foreground">
                  {cycleInfo.name}
                </span>
                {cycleInfo.isComplete && (
                  <span className="text-[9px] md:text-xs bg-emerald-500/20 text-emerald-400 px-1.5 md:px-2 py-0.5 rounded-full">
                    OK
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-xs md:text-sm font-mono font-semibold text-foreground">
                  {cycleInfo.current}/{cycleInfo.target}
                </span>
                <span className="text-[9px] md:text-xs text-muted-foreground hidden sm:inline">
                  ({cycleInfo.totalCurrent} total)
                </span>
              </div>
            </div>
            <Progress value={cycleInfo.progress} className="h-1.5 md:h-2" />
          </div>

          {/* Session Timer - compact on mobile */}
          <div className="flex items-center gap-2 border border-border/40 rounded-md px-2 md:px-3 py-1.5 md:py-2 self-start md:self-auto">
            <Timer className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
            <span className="font-mono text-sm md:text-lg font-medium min-w-[50px] md:min-w-[70px] text-center">
              {formatTimer(timerSeconds)}
            </span>
            <div className="flex items-center gap-0.5 md:gap-1 ml-1 md:ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 md:h-7 md:w-7"
                onClick={() => setTimerRunning(!timerRunning)}
              >
                {timerRunning ? (
                  <Pause className="w-3 h-3 md:w-3.5 md:h-3.5" />
                ) : (
                  <Play className="w-3 h-3 md:w-3.5 md:h-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 md:h-7 md:w-7"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(0);
                }}
              >
                <RotateCcw className="w-3 h-3 md:w-3.5 md:h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats - responsive */}
      <div className="p-3 md:p-6 border-b border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <div className="border border-border/40 p-2.5 md:p-4 bg-transparent rounded-md">
            <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
              <FileSpreadsheet className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Trades
              </span>
            </div>
            <p className="text-lg md:text-2xl font-bold text-foreground">{stats.total}</p>
          </div>

          <div className="border border-border/40 p-2.5 md:p-4 bg-transparent rounded-md">
            <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
              <Target className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Win Rate
              </span>
            </div>
            <p className={cn(
              "text-lg md:text-2xl font-bold",
              winRate >= 50 ? "text-emerald-400" : "text-red-400"
            )}>
              {winRate.toFixed(0)}%
            </p>
          </div>

          <div className="border border-border/40 p-2.5 md:p-4 bg-transparent rounded-md">
            <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Total RR
              </span>
            </div>
            <p className={cn(
              "text-lg md:text-2xl font-bold",
              stats.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {stats.totalRR >= 0 ? "+" : ""}{stats.totalRR.toFixed(1)}
            </p>
          </div>

          <div className="border border-border/40 p-2.5 md:p-4 bg-transparent rounded-md">
            <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                W / L
              </span>
            </div>
            <p className="text-lg md:text-2xl font-bold text-foreground">
              <span className="text-emerald-400">{stats.wins}</span>
              <span className="text-muted-foreground mx-0.5 md:mx-1">/</span>
              <span className="text-red-400">{stats.losses}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Trades list - card format like OracleDatabase */}
      <div className="flex-1 p-3 md:p-6 overflow-auto">
        {executions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Aucune exécution enregistrée
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Commencez à saisir vos trades pour les valider et les analyser.
            </p>
            <Button onClick={handleNewEntry}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter votre premier trade
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {executions.map((execution, execIdx) => {
              const isSelected = selectedExecution?.id === execution.id;
              const cycleInfo = getCycleLabelForTrade(execution.trade_number);
              const prevExecution = execIdx > 0 ? executions[execIdx - 1] : null;
              const prevCycleInfo = prevExecution ? getCycleLabelForTrade(prevExecution.trade_number) : null;
              const showCycleHeader = cycleInfo && cycleInfo.label !== prevCycleInfo?.label;

              return (
                <React.Fragment key={execution.id}>
                  {showCycleHeader && (
                    <div className="flex items-center gap-3 pt-3 pb-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">
                        {cycleInfo.label}
                        <span className="ml-2 text-muted-foreground/40">
                          {cycleInfo.start}–{cycleInfo.end}
                        </span>
                      </span>
                      <div className="flex-1 border-t border-border/40" />
                    </div>
                  )}
                <div
                  className={cn(
                    "border transition-all rounded-md overflow-hidden",
                    isSelected
                      ? "border-foreground/20 bg-accent/40"
                      : "border-border hover:bg-accent/30 bg-transparent"
                  )}
                >
                  {/* Main row - clickable */}
                  <div 
                    onClick={() => setSelectedExecution(isSelected ? null : execution)}
                    className="px-3 md:px-5 py-2.5 md:py-3 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3 md:gap-5">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="text-sm md:text-lg font-bold text-muted-foreground/50 w-8 md:w-10">
                          {String(execution.trade_number).padStart(3, "0")}
                        </span>
                      </div>

                      <div
                        className={cn(
                          "flex items-center gap-1.5 md:gap-2",
                          execution.direction === "Long" ? "text-emerald-500" : "text-red-500"
                        )}
                      >
                        {execution.direction === "Long" ? (
                          <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        )}
                        <span className="text-[10px] md:text-xs font-mono uppercase">{execution.direction}</span>
                      </div>

                      <div className="hidden md:block">
                        <p className="text-sm text-foreground">{new Date(execution.trade_date).toLocaleDateString("fr-FR")}</p>
                        <p className="text-[10px] text-muted-foreground">{execution.entry_time || "—"}</p>
                      </div>

                      <div className="hidden lg:block">
                        <p className="text-[10px] text-muted-foreground font-mono">{execution.setup_type || "—"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                      <div className="text-right">
                        <p className={cn(
                          "text-sm font-bold",
                          (execution.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          {execution.rr !== null ? `${execution.rr >= 0 ? "+" : ""}${execution.rr.toFixed(1)}` : "—"}
                        </p>
                        <p className="text-[9px] text-muted-foreground font-mono uppercase">RR</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 md:h-8 md:w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(execution);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 md:h-8 md:w-8 text-red-400 hover:text-red-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(execution.id, execution.trade_number);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isSelected && (
                    <div className="border-t border-border p-3 md:p-4 space-y-3 md:space-y-4 bg-transparent">
                      {/* Trade header */}
                      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3 md:p-4 border border-border bg-transparent rounded-md">
                        <div className={cn(
                          "w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border rounded-md flex-shrink-0",
                          execution.direction === "Long" 
                            ? "border-emerald-500/50 bg-emerald-500/10" 
                            : "border-red-500/50 bg-red-500/10"
                        )}>
                          {execution.direction === "Long" 
                            ? <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
                            : <TrendingDown className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base md:text-lg font-bold text-foreground">
                            Trade #{execution.trade_number}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground truncate">
                            {execution.setup_type || "Setup"} • {execution.entry_model || "Model"}
                          </p>
                        </div>
                        <div className="text-left md:text-right">
                          <p className={cn(
                            "text-lg md:text-xl font-bold",
                            (execution.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            {execution.rr !== null ? `${execution.rr >= 0 ? "+" : ""}${execution.rr.toFixed(2)} RR` : "—"}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            {new Date(execution.trade_date).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </div>

                      {/* Stats row - 2x2 grid on mobile */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                        <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                          <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                            <Clock className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                            <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Entrée</span>
                          </div>
                          <p className="text-sm md:text-base font-bold text-foreground">{execution.entry_time || "—"}</p>
                        </div>
                        <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                          <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                            <Clock className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                            <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Sortie</span>
                          </div>
                          <p className="text-sm md:text-base font-bold text-foreground">{execution.exit_time || "—"}</p>
                        </div>
                        <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                          <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                            <Target className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                            <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Résultat</span>
                          </div>
                          <p className={cn(
                            "text-sm md:text-base font-bold",
                            execution.result === "Win" ? "text-emerald-400" 
                              : execution.result === "Loss" ? "text-red-400" 
                              : "text-foreground"
                          )}>
                            {execution.result || "—"}
                          </p>
                        </div>
                        <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                          <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                            <Calendar className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                            <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Date Sortie</span>
                          </div>
                          <p className="text-sm md:text-base font-bold text-foreground">
                            {execution.exit_date ? new Date(execution.exit_date).toLocaleDateString("fr-FR") : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Additional info - responsive */}
                      <div className="grid grid-cols-3 gap-2 md:gap-3">
                        <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                          <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Contexte</span>
                          <p className="text-xs md:text-sm font-medium text-foreground mt-0.5 md:mt-1">{execution.direction_structure || "—"}</p>
                        </div>
                        <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                          <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Entry</span>
                          <p className="text-xs md:text-sm font-medium text-foreground mt-0.5 md:mt-1">{execution.entry_timing || "—"}</p>
                        </div>
                        <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                          <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Model</span>
                          <p className="text-xs md:text-sm font-medium text-foreground mt-0.5 md:mt-1">{execution.entry_model || "—"}</p>
                        </div>
                      </div>

                      {/* RR charts - vertical stack on mobile (like OracleDatabase) */}
                      {(() => {
                        const context = getTradeContext(execution);
                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                              {/* Bar chart - individual RR per trade */}
                              <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                                <div className="flex items-center justify-between mb-3 md:mb-4">
                                  <h4 className="text-[9px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                    RR par Trade
                                  </h4>
                                </div>
                                <div className="h-28 md:h-36">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={context.chartData}>
                                      <XAxis 
                                        dataKey="trade" 
                                        tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                                        axisLine={{ stroke: "var(--chart-axis-line)" }}
                                        tickLine={false}
                                      />
                                      <YAxis 
                                        tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                                        axisLine={{ stroke: "var(--chart-axis-line)" }}
                                        tickLine={false}
                                      />
                                      <Tooltip
                                        contentStyle={{
                                          backgroundColor: "var(--chart-tooltip-bg)",
                                          border: "1px solid var(--chart-tooltip-border)",
                                          borderRadius: 4,
                                          color: "var(--chart-tooltip-text)",
                                        }}
                                        itemStyle={{ color: "var(--chart-tooltip-text)" }}
                                        labelStyle={{ color: "var(--chart-tooltip-text)" }}
                                        formatter={(value: number, name: string, props: any) => [
                                          `${value.toFixed(2)} RR`,
                                          `Trade #${props.payload.tradeNum}`
                                        ]}
                                      />
                                      <Bar 
                                        dataKey="individual" 
                                        radius={[3, 3, 0, 0]}
                                      >
                                        {context.chartData.map((entry, index) => (
                                          <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.current ? "var(--chart-bar)" : "#22c55e"}
                                          />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>

                              {/* Isolated cumulative RR chart */}
                              <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                                <div className="flex items-center justify-between mb-3 md:mb-4">
                                  <h4 className="text-[9px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                    Cumul Isolé
                                  </h4>
                                  <span className="text-sm md:text-base font-bold text-emerald-500">
                                    +{context.isolatedTotal.toFixed(2)}
                                  </span>
                                </div>
                                <div className="h-28 md:h-36">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={context.chartData}>
                                      <defs>
                                        <linearGradient id={`colorIsolatedRR-${execution.id}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                        </linearGradient>
                                      </defs>
                                      <XAxis 
                                        dataKey="trade" 
                                        tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                                        axisLine={{ stroke: "var(--chart-axis-line)" }}
                                        tickLine={false}
                                      />
                                      <YAxis 
                                        tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                                        axisLine={{ stroke: "var(--chart-axis-line)" }}
                                        tickLine={false}
                                      />
                                      <Tooltip
                                        contentStyle={{
                                          backgroundColor: "var(--chart-tooltip-bg)",
                                          border: "1px solid var(--chart-tooltip-border)",
                                          borderRadius: 4,
                                          color: "var(--chart-tooltip-text)",
                                        }}
                                        itemStyle={{ color: "var(--chart-tooltip-text)" }}
                                        labelStyle={{ color: "var(--chart-tooltip-text)" }}
                                        formatter={(value: number, name: string, props: any) => [
                                          `${value.toFixed(2)} RR`,
                                          `Trade #${props.payload.tradeNum}`
                                        ]}
                                      />
                                      <Area 
                                        type="monotone" 
                                        dataKey="rr" 
                                        stroke="#22c55e" 
                                        fillOpacity={1}
                                        fill={`url(#colorIsolatedRR-${execution.id})`}
                                      />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            </div>

                            {/* Total cumulative RR note */}
                            <div className="flex items-center justify-between p-2 md:p-3 border border-border bg-card rounded-md">
                              <span className="text-[9px] md:text-xs text-muted-foreground font-mono uppercase">Cumul Total</span>
                              <span className={cn(
                                "text-sm md:text-base font-bold",
                                context.cumulativeRR >= 0 ? "text-emerald-500" : "text-red-500"
                              )}>
                                {context.cumulativeRR >= 0 ? "+" : ""}{context.cumulativeRR.toFixed(2)} RR
                              </span>
                            </div>
                          </>
                        );
                      })()}

                      {/* Screenshots - same display as Oracle Database */}
                      {(execution.screenshot_url || (execution as any).screenshot_entry_url) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                          <SignedImageCard
                            storagePath={execution.screenshot_url}
                            alt={`Trade #${execution.trade_number} M15`}
                            label="M15 / Contexte"
                          />
                          <SignedImageCard
                            storagePath={(execution as any).screenshot_entry_url}
                            alt={`Trade #${execution.trade_number} M5`}
                            label="M5 / Entrée"
                          />
                        </div>
                      )}

                      {/* Notes */}
                      {execution.notes && (
                        <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                          <span className="text-[9px] md:text-xs text-muted-foreground font-mono uppercase block mb-2">Notes</span>
                          <p className="text-xs md:text-sm text-foreground">{execution.notes}</p>
                        </div>
                      )}

                    </div>
                  )}
                </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
