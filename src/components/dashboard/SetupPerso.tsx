import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileSpreadsheet, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Plus,
  Download,
  Target,
  Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { PersonalTradeDialog } from "./PersonalTradeDialog";
import { CustomVariablesDialog } from "./CustomVariablesDialog";

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
}

const DAYS_MAP: Record<number, string> = {
  0: "Dimanche",
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
};

const TARGET_TRADES = 300;

export const SetupPerso = () => {
  const [trades, setTrades] = useState<PersonalTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isVariablesDialogOpen, setIsVariablesDialogOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<PersonalTrade | null>(null);
  const [suggestedVariables, setSuggestedVariables] = useState<{ type: string; values: string[] }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch personal trades
  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("user_personal_trades")
      .select("*")
      .eq("user_id", user.id)
      .order("trade_number", { ascending: true });

    if (data) {
      setTrades(data as PersonalTrade[]);
    }
    setLoading(false);
  };

  // Get next trade number
  const getNextTradeNumber = () => {
    if (trades.length === 0) return 1;
    return Math.max(...trades.map(t => t.trade_number)) + 1;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner un fichier CSV.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("Le fichier CSV est vide ou ne contient pas de données.");
      }

      // Parse header
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Expected columns mapping
      const columnMap: Record<string, string> = {
        'trade_number': 'trade_number',
        'numero': 'trade_number',
        'n°': 'trade_number',
        'trade_date': 'trade_date',
        'date': 'trade_date',
        'direction': 'direction',
        'rr': 'rr',
        'entry_time': 'entry_time',
        'heure_entree': 'entry_time',
        'exit_time': 'exit_time',
        'heure_sortie': 'exit_time',
        'setup_type': 'setup_type',
        'setup': 'setup_type',
        'entry_model': 'entry_model',
        'model': 'entry_model',
        'direction_structure': 'direction_structure',
        'structure': 'direction_structure',
        'stop_loss_size': 'stop_loss_size',
        'sl': 'stop_loss_size',
        'entry_timing': 'entry_timing',
        'timing': 'entry_timing',
        'trade_duration': 'trade_duration',
        'duree': 'trade_duration',
      };

      // Map header indices
      const headerIndices: Record<string, number> = {};
      header.forEach((col, idx) => {
        const mappedCol = columnMap[col];
        if (mappedCol) {
          headerIndices[mappedCol] = idx;
        }
      });

      // Check required columns
      if (!('trade_number' in headerIndices) || !('trade_date' in headerIndices) || !('direction' in headerIndices)) {
        throw new Error("Colonnes requises manquantes: trade_number, trade_date, direction");
      }

      let successCount = 0;
      let errorCount = 0;
      const tradesToInsert: any[] = [];

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        try {
          const tradeNumber = parseInt(values[headerIndices['trade_number']]);
          const tradeDate = values[headerIndices['trade_date']];
          const direction = values[headerIndices['direction']];

          if (isNaN(tradeNumber) || !tradeDate || !direction) {
            errorCount++;
            continue;
          }

          const date = new Date(tradeDate);
          const dayOfWeek = DAYS_MAP[date.getDay()] || "Inconnu";

          const trade: any = {
            user_id: user.id,
            trade_number: tradeNumber,
            trade_date: tradeDate,
            day_of_week: dayOfWeek,
            direction: direction,
          };

          // Optional fields
          if (headerIndices['rr'] !== undefined) {
            const rr = parseFloat(values[headerIndices['rr']]);
            if (!isNaN(rr)) trade.rr = rr;
          }
          if (headerIndices['entry_time'] !== undefined) {
            trade.entry_time = values[headerIndices['entry_time']] || null;
          }
          if (headerIndices['exit_time'] !== undefined) {
            trade.exit_time = values[headerIndices['exit_time']] || null;
          }
          if (headerIndices['setup_type'] !== undefined) {
            trade.setup_type = values[headerIndices['setup_type']] || null;
          }
          if (headerIndices['entry_model'] !== undefined) {
            trade.entry_model = values[headerIndices['entry_model']] || null;
          }
          if (headerIndices['direction_structure'] !== undefined) {
            trade.direction_structure = values[headerIndices['direction_structure']] || null;
          }
          if (headerIndices['stop_loss_size'] !== undefined) {
            trade.stop_loss_size = values[headerIndices['stop_loss_size']] || null;
          }
          if (headerIndices['entry_timing'] !== undefined) {
            trade.entry_timing = values[headerIndices['entry_timing']] || null;
          }
          if (headerIndices['trade_duration'] !== undefined) {
            trade.trade_duration = values[headerIndices['trade_duration']] || null;
          }

          tradesToInsert.push(trade);
          successCount++;
        } catch (e) {
          errorCount++;
        }
      }

      // Upsert trades
      if (tradesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("user_personal_trades")
          .upsert(tradesToInsert, { onConflict: 'user_id,trade_number' });

        if (insertError) throw insertError;
      }

      // Extract unique values for variable suggestions
      const extractedVariables: { type: string; values: string[] }[] = [];
      
      const variableColumns = [
        { key: 'direction_structure', type: 'direction_structure' },
        { key: 'setup_type', type: 'setup_type' },
        { key: 'entry_model', type: 'entry_model' },
        { key: 'entry_timing', type: 'entry_timing' },
      ];

      variableColumns.forEach(({ key, type }) => {
        const uniqueValues = [...new Set(
          tradesToInsert
            .map(t => t[key])
            .filter((v): v is string => !!v && v.trim() !== '')
        )];
        
        if (uniqueValues.length > 0) {
          extractedVariables.push({ type, values: uniqueValues });
        }
      });

      // If we found variables, store them and prompt user
      if (extractedVariables.length > 0) {
        setSuggestedVariables(extractedVariables);
        // Auto-open variables dialog with suggestions
        setIsVariablesDialogOpen(true);
        toast({
          title: "Variables détectées",
          description: `${extractedVariables.reduce((sum, v) => sum + v.values.length, 0)} valeurs uniques détectées. Cliquez pour les ajouter à vos variables.`,
        });
      }

      setImportResult({ success: successCount, errors: errorCount });
      await fetchTrades();

      toast({
        title: "Import terminé",
        description: `${successCount} trades importés, ${errorCount} erreurs.`,
      });
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Erreur d'import",
        description: error.message || "Une erreur est survenue lors de l'import.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleVariablesSuggestionsProcessed = () => {
    setSuggestedVariables([]);
  };

  const handleDeleteAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_personal_trades")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les trades.",
        variant: "destructive",
      });
    } else {
      setTrades([]);
      toast({
        title: "Trades supprimés",
        description: "Tous vos trades personnels ont été supprimés.",
      });
    }
  };

  const handleExportCSV = () => {
    if (trades.length === 0) return;

    const headers = ['trade_number', 'trade_date', 'day_of_week', 'direction', 'direction_structure', 'entry_time', 'exit_time', 'setup_type', 'entry_model', 'rr'];
    const csvContent = [
      headers.join(','),
      ...trades.map(t => [
        t.trade_number,
        t.trade_date,
        t.day_of_week,
        t.direction,
        t.direction_structure || '',
        t.entry_time || '',
        t.exit_time || '',
        t.setup_type || '',
        t.entry_model || '',
        t.rr ?? ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `setup_perso_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleNewTrade = () => {
    setEditingTrade(null);
    setIsDialogOpen(true);
  };

  const handleEditTrade = (trade: PersonalTrade) => {
    setEditingTrade(trade);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingTrade(null);
  };

  const handleTradeSaved = () => {
    fetchTrades();
    handleDialogClose();
  };

  const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);
  const avgRR = trades.length > 0 ? totalRR / trades.length : 0;
  const progressPercent = Math.min((trades.length / TARGET_TRADES) * 100, 100);

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
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1">Setup Perso</h2>
            <p className="text-xs md:text-sm text-muted-foreground font-mono">
              Gérez vos trades personnels
            </p>
          </div>
          
          {/* Actions - scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {/* Variables Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsVariablesDialogOpen(true)}
              className="gap-1.5 flex-shrink-0"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Variables</span>
            </Button>
            
            {/* New Trade Button */}
            <Button size="sm" onClick={handleNewTrade} className="gap-1.5 flex-shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouveau</span>
            </Button>
            
            {/* CSV Import/Export */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="gap-1.5 flex-shrink-0"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Import</span>
            </Button>
            
            {trades.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-1.5 flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            )}
            
            {trades.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Supprimer</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] md:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer tous les trades ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Tous vos trades personnels seront supprimés définitivement.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAll}>
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Progress Bar 0/300 */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Objectif: {TARGET_TRADES} trades</span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {trades.length}/{TARGET_TRADES}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {trades.length >= TARGET_TRADES 
              ? "🎉 Objectif atteint ! Vous avez assez de données pour une analyse significative."
              : `${TARGET_TRADES - trades.length} trades restants pour obtenir un feedback statistiquement pertinent.`
            }
          </p>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="px-6 py-3 bg-muted/50 border-b border-border flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-foreground">{importResult.success} trades importés</span>
          </div>
          {importResult.errors > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-500">{importResult.errors} erreurs</span>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {trades.length > 0 && (
        <div className="px-4 md:px-6 py-4 border-b border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="border border-emerald-500/30 p-3 md:p-4 bg-emerald-500/10 rounded-md">
              <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-1">Total Trades</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">{trades.length}</p>
            </div>
            <div className="border border-border p-3 md:p-4 rounded-md">
              <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-1">RR Total</p>
              <p className={cn(
                "text-xl md:text-2xl font-bold",
                totalRR >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {totalRR >= 0 ? "+" : ""}{totalRR.toFixed(2)}
              </p>
            </div>
            <div className="border border-border p-3 md:p-4 rounded-md">
              <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-1">RR Moyen</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">{avgRR.toFixed(2)}</p>
            </div>
            <div className="border border-border p-3 md:p-4 rounded-md">
              <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-1">Valeur (100K)</p>
              <p className={cn(
                "text-xl md:text-2xl font-bold",
                totalRR >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {totalRR >= 0 ? "+" : ""}{(totalRR * 1000).toLocaleString("fr-FR")} €
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {trades.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 md:p-8">
            <FileSpreadsheet className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-base md:text-lg font-semibold text-foreground mb-2">Aucun trade personnel</h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-6 max-w-md px-4">
              Ajoutez vos trades manuellement ou importez-les via un fichier CSV.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button onClick={handleNewTrade} className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Ajouter un trade
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2 w-full sm:w-auto">
                <Upload className="w-4 h-4" />
                Importer CSV
              </Button>
            </div>
            <div className="mt-6 md:mt-8 text-left text-[10px] md:text-xs text-muted-foreground/60 bg-muted/30 p-3 md:p-4 rounded-md max-w-lg mx-4">
              <p className="font-medium mb-2">Colonnes CSV supportées:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><code>trade_number</code> (requis)</li>
                <li><code>trade_date</code> (requis)</li>
                <li><code>direction</code> (requis)</li>
                <li><code>rr</code>, <code>entry_time</code>, <code>exit_time</code></li>
              </ul>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Jour</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Structure</TableHead>
                <TableHead>Entrée</TableHead>
                <TableHead>Setup</TableHead>
                <TableHead className="text-right">RR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow 
                  key={trade.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleEditTrade(trade)}
                >
                  <TableCell className="font-mono text-muted-foreground">
                    {trade.trade_number}
                  </TableCell>
                  <TableCell>{trade.trade_date}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {trade.day_of_week}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "text-xs font-mono uppercase px-2 py-0.5 rounded",
                      trade.direction === "Long"
                        ? "text-emerald-500 bg-emerald-500/10"
                        : "text-red-500 bg-red-500/10"
                    )}>
                      {trade.direction}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {trade.direction_structure || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {trade.entry_time || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {trade.setup_type || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "font-mono font-bold",
                      (trade.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {trade.rr !== null ? `${trade.rr >= 0 ? '+' : ''}${trade.rr.toFixed(2)}` : "—"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Trade Dialog */}
      <PersonalTradeDialog
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        onSaved={handleTradeSaved}
        editingTrade={editingTrade}
        nextTradeNumber={getNextTradeNumber()}
      />

      {/* Custom Variables Dialog */}
      <CustomVariablesDialog
        isOpen={isVariablesDialogOpen}
        onClose={() => setIsVariablesDialogOpen(false)}
        suggestedVariables={suggestedVariables}
        onSuggestionsProcessed={handleVariablesSuggestionsProcessed}
      />
    </div>
  );
};
