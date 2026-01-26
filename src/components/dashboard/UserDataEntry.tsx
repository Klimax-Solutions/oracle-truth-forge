import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Target,
  Calendar,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface UserExecution {
  id: string;
  trade_number: number;
  trade_date: string;
  direction: "Long" | "Short";
  entry_time: string | null;
  exit_time: string | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rr: number | null;
  result: "Win" | "Loss" | "BE" | null;
  setup_type: string | null;
  notes: string | null;
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
  notes: string;
}

interface UserDataEntryProps {
  tradeComparisons?: TradeComparison[];
  oracleTrades?: OracleTrade[];
}

const initialFormData: FormData = {
  trade_number: "",
  trade_date: new Date().toISOString().split("T")[0],
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
  notes: "",
};

export const UserDataEntry = ({ tradeComparisons = [], oracleTrades = [] }: UserDataEntryProps) => {
  const [executions, setExecutions] = useState<UserExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const { toast } = useToast();

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

  // Open dialog for new entry
  const handleNewEntry = () => {
    setFormData({
      ...initialFormData,
      trade_number: getNextTradeNumber().toString(),
    });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (execution: UserExecution) => {
    setFormData({
      trade_number: execution.trade_number.toString(),
      trade_date: execution.trade_date,
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
      notes: execution.notes || "",
    });
    setEditingId(execution.id);
    setIsDialogOpen(true);
  };

  // Save execution
  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);

    const executionData = {
      user_id: user.id,
      trade_number: parseInt(formData.trade_number),
      trade_date: formData.trade_date,
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
      notes: formData.notes || null,
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
      "Date",
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
      "Notes",
    ];

    const csvRows = [
      headers.join(","),
      ...executions.map((e) =>
        [
          e.trade_number,
          e.trade_date,
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Saisie des Exécutions
          </h2>
          <p className="text-sm text-muted-foreground font-mono">
            Entrez vos trades pour validation et analyse
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewEntry}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Trade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? `Modifier Trade #${formData.trade_number}` : "Nouveau Trade"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="trade_number">N° Trade</Label>
                  <Input
                    id="trade_number"
                    type="number"
                    value={formData.trade_number}
                    onChange={(e) => setFormData({ ...formData, trade_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trade_date">Date</Label>
                  <Input
                    id="trade_date"
                    type="date"
                    value={formData.trade_date}
                    onChange={(e) => setFormData({ ...formData, trade_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direction">Direction</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="entry_time">Heure Entrée</Label>
                  <Input
                    id="entry_time"
                    type="time"
                    value={formData.entry_time}
                    onChange={(e) => setFormData({ ...formData, entry_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exit_time">Heure Sortie</Label>
                  <Input
                    id="exit_time"
                    type="time"
                    value={formData.exit_time}
                    onChange={(e) => setFormData({ ...formData, exit_time: e.target.value })}
                  />
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
                  <Label htmlFor="entry_price">Prix Entrée</Label>
                  <Input
                    id="entry_price"
                    type="number"
                    step="0.00001"
                    value={formData.entry_price}
                    onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rr">RR</Label>
                  <Input
                    id="rr"
                    type="number"
                    step="0.1"
                    value={formData.rr}
                    onChange={(e) => setFormData({ ...formData, rr: e.target.value })}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup_type">Type de Setup</Label>
                  <Input
                    id="setup_type"
                    value={formData.setup_type}
                    onChange={(e) => setFormData({ ...formData, setup_type: e.target.value })}
                    placeholder="ex: Oracle Standard"
                  />
                </div>

                <div className="col-span-3 space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observations, contexte du trade..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="p-6 border-b border-border">
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-border/40 p-4 bg-transparent rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Trades Saisis
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>

          <div className="border border-border/40 p-4 bg-transparent rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Win Rate
              </span>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              winRate >= 50 ? "text-emerald-400" : "text-red-400"
            )}>
              {winRate.toFixed(1)}%
            </p>
          </div>

          <div className="border border-border/40 p-4 bg-transparent rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Total RR
              </span>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              stats.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {stats.totalRR >= 0 ? "+" : ""}{stats.totalRR.toFixed(1)}
            </p>
          </div>

          <div className="border border-border/40 p-4 bg-transparent rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                W / L
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              <span className="text-emerald-400">{stats.wins}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-red-400">{stats.losses}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 p-6 overflow-auto">
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
          <div className="border border-border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Entrée</TableHead>
                  <TableHead>Sortie</TableHead>
                  <TableHead>RR</TableHead>
                  <TableHead>Résultat</TableHead>
                  <TableHead>Setup</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => {
                  // Find comparison for this execution
                  const comparison = tradeComparisons.find(
                    c => c.userExecution.trade_number === execution.trade_number
                  );
                  
                  const getRowStyle = () => {
                    if (!comparison) return "";
                    switch (comparison.status) {
                      case 'warning': return "bg-orange-500/10 border-l-2 border-l-orange-500";
                      case 'error': return "bg-red-500/10 border-l-2 border-l-red-500";
                      case 'match': return "";
                      default: return "";
                    }
                  };

                  const getStatusIcon = () => {
                    if (!comparison || comparison.status === 'no-match') return null;
                    switch (comparison.status) {
                      case 'match': 
                        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
                      case 'warning': 
                        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
                      case 'error': 
                        return <AlertCircle className="w-4 h-4 text-red-500" />;
                      default: 
                        return null;
                    }
                  };

                  const getStatusTooltip = () => {
                    if (!comparison) return "";
                    if (comparison.status === 'no-match') return "Pas de trade Oracle correspondant";
                    if (comparison.timeDifferenceHours === null) return "";
                    const hours = comparison.timeDifferenceHours;
                    if (hours <= 5) return `✓ Écart: ${hours.toFixed(1)}h - Conforme`;
                    if (hours <= 24) return `⚠ Écart: ${hours.toFixed(1)}h (>5h) - À vérifier`;
                    return `✗ Écart: ${(hours / 24).toFixed(1)}j (>1 jour) - Problème`;
                  };

                  return (
                    <TableRow 
                      key={execution.id} 
                      className={cn("hover:bg-muted/30", getRowStyle())}
                    >
                      <TableCell className="font-mono font-medium">
                        <div className="flex items-center gap-2">
                          {execution.trade_number}
                          {getStatusIcon() && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">
                                  {getStatusIcon()}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{getStatusTooltip()}</p>
                                {comparison?.oracleTrade && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Oracle: {comparison.oracleTrade.trade_date} à {comparison.oracleTrade.entry_time || "N/A"}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {new Date(execution.trade_date).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          execution.direction === "Long"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        )}>
                          {execution.direction}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {execution.entry_time || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {execution.exit_time || "-"}
                      </TableCell>
                      <TableCell className={cn(
                        "font-mono font-medium",
                        (execution.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {execution.rr !== null ? (
                          `${execution.rr >= 0 ? "+" : ""}${execution.rr.toFixed(1)}`
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {execution.result && (
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-medium",
                            execution.result === "Win"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : execution.result === "Loss"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {execution.result}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {execution.setup_type || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(execution)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-300"
                            onClick={() => handleDelete(execution.id, execution.trade_number)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};
