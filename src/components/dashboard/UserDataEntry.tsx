import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  OracleCycleWindow,
  getUserCurrentCycleNum,
  computeUserOffset,
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
  BarChart3,
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
  Lock,
  Send,
  CheckCircle2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScreenshotLink } from "./ScreenshotLink";
import { TradeExpandCard } from "./TradeExpandCard";
import { TradeEntryDialog } from "./TradeEntryDialog";
import {
  OracleExecution as OracleExecutionData,
  TradeCardData,
  toOracleTradeCard,
} from "@/lib/trade/types";

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

// Cycle thresholds — source de vérité : ORACLE_CYCLE_BOUNDARIES dans oracle-cycle-windows.ts
// Règle §13 (dans le marbre) : 314 trades au total. Cycles 6-8 = 50/50/49 trades.
// Ne JAMAIS modifier ces valeurs sans mettre à jour ORACLE_CYCLE_BOUNDARIES en même temps.
const CYCLE_THRESHOLDS = [
  { max: 15,  name: "Ébauche" },     // Trades 1-15   (15 trades)
  { max: 40,  name: "Cycle 1" },     // Trades 16-40  (25 trades)
  { max: 65,  name: "Cycle 2" },     // Trades 41-65  (25 trades)
  { max: 90,  name: "Cycle 3" },     // Trades 66-90  (25 trades)
  { max: 115, name: "Cycle 4" },     // Trades 91-115 (25 trades)
  { max: 165, name: "Cycle 5" },     // Trades 116-165 (50 trades)
  { max: 215, name: "Cycle 6" },     // Trades 166-215 (50 trades)
  { max: 265, name: "Cycle 7" },     // Trades 216-265 (50 trades)
  { max: 314, name: "Cycle 8" },     // Trades 266-314 (49 trades)
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
  /** CTA pont → Data Analysis (My Oracle) */
  onNavigateToAnalysis?: () => void;
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


export const UserDataEntry = ({ tradeComparisons = [], oracleTrades = [], oracleCycleWindows = [], onNavigateToAnalysis }: UserDataEntryProps) => {
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
  // Dead code nettoyé : contextMode/entryMode/contextLinkUrl/entryLinkUrl supprimés.
  // Le toggle fichier/lien est géré dans TradeEntryDialog.tsx (composant partagé).
  // Screenshot validation state
  const [screenshotError, setScreenshotError] = useState(false);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const contextFileRef = useRef<HTMLInputElement>(null);
  const entryFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Phase 1.B — trades verrouillés pendant vérification en cours
  const [lockedCycleTradeNumbers, setLockedCycleTradeNumbers] = useState<Set<number>>(new Set());

  // Verification state — Slice D (cycles 1-8 uniquement, jamais l'Ébauche §0.3a)
  const [currentCycleDb, setCurrentCycleDb] = useState<{
    cycleId: string;
    userCycleId: string;
    cycleNumber: number;
    cycleName: string;
  } | null>(null);
  const [pendingVerif, setPendingVerif] = useState<{
    id: string;
    requestedAt: string;
  } | null>(null);
  const [submittingVerif, setSubmittingVerif] = useState(false);
  const [retractingVerif, setRetractingVerif] = useState(false);
  const submittingVerifRef = useRef(false);

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

  // Fetch user executions
  useEffect(() => {
    fetchExecutions();
    fetchLockedCycles();
    fetchCurrentCycleState();
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

  // Phase 1.B — Récupère les cycles verrouillés (vérification en cours)
  // et construit un Set des numéros de trade non modifiables.
  //
  // ⚠️ Important (fix 2026-05-02) : `user_cycles.status` n'accepte QUE les valeurs
  // {locked, in_progress, pending_review, validated, rejected}. Les statuts
  // 'in_review' et 'on_hold' vivent UNIQUEMENT sur `verification_requests.status`
  // (cf. décision design dans OracleExecution.tsx). Filtrer user_cycles dessus
  // → PostgREST renvoie 400 et bloque le rendu.
  //
  // Logique correcte : un cycle est "verrouillé" pour l'user dès que sa row
  //   user_cycles.status = 'pending_review' (= il a soumis sa vérification),
  // OU s'il existe une verification_request en cours (pending/in_review/on_hold)
  // pour ce cycle. On combine les deux sources.
  const fetchLockedCycles = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Source 1 : user_cycles avec status = pending_review (verrouillage côté user)
    const ucPromise = supabase
      .from("user_cycles")
      .select("cycle_id, status, cycles(trade_start, trade_end)")
      .eq("user_id", user.id)
      .eq("status", "pending_review");

    // Source 2 : verification_requests actives → cycle_id concernés
    const vrPromise = supabase
      .from("verification_requests")
      .select("cycle_id, cycles(trade_start, trade_end)")
      .eq("user_id", user.id)
      .in("status", ["pending", "in_review", "on_hold"]);

    const [{ data: ucData, error: ucErr }, { data: vrData, error: vrErr }] =
      await Promise.all([ucPromise, vrPromise]);

    if (ucErr) console.error("[Phase1B] Error fetching locked cycles (user_cycles):", ucErr);
    if (vrErr) console.error("[Phase1B] Error fetching locked cycles (verification_requests):", vrErr);

    const locked = new Set<number>();
    const consume = (rows: any[] | null | undefined) => {
      (rows || []).forEach((row: any) => {
        const c = row.cycles;
        if (c && c.trade_start != null && c.trade_end != null) {
          for (let n = c.trade_start; n <= c.trade_end; n++) {
            locked.add(n);
          }
        }
      });
    };
    consume(ucData);
    consume(vrData);
    setLockedCycleTradeNumbers(locked);
  };

  // ── Slice D — Charge le cycle actif (in_progress, cycle_number ≥ 1) + VR pending
  // Règle §0.3a : l'Ébauche (cycle_number=0) est exclue — jamais de verification_request
  const fetchCurrentCycleState = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupère tous les user_cycles in_progress avec leur cycle metadata
      const { data: ucRows } = await supabase
        .from("user_cycles")
        .select("id, cycle_id, status, cycles(id, cycle_number, name)")
        .eq("user_id", user.id)
        .in("status", ["in_progress", "pending_review"]);

      // Filtre côté JS pour exclure l'Ébauche (cycle_number=0)
      const activeReal = (ucRows || []).find((uc: any) => {
        const c = uc.cycles as any;
        return c && c.cycle_number >= 1;
      });

      if (!activeReal) {
        setCurrentCycleDb(null);
        setPendingVerif(null);
        return;
      }

      const cycle = activeReal.cycles as any;
      setCurrentCycleDb({
        cycleId: activeReal.cycle_id,
        userCycleId: activeReal.id,
        cycleNumber: cycle.cycle_number,
        cycleName: cycle.name,
      });

      // Vérifie s'il y a une verification_request pending pour ce cycle
      const { data: vr } = await supabase
        .from("verification_requests")
        .select("id, requested_at")
        .eq("user_id", user.id)
        .eq("cycle_id", activeReal.cycle_id)
        .eq("status", "pending")
        .maybeSingle();

      setPendingVerif(vr ? { id: vr.id, requestedAt: vr.requested_at } : null);
    } catch (err) {
      console.warn("[UserDataEntry] fetchCurrentCycleState:", err);
    }
  };

  // ── Slice D — Soumet une demande de vérification (anti-doublon 3 couches)
  const handleRequestVerification = async () => {
    if (!currentCycleDb || !cycleInfo.isComplete || submittingVerifRef.current) return;
    submittingVerifRef.current = true;
    setSubmittingVerif(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Couche 1 — check DB avant INSERT (anti-doublon)
      const { data: existing } = await supabase
        .from("verification_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("cycle_id", currentCycleDb.cycleId)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        setPendingVerif({ id: existing.id, requestedAt: new Date().toISOString() });
        toast({ title: "Déjà soumis", description: "Une demande est déjà en attente pour ce cycle." });
        return;
      }

      // INSERT avec user_cycle_id NOT NULL requis en DB
      const { data: inserted, error } = await supabase
        .from("verification_requests")
        .insert({
          user_id: user.id,
          cycle_id: currentCycleDb.cycleId,
          user_cycle_id: currentCycleDb.userCycleId,
          status: "pending",
        } as any)
        .select("id, requested_at")
        .single();

      if (error) {
        // Couche 2 — contrainte unique DB (code 23505) → déjà soumis
        if (error.code === "23505") {
          toast({ title: "Déjà soumis", description: "La demande a déjà été envoyée." });
          await fetchCurrentCycleState();
          return;
        }
        throw error;
      }

      setPendingVerif({ id: inserted.id, requestedAt: inserted.requested_at });
      // Mettre user_cycles en pending_review pour verrouiller les trades côté admin et OracleHomePage
      await supabase
        .from("user_cycles")
        .update({ status: "pending_review" } as any)
        .eq("id", currentCycleDb.userCycleId)
        .eq("user_id", user.id);
      // Refresh locked cycles pour verrouiller les trades
      await fetchLockedCycles();
      toast({
        title: "Demande envoyée ✓",
        description: "L'admin a été notifié. Vous pouvez annuler tant que la vérification n'a pas débuté.",
      });
    } catch (err: any) {
      console.error("[UserDataEntry] handleRequestVerification:", err);
      toast({ title: "Erreur", description: "Impossible d'envoyer la demande. Réessayez.", variant: "destructive" });
    } finally {
      submittingVerifRef.current = false;
      setSubmittingVerif(false);
    }
  };

  // ── Slice D — Annule une demande de vérification (RPC retract_verification_request)
  const handleRetractVerification = async () => {
    if (!pendingVerif || retractingVerif) return;
    setRetractingVerif(true);

    try {
      const { error } = await supabase.rpc("retract_verification_request", {
        p_request_id: pendingVerif.id,
      } as any);

      if (error) throw error;

      setPendingVerif(null);
      // Déverrouille les trades
      await fetchLockedCycles();
      toast({ title: "Demande annulée", description: "Vous pouvez à nouveau modifier vos trades." });
    } catch (err: any) {
      console.error("[UserDataEntry] handleRetractVerification:", err);
      toast({
        title: "Impossible d'annuler",
        description: "La vérification est peut-être déjà en cours. Contactez un admin.",
        variant: "destructive",
      });
      // Resync avec la DB
      await fetchCurrentCycleState();
    } finally {
      setRetractingVerif(false);
    }
  };

  // Get next trade number
  const getNextTradeNumber = () => {
    if (executions.length === 0) return 1;
    return Math.max(...executions.map(e => e.trade_number)) + 1;
  };

  // ── Numéro de cycle courant (pour l'en-tête du dialog) ──────────────────────
  const temporalGuidance = useMemo(() => {
    if (oracleCycleWindows.length === 0) return null;
    const currentCycleNum = getUserCurrentCycleNum(executions.length);
    if (currentCycleNum >= USER_CYCLE_THRESHOLDS.length) return null;
    const offsetDays = computeUserOffset(currentCycleNum, oracleCycleWindows, executions);
    return { currentCycleNum, offsetDays };
  }, [executions, oracleCycleWindows]);

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
    setEditingId(execution.id);
    setEditingExec(execution);
    setIsDialogOpen(true);
  };

  // Called by TradeExpandCard onEdit — receives TradeCardData, forwards to handleEdit
  const handleEditFromCard = (trade: TradeCardData) => {
    handleEdit(trade as unknown as UserExecution);
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
    const hasContext = !!(contextFile || existingContextUrl);
    const hasEntry = !!(entryFile || existingEntryUrl);
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
      uploadScreenshot(user.id, tradeNum, contextFile, existingContextUrl, "context"),
      uploadScreenshot(user.id, tradeNum, entryFile, existingEntryUrl, "entry"),
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

  // Export — ZIP (CSV + screenshots)
  const handleExport = async () => {
    if (executions.length === 0) {
      toast({ title: "Aucune donnée", description: "Aucun trade à exporter.", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const screenshotsFolder = zip.folder("screenshots")!;

      // track downloaded files to reference correctly in CSV
      const downloadedFiles: Record<string, string> = {}; // filename → actual filename with ext

      // Download one screenshot — only Supabase storage paths (external URLs can't be fetched due to CORS)
      const addScreenshot = async (path: string | null | undefined, filename: string) => {
        if (!path) return;
        // External URL (link mode) → skip download, will be referenced as URL in CSV
        if (path.startsWith("http://") || path.startsWith("https://")) return;
        // Supabase storage path → get signed URL
        const { data: urlData, error: signError } = await supabase.storage
          .from("trade-screenshots")
          .createSignedUrl(path, 3600);
        if (signError || !urlData?.signedUrl) {
          console.error(`[Export] signed URL failed for ${path}:`, signError);
          return;
        }
        try {
          const response = await fetch(urlData.signedUrl);
          if (!response.ok) {
            console.error(`[Export] fetch failed (${response.status}) for ${path}`);
            return;
          }
          const blob = await response.blob();
          const rawExt = path.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
          const ext = ["jpg", "jpeg", "png", "gif", "webp"].includes(rawExt) ? rawExt : "jpg";
          const fullName = `${filename}.${ext}`;
          screenshotsFolder.file(fullName, blob);
          downloadedFiles[filename] = `screenshots/${fullName}`;
        } catch (err) {
          console.error(`[Export] download error for ${path}:`, err);
        }
      };

      // Download all screenshots in parallel
      await Promise.all(
        executions.flatMap((e) => {
          const num = String(e.trade_number).padStart(3, "0");
          return [
            addScreenshot(e.screenshot_url, `trade_${num}_contexte`),
            addScreenshot(e.screenshot_entry_url, `trade_${num}_entree`),
          ];
        })
      );

      // Build CSV
      const headers = [
        "Trade #", "Date Entrée", "Date Sortie", "Direction",
        "Heure Entrée", "Heure Sortie", "Prix Entrée", "Prix Sortie",
        "Stop Loss", "Take Profit", "RR", "Résultat",
        "Setup", "Entry Model", "Structure", "Timing",
        "Screenshot Contexte", "Screenshot Entrée", "Notes",
      ];
      const escape = (v: string | number | null | undefined) => {
        const s = String(v ?? "");
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csvRows = [
        headers.join(","),
        ...executions.map((e) => {
          const num = String(e.trade_number).padStart(3, "0");
          const ctxRef = e.screenshot_url
            ? (downloadedFiles[`trade_${num}_contexte`] ?? e.screenshot_url)
            : "";
          const entRef = e.screenshot_entry_url
            ? (downloadedFiles[`trade_${num}_entree`] ?? e.screenshot_entry_url)
            : "";
          return [
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
            ctxRef,
            entRef,
            escape(e.notes),
          ].map(escape).join(",");
        }),
      ];
      zip.file("trades.csv", csvRows.join("\n"));

      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `oracle_trades_${new Date().toISOString().split("T")[0]}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      const imgCount = Object.keys(downloadedFiles).length;
      toast({
        title: "Export réussi",
        description: imgCount > 0
          ? `${executions.length} trades exportés avec ${imgCount} screenshot${imgCount > 1 ? "s" : ""}.`
          : `${executions.length} trades exportés (screenshots en mode lien — non téléchargeables).`,
      });
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Erreur d'export", description: "Une erreur est survenue lors de l'export.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
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
            {onNavigateToAnalysis && (
              <Button variant="outline" size="sm" onClick={onNavigateToAnalysis} className="gap-1.5 flex-1 md:flex-none border-violet-500/30 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">My Oracle →</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting} className="gap-1.5 flex-1 md:flex-none">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">{isExporting ? "Export..." : "Export"}</span>
            </Button>
            <Button size="sm" onClick={handleNewEntry} className="gap-1.5 flex-1 md:flex-none">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouveau</span> Trade
            </Button>
            <TradeEntryDialog
              mode="oracle"
              isOpen={isDialogOpen}
              onClose={() => { setIsDialogOpen(false); setEditingExec(null); setEditingId(null); }}
              onSaved={() => { setIsDialogOpen(false); setEditingExec(null); setEditingId(null); fetchExecutions(); }}
              readOnly={editingExec != null && lockedCycleTradeNumbers.has(editingExec.trade_number)}
              editingTrade={editingExec ? toOracleTradeCard(editingExec as unknown as OracleExecutionData) : null}
              nextTradeNumber={getNextTradeNumber()}
              currentCycleNum={temporalGuidance?.currentCycleNum ?? null}
            />
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

            {/* Vérification banner — cycles 1-8 uniquement (§0.3a : pas d'Ébauche) */}
            {currentCycleDb && (
              <div className="mt-2.5 pt-2.5 border-t border-border/20 flex flex-wrap items-center justify-between gap-2">
                {pendingVerif ? (
                  /* État pending — demande en attente, annulation possible */
                  <>
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-medium">
                        Vérification en attente —{" "}
                        {new Date(pendingVerif.requestedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetractVerification}
                      disabled={retractingVerif}
                      className="h-7 gap-1.5 text-xs text-amber-400 border-amber-400/30 hover:bg-amber-400/10 shrink-0"
                    >
                      {retractingVerif
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <X className="w-3 h-3" />}
                      Annuler la demande
                    </Button>
                  </>
                ) : (
                  /* État normal — bouton grisé ou actif selon completion */
                  <>
                    {cycleInfo.isComplete ? (
                      <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Cycle complet — prêt pour vérification
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Complétez le cycle ({cycleInfo.current}/{cycleInfo.target} trades) pour débloquer la vérification
                      </span>
                    )}
                    <Button
                      size="sm"
                      onClick={handleRequestVerification}
                      disabled={!cycleInfo.isComplete || submittingVerif}
                      className="h-7 gap-1.5 text-xs shrink-0"
                    >
                      {submittingVerif
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : cycleInfo.isComplete
                          ? <Send className="w-3 h-3" />
                          : <Lock className="w-3 h-3" />}
                      {submittingVerif ? "Envoi..." : "Demander une vérification"}
                    </Button>
                  </>
                )}
              </div>
            )}
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
              const cycleInfo = getCycleLabelForTrade(execution.trade_number);
              const prevExecution = execIdx > 0 ? executions[execIdx - 1] : null;
              const prevCycleInfo = prevExecution ? getCycleLabelForTrade(prevExecution.trade_number) : null;
              const showCycleHeader = cycleInfo && cycleInfo.label !== prevCycleInfo?.label;

              // Convert to discriminated union (cast safe — select("*") fetches all DB fields)
              const tradeCard = toOracleTradeCard(execution as unknown as OracleExecutionData);
              // scopeTrades = all executions (cycle scope computed inside TradeExpandCard)
              const scopeTrades = executions.map(e => toOracleTradeCard(e as unknown as OracleExecutionData));

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
                  <TradeExpandCard
                    trade={tradeCard}
                    isExpanded={expandedTradeId === execution.id}
                    onToggle={() => setExpandedTradeId(expandedTradeId === execution.id ? null : execution.id)}
                    onEdit={handleEditFromCard}
                    onDelete={handleDelete}
                    scopeTrades={scopeTrades}
                    isLocked={lockedCycleTradeNumbers.has(execution.trade_number)}
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
