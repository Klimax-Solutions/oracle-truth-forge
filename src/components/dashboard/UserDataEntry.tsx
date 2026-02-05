import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { CustomizableSelect } from "@/components/dashboard/CustomizableSelect";
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
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Play,
  Pause,
  RotateCcw,
  Timer,
  Trophy,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScreenshotLink } from "./ScreenshotLink";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

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
  notes: string;
}

// Fixed options for Entry Model (non-deletable)
const ENTRY_MODEL_FIXED_OPTIONS = [
  "Englobante M1",
  "Englobante M3",
  "Englobante M5",
  "High-Low 3 bougies",
  "WICK",
  "Prise de liquidité",
];

// Time constraints
const MIN_ENTRY_TIME = "15:20";
const MAX_TIME = "22:00";

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
  notes: "",
};

export const UserDataEntry = ({ tradeComparisons = [], oracleTrades = [] }: UserDataEntryProps) => {
  const [executions, setExecutions] = useState<UserExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [existingScreenshot, setExistingScreenshot] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<UserExecution | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille maximale est de 5 MB.",
          variant: "destructive",
        });
        return;
      }

      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload screenshot to storage - returns the storage path (not public URL)
  const uploadScreenshot = async (userId: string, tradeNumber: number): Promise<string | null> => {
    if (!screenshotFile) return existingScreenshot;

    setUploading(true);
    const fileExt = screenshotFile.name.split('.').pop();
    const fileName = `${userId}/execution_${tradeNumber}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('trade-screenshots')
      .upload(fileName, screenshotFile, { upsert: true });

    setUploading(false);

    if (error) {
      console.error("Error uploading screenshot:", error);
      toast({
        title: "Erreur d'upload",
        description: "Impossible d'envoyer le screenshot.",
        variant: "destructive",
      });
      return null;
    }

    // Return the storage path, not a public URL
    // Signed URLs will be generated on-demand when displaying
    return data.path;
  };

  // Clear screenshot
  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setExistingScreenshot(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open dialog for new entry
  const handleNewEntry = () => {
    setFormData({
      ...initialFormData,
      trade_number: getNextTradeNumber().toString(),
    });
    setEditingId(null);
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setExistingScreenshot(null);
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
      notes: execution.notes || "",
    });
    setEditingId(execution.id);
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setExistingScreenshot(execution.screenshot_url);
    setIsDialogOpen(true);
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

    setSaving(true);

    // Upload screenshot if present
    const screenshotUrl = await uploadScreenshot(user.id, parseInt(formData.trade_number));

    const executionData = {
      user_id: user.id,
      trade_number: parseInt(formData.trade_number),
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
      notes: formData.notes || null,
      screenshot_url: screenshotUrl,
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
    <div className="h-full flex flex-col">
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
              <DialogContent className="max-w-[95vw] md:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? `Modifier Trade #${formData.trade_number}` : "Nouveau Trade"}
                  </DialogTitle>
                </DialogHeader>
                
                {/* Form Grid - responsive */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 py-4">
                  {/* Basic Info */}
                  <div className="space-y-2">
                    <Label htmlFor="trade_number" className="text-xs md:text-sm">N° Trade</Label>
                    <Input
                      id="trade_number"
                      type="number"
                      value={formData.trade_number}
                      onChange={(e) => setFormData({ ...formData, trade_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs md:text-sm">Date Entrée</Label>
                    <DatePicker
                      value={formData.trade_date}
                      onChange={(value) => setFormData({ ...formData, trade_date: value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs md:text-sm">Date Sortie</Label>
                    <DatePicker
                      value={formData.exit_date}
                      onChange={(value) => setFormData({ ...formData, exit_date: value })}
                    />
                    {!isSameDay && formData.exit_date && (
                      <p className="text-xs text-orange-400">Sortie J+{Math.ceil((new Date(formData.exit_date).getTime() - new Date(formData.trade_date).getTime()) / (1000 * 60 * 60 * 24))}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="direction" className="text-xs md:text-sm">Direction</Label>
                    <Select
                      value={formData.direction}
                      onValueChange={(v) => setFormData({ ...formData, direction: v as "Long" | "Short" })}
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

                  {/* Oracle Filter Fields - Customizable */}
                  <div className="space-y-2">
                    <Label htmlFor="setup_type" className="text-xs md:text-sm">Setup Type</Label>
                    <CustomizableSelect
                      value={formData.setup_type}
                      onChange={(v) => setFormData({ ...formData, setup_type: v })}
                      customOptions={variables.setup_type}
                      variableType="setup_type"
                      placeholder="Sélectionner..."
                      onOptionsChanged={refetchVariables}
                    />
                  </div>
                <div className="space-y-2">
                  <Label htmlFor="direction_structure">Structure</Label>
                  <CustomizableSelect
                    value={formData.direction_structure}
                    onChange={(v) => setFormData({ ...formData, direction_structure: v })}
                    customOptions={variables.direction_structure}
                    variableType="direction_structure"
                    placeholder="Sélectionner..."
                    onOptionsChanged={refetchVariables}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry_model">Entry Model</Label>
                  <CustomizableSelect
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
                  <Label htmlFor="entry_timing">Timing</Label>
                  <CustomizableSelect
                    value={formData.entry_timing}
                    onChange={(v) => setFormData({ ...formData, entry_timing: v })}
                    customOptions={variables.entry_timing}
                    variableType="entry_timing"
                    placeholder="Sélectionner..."
                    onOptionsChanged={refetchVariables}
                  />
                </div>

                {/* Time fields with validation hints */}
                <div className="space-y-2">
                  <Label>
                    Heure Entrée
                    <span className="text-xs text-muted-foreground ml-1">(min {MIN_ENTRY_TIME})</span>
                  </Label>
                  <TimePicker
                    value={formData.entry_time}
                    onChange={(value) => setFormData({ ...formData, entry_time: value })}
                    minTime={MIN_ENTRY_TIME}
                    maxTime={MAX_TIME}
                    error={formData.entry_time !== "" && !validateEntryTime(formData.entry_time)}
                  />
                  {formData.entry_time && !validateEntryTime(formData.entry_time) && (
                    <p className="text-xs text-red-400">Minimum {MIN_ENTRY_TIME}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>
                    Heure Sortie
                    <span className="text-xs text-muted-foreground ml-1">(max {MAX_TIME})</span>
                  </Label>
                  <TimePicker
                    value={formData.exit_time}
                    onChange={(value) => setFormData({ ...formData, exit_time: value })}
                    maxTime={MAX_TIME}
                    error={formData.exit_time !== "" && !validateExitTime(formData.exit_time)}
                  />
                  {formData.exit_time && !validateExitTime(formData.exit_time) && (
                    <p className="text-xs text-red-400">Maximum {MAX_TIME}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="result">Résultat</Label>
                  <Select
                    value={formData.result}
                    onValueChange={(v) => setFormData({ ...formData, result: v as "Win" | "Loss" | "BE" | "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Win">Win</SelectItem>
                      <SelectItem value="Loss">Loss</SelectItem>
                      <SelectItem value="BE">Break Even</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rr">RR</Label>
                  <Input
                    id="rr"
                    type="number"
                    step="0.1"
                    value={formData.rr}
                    onChange={(e) => setFormData({ ...formData, rr: e.target.value })}
                    placeholder="Ex: 2.5"
                  />
                </div>

                {/* Manual Price fields */}
                <div className="col-span-4">
                  <div className="border-t border-border pt-4 mt-2">
                    <p className="text-sm font-medium text-foreground mb-3">Données Manuelles</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="entry_price">Prix Entrée</Label>
                  <Input
                    id="entry_price"
                    type="number"
                    step="0.00001"
                    value={formData.entry_price}
                    onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                    placeholder="Ex: 1.08542"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exit_price">Prix Sortie</Label>
                  <Input
                    id="exit_price"
                    type="number"
                    step="0.00001"
                    value={formData.exit_price}
                    onChange={(e) => setFormData({ ...formData, exit_price: e.target.value })}
                    placeholder="Ex: 1.08650"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stop_loss">Stop Loss</Label>
                  <Input
                    id="stop_loss"
                    type="number"
                    step="0.00001"
                    value={formData.stop_loss}
                    onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value })}
                    placeholder="Ex: 1.08500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="take_profit">Take Profit</Label>
                  <Input
                    id="take_profit"
                    type="number"
                    step="0.00001"
                    value={formData.take_profit}
                    onChange={(e) => setFormData({ ...formData, take_profit: e.target.value })}
                    placeholder="Ex: 1.08700"
                  />
                </div>

                {/* Screenshot Upload */}
                <div className="col-span-4 space-y-2">
                  <Label>Screenshot</Label>
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {screenshotFile ? "Changer le screenshot" : "Ajouter un screenshot"}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        Max 5 MB - Pour vous souvenir du trade
                      </p>
                    </div>
                    {(screenshotPreview || existingScreenshot) && (
                      <div className="relative">
                        <img
                          src={screenshotPreview || existingScreenshot || ""}
                          alt="Screenshot preview"
                          className="w-24 h-24 object-cover rounded-md border border-border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={clearScreenshot}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observations, contexte du trade..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={saving || uploading}>
                  {(saving || uploading) ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {uploading ? "Upload..." : "Enregistrer"}
                </Button>
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
            {executions.map((execution) => {
              // Find comparison for this execution
              const comparison = tradeComparisons.find(
                c => c.userExecution.trade_number === execution.trade_number
              );
              
              // Only show comparison indicators after cycle completion
              const showStatus = shouldShowComparisonStatus(execution.trade_number, executions.length);
              
              const getBorderStyle = () => {
                if (!showStatus || !comparison) return "border-border";
                switch (comparison.status) {
                  case 'warning': return "border-orange-500/50";
                  case 'error': return "border-red-500/50";
                  case 'match': return "border-emerald-500/30";
                  default: return "border-border";
                }
              };

              const getStatusIcon = () => {
                if (!showStatus) return null;
                if (!comparison || comparison.status === 'no-match') return null;
                switch (comparison.status) {
                  case 'match': 
                    return <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" />;
                  case 'warning': 
                    return <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-500" />;
                  case 'error': 
                    return <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500" />;
                  default: 
                    return null;
                }
              };

              const isSelected = selectedExecution?.id === execution.id;

              return (
                <div
                  key={execution.id}
                  className={cn(
                    "border transition-all rounded-md overflow-hidden",
                    isSelected
                      ? "border-foreground/20 bg-accent/40"
                      : `${getBorderStyle()} hover:bg-accent/30 bg-transparent`
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
                        {getStatusIcon()}
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
                          <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Structure</span>
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

                      {/* Screenshot */}
                      {execution.screenshot_url && (
                        <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                          <span className="text-[9px] md:text-xs text-muted-foreground font-mono uppercase block mb-2">Screenshot</span>
                          <ScreenshotLink
                            storagePath={execution.screenshot_url}
                            alt={`Trade #${execution.trade_number}`}
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

                      {/* Comparison info if available */}
                      {showStatus && comparison && comparison.oracleTrade && (
                        <div className={cn(
                          "border p-2 md:p-3 rounded-md",
                          comparison.status === 'match' ? "border-emerald-500/30 bg-emerald-500/5" 
                            : comparison.status === 'warning' ? "border-orange-500/30 bg-orange-500/5"
                            : "border-red-500/30 bg-red-500/5"
                        )}>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] md:text-xs text-muted-foreground font-mono uppercase">
                              Comparaison Oracle
                            </span>
                            <span className={cn(
                              "text-[10px] md:text-xs font-mono",
                              comparison.status === 'match' ? "text-emerald-400" 
                                : comparison.status === 'warning' ? "text-orange-400"
                                : "text-red-400"
                            )}>
                              Écart: {comparison.timeDifferenceHours !== null 
                                ? comparison.timeDifferenceHours < 24 
                                  ? `${comparison.timeDifferenceHours.toFixed(1)}h`
                                  : `${(comparison.timeDifferenceHours / 24).toFixed(1)}j`
                                : "N/A"
                              }
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
