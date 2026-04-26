import { useState, useEffect, useRef, useMemo } from "react";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Settings2,
  SlidersHorizontal,
  X,
  ChevronDown,
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

const DEFAULT_TARGET_TRADES = 300;

// ── Filter types (module-level) ──
type FilterFieldKey = "direction" | "direction_structure" | "setup_type" | "entry_timing" | "day_of_week";
const FILTER_FIELDS: { key: FilterFieldKey; label: string }[] = [
  { key: "direction", label: "Direction" },
  { key: "direction_structure", label: "Structure" },
  { key: "setup_type", label: "Type de Setup" },
  { key: "entry_timing", label: "Entry Timing" },
  { key: "day_of_week", label: "Jour" },
];

interface SetupPersoProps {
  customSetupId?: string;
  customSetupName?: string;
  sessionId?: string; // Récolte de données : si défini, filtre les trades sur cette session
}

export const SetupPerso = ({ customSetupId, customSetupName, sessionId }: SetupPersoProps = {}) => {
  const [trades, setTrades] = useState<PersonalTrade[]>([]);
  const [allTradesCount, setAllTradesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isVariablesDialogOpen, setIsVariablesDialogOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<PersonalTrade | null>(null);
  const [suggestedVariables, setSuggestedVariables] = useState<{ type: string; values: string[] }[]>([]);
  const [targetTrades, setTargetTrades] = useState(DEFAULT_TARGET_TRADES);
  const [showTargetInput, setShowTargetInput] = useState(false);
  const [assets, setAssets] = useState<string[]>([]);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [newAsset, setNewAsset] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Filters ──
  const [activeFilterFields, setActiveFilterFields] = useState<FilterFieldKey[]>([]);
  const [filterValues, setFilterValues] = useState<Partial<Record<FilterFieldKey, string>>>({});
  const [showFilterChooser, setShowFilterChooser] = useState(false);
  const filterChooserRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isEarlyAccess } = useEarlyAccess();

  // Fetch personal trades
  useEffect(() => {
    fetchTrades();
  }, [sessionId]);

  const fetchTrades = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("user_personal_trades")
      .select("*")
      .eq("user_id", user.id)
      .order("trade_number", { ascending: true });

    if (sessionId) {
      // Mode "Récolte de données" : filtre uniquement les trades de cette session
      query = query.eq("session_id", sessionId);
    } else if (customSetupId) {
      query = query.eq("custom_setup_id", customSetupId);
    } else {
      query = query.is("custom_setup_id", null);
    }

    const { data, error } = await query;

    if (data) {
      setTrades(data as PersonalTrade[]);
    }
    setLoading(false);

    // Also fetch total count (all setups) for EA limit
    if (isEarlyAccess) {
      const { count } = await supabase
        .from("user_personal_trades")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setAllTradesCount(count || 0);
    }
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
        'entry_timeframe': 'entry_timeframe',
        'context_timeframe': 'context_timeframe',
        'result': 'result',
        'resultat': 'result',
        'comment': 'comment',
        'commentaire': 'comment',
        'news_day': 'news_day',
        'news_label': 'news_label',
        'sl_placement': 'sl_placement',
        'tp_placement': 'tp_placement',
        'entry_price': 'entry_price',
        'exit_price': 'exit_price',
        'stop_loss': 'stop_loss',
        'take_profit': 'take_profit',
        'chart_link': 'chart_link',
        'asset': 'asset',
        'actif': 'asset',
      };

      // Map header indices & track unmapped columns
      const headerIndices: Record<string, number> = {};
      const unmappedColumns: { name: string; index: number }[] = [];
      
      header.forEach((col, idx) => {
        const mappedCol = columnMap[col];
        if (mappedCol) {
          headerIndices[mappedCol] = idx;
        } else if (col) {
          unmappedColumns.push({ name: col, index: idx });
        }
      });

      // Track missing important columns (info only, never blocks)
      const missingWarnings: string[] = [];
      if (!('trade_number' in headerIndices)) missingWarnings.push('trade_number (auto-incrémenté)');
      if (!('trade_date' in headerIndices)) missingWarnings.push('trade_date (date du jour par défaut)');
      if (!('direction' in headerIndices)) missingWarnings.push('direction (défaut: Long)');

      // Get current max trade number for auto-increment
      let autoTradeNumber = getNextTradeNumber();

      let successCount = 0;
      let errorCount = 0;
      const tradesToInsert: any[] = [];

      // Collect unmapped column values for auto-creating custom variables
      const unmappedColumnValues: Record<string, Set<string>> = {};
      unmappedColumns.forEach(col => {
        unmappedColumnValues[col.name] = new Set();
      });

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        try {
          // Trade number: use from CSV or auto-increment
          let tradeNumber: number;
          if ('trade_number' in headerIndices) {
            const parsed = parseInt(values[headerIndices['trade_number']]);
            tradeNumber = isNaN(parsed) ? autoTradeNumber++ : parsed;
          } else {
            tradeNumber = autoTradeNumber++;
          }

          // Trade date: use from CSV or default to today
          let tradeDate: string;
          if ('trade_date' in headerIndices && values[headerIndices['trade_date']]) {
            tradeDate = values[headerIndices['trade_date']];
          } else {
            tradeDate = new Date().toISOString().split('T')[0];
          }

          // Direction: use from CSV or default
          let direction: string;
          if ('direction' in headerIndices && values[headerIndices['direction']]) {
            direction = values[headerIndices['direction']];
          } else {
            direction = 'Long';
          }

          const date = new Date(tradeDate);
          const dayOfWeek = DAYS_MAP[date.getDay()] || "Inconnu";

          const trade: any = {
            user_id: user.id,
            trade_number: tradeNumber,
            trade_date: tradeDate,
            day_of_week: dayOfWeek,
            direction: direction,
            custom_setup_id: customSetupId || null,
            session_id: sessionId || null,
          };

          // All optional known fields
          const optionalStringFields = [
            'entry_time', 'exit_time', 'setup_type', 'entry_model',
            'direction_structure', 'stop_loss_size', 'entry_timing',
            'trade_duration', 'entry_timeframe', 'context_timeframe',
            'result', 'comment', 'news_label', 'sl_placement',
            'tp_placement', 'chart_link', 'asset',
          ];
          optionalStringFields.forEach(field => {
            if (headerIndices[field] !== undefined) {
              trade[field] = values[headerIndices[field]] || null;
            }
          });

          // Numeric fields
          ['rr', 'entry_price', 'exit_price', 'stop_loss', 'take_profit'].forEach(field => {
            if (headerIndices[field] !== undefined) {
              const num = parseFloat(values[headerIndices[field]]);
              if (!isNaN(num)) trade[field] = num;
            }
          });

          // Boolean fields
          if (headerIndices['news_day'] !== undefined) {
            const v = values[headerIndices['news_day']]?.toLowerCase();
            trade.news_day = v === 'true' || v === 'oui' || v === '1';
          }

          // Collect unmapped column values per row
          unmappedColumns.forEach(col => {
            const val = values[col.index];
            if (val && val.trim()) {
              unmappedColumnValues[col.name].add(val.trim());
            }
          });

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

      // ── Auto-create custom variables ──
      // 1) Auto-create values for known variable columns
      const variableColumns = [
        { key: 'direction_structure', type: 'direction_structure' },
        { key: 'setup_type', type: 'setup_type' },
        { key: 'entry_model', type: 'entry_model' },
        { key: 'entry_timing', type: 'entry_timing' },
        { key: 'entry_timeframe', type: 'entry_timeframe' },
      ];

      // Fetch existing custom variables to avoid duplicates
      const { data: existingVars } = await supabase
        .from("user_custom_variables")
        .select("variable_type, variable_value")
        .eq("user_id", user.id);

      const existingSet = new Set(
        (existingVars || []).map(v => `${v.variable_type}::${v.variable_value}`)
      );

      const variablesToCreate: { user_id: string; variable_type: string; variable_value: string }[] = [];

      variableColumns.forEach(({ key, type }) => {
        const uniqueValues = [...new Set(
          tradesToInsert
            .map(t => t[key])
            .filter((v): v is string => !!v && v.trim() !== '')
        )];
        
        uniqueValues.forEach(val => {
          if (!existingSet.has(`${type}::${val}`)) {
            variablesToCreate.push({ user_id: user.id, variable_type: type, variable_value: val });
            existingSet.add(`${type}::${val}`);
          }
        });
      });

      // 2) Auto-create custom variable types + values for unmapped columns
      const { data: existingTypes } = await supabase
        .from("user_variable_types")
        .select("type_key")
        .eq("user_id", user.id);

      const existingTypeKeys = new Set((existingTypes || []).map(t => t.type_key));
      const newTypesToCreate: { user_id: string; type_key: string; type_label: string }[] = [];

      for (const col of unmappedColumns) {
        const values = unmappedColumnValues[col.name];
        if (values.size === 0) continue;

        const typeKey = col.name.replace(/\s+/g, '_').toLowerCase();
        
        // Create the type if it doesn't exist
        if (!existingTypeKeys.has(typeKey)) {
          newTypesToCreate.push({ user_id: user.id, type_key: typeKey, type_label: col.name });
          existingTypeKeys.add(typeKey);
        }

        // Create the values
        values.forEach(val => {
          if (!existingSet.has(`${typeKey}::${val}`)) {
            variablesToCreate.push({ user_id: user.id, variable_type: typeKey, variable_value: val });
            existingSet.add(`${typeKey}::${val}`);
          }
        });
      }

      // Insert new custom variable types
      if (newTypesToCreate.length > 0) {
        await supabase.from("user_variable_types").insert(newTypesToCreate);
      }

      // Insert new custom variable values
      if (variablesToCreate.length > 0) {
        await supabase.from("user_custom_variables").insert(variablesToCreate);
      }

      setImportResult({ success: successCount, errors: errorCount });
      await fetchTrades();

      // Build final toast message
      const infoParts: string[] = [`${successCount} trades importés`];
      if (errorCount > 0) infoParts.push(`${errorCount} lignes ignorées`);
      if (variablesToCreate.length > 0) infoParts.push(`${variablesToCreate.length} variables créées`);
      if (newTypesToCreate.length > 0) infoParts.push(`${newTypesToCreate.length} catégories créées`);
      
      let description = infoParts.join(', ') + '.';
      if (missingWarnings.length > 0) {
        description += ` Colonnes absentes : ${missingWarnings.join(', ')}.`;
      }
      if (unmappedColumns.length > 0) {
        const unmappedWithValues = unmappedColumns.filter(c => unmappedColumnValues[c.name].size > 0);
        if (unmappedWithValues.length > 0) {
          description += ` Colonnes non-standard ajoutées comme variables : ${unmappedWithValues.map(c => c.name).join(', ')}.`;
        }
      }

      toast({
        title: "Import terminé",
        description,
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
    if (isEarlyAccess && allTradesCount >= 25) {
      toast({
        title: "Limite atteinte",
        description: "Vous avez atteint la limite de 25 data en accès anticipé.",
        variant: "destructive",
      });
      return;
    }
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
  const progressPercent = targetTrades > 0 ? Math.min((trades.length / targetTrades) * 100, 100) : 0;

  // ── Filtered trades for display ──
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      for (const field of activeFilterFields) {
        const val = filterValues[field];
        if (val && val !== "__all__") {
          const tradeVal = (trade[field as keyof PersonalTrade] as string) || "";
          if (tradeVal !== val) return false;
        }
      }
      return true;
    });
  }, [trades, activeFilterFields, filterValues]);

  // ── Unique values per field (for dropdown options) ──
  const fieldOptions = useMemo(() => {
    const opts: Partial<Record<FilterFieldKey, string[]>> = {};
    const allFields: FilterFieldKey[] = ["direction", "direction_structure", "setup_type", "entry_timing", "day_of_week"];
    for (const field of allFields) {
      const vals = Array.from(new Set(
        trades.map(t => (t[field as keyof PersonalTrade] as string) || "").filter(Boolean)
      )).sort();
      opts[field] = vals;
    }
    return opts;
  }, [trades]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="p-3 md:p-6 border-b border-border">
        <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between mb-3 md:mb-4">
          {/* Title block — hidden in session mode (parent already shows session name) */}
          {!sessionId ? (
            <div>
              <h2 className="text-base md:text-xl font-semibold text-foreground mb-0.5 md:mb-1">
                {customSetupName || "Setup Perso"}
              </h2>
              <p className="text-[10px] md:text-sm text-muted-foreground font-mono">
                {customSetupName ? `Setup personnalisé · ${customSetupName}` : "Gérez vos trades personnels"}
              </p>
            </div>
          ) : (
            <div />
          )}
          
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

            {/* Asset Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAssetDialog(true)}
              className="gap-1.5 flex-shrink-0"
            >
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Actifs</span>
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

        {/* Progress Bar 0/300 — hidden in session mode */}
        {!sessionId && <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              {showTargetInput ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Objectif:</span>
                  <Input
                    type="number"
                    value={targetTrades}
                    onChange={(e) => setTargetTrades(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 h-7 text-sm"
                    min={0}
                  />
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowTargetInput(false)}>OK</Button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowTargetInput(true)}
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Objectif: {targetTrades > 0 ? `${targetTrades} trades` : "Aucun"}
                </button>
              )}
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {trades.length}{targetTrades > 0 ? `/${targetTrades}` : " trades"}
            </span>
          </div>
          {targetTrades > 0 && <Progress value={progressPercent} className="h-2" />}
          <p className="text-xs text-muted-foreground mt-2">
            {targetTrades > 0 && trades.length >= targetTrades
              ? "🎉 Objectif atteint ! Continuez à récolter de la data."
              : targetTrades > 0
                ? `${targetTrades - trades.length} trades restants pour atteindre votre objectif.`
                : "Aucun objectif défini. Récoltez autant de data que nécessaire."
            }
          </p>
        </div>}
      </div>

      {/* Import result */}
      {importResult && (
        <div className="px-3 md:px-6 py-3 bg-muted/50 border-b border-border flex flex-wrap items-center gap-3 md:gap-4">
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

      {/* ── Filter bar ── */}
      {trades.length > 0 && (
        <div className="px-4 md:px-6 py-2.5 border-b border-border flex flex-wrap items-center gap-2">
          {/* Active filter chips */}
          {activeFilterFields.map(field => {
            const label = FILTER_FIELDS.find(f => f.key === field)?.label ?? field;
            const opts = fieldOptions[field] ?? [];
            const currentVal = filterValues[field] ?? "__all__";
            return (
              <div key={field} className="flex items-center gap-1 bg-muted rounded-md pl-2 pr-1 h-7">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                <select
                  value={currentVal}
                  onChange={e => setFilterValues(prev => ({ ...prev, [field]: e.target.value }))}
                  className="bg-transparent text-[11px] text-foreground border-none outline-none h-7 pr-1 cursor-pointer"
                >
                  <option value="__all__">Tous</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button
                  onClick={() => {
                    setActiveFilterFields(prev => prev.filter(f => f !== field));
                    setFilterValues(prev => { const n = { ...prev }; delete n[field]; return n; });
                  }}
                  className="text-muted-foreground hover:text-foreground ml-0.5 flex items-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Add filter field chooser */}
          <div className="relative" ref={filterChooserRef}>
            <button
              onClick={() => setShowFilterChooser(v => !v)}
              className={cn(
                "flex items-center gap-1.5 h-7 px-2 rounded-md text-[11px] transition-colors",
                activeFilterFields.length > 0
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted border border-dashed border-border"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {activeFilterFields.length === 0 && <span>Filtrer</span>}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFilterChooser && (
              <div className="absolute left-0 top-9 z-50 bg-card border border-border rounded-lg shadow-lg p-2 min-w-[160px]">
                {FILTER_FIELDS.map(f => {
                  const isActive = activeFilterFields.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      onClick={() => {
                        if (isActive) {
                          setActiveFilterFields(prev => prev.filter(k => k !== f.key));
                          setFilterValues(prev => { const n = { ...prev }; delete n[f.key]; return n; });
                        } else {
                          setActiveFilterFields(prev => [...prev, f.key]);
                        }
                        setShowFilterChooser(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 rounded text-xs transition-colors",
                        isActive
                          ? "text-foreground bg-muted font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {isActive ? "✓ " : ""}{f.label}
                    </button>
                  );
                })}
                {activeFilterFields.length > 0 && (
                  <>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        setActiveFilterFields([]);
                        setFilterValues({});
                        setShowFilterChooser(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded text-xs text-red-400 hover:bg-muted"
                    >
                      Effacer tout
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Count when filtered */}
          {activeFilterFields.some(f => filterValues[f] && filterValues[f] !== "__all__") && (
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">
              {filteredTrades.length} / {trades.length} trades
            </span>
          )}
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
                <TableHead>Type de Setup</TableHead>
                <TableHead className="text-right">RR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrades.map((trade) => (
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
        customSetupId={customSetupId}
        sessionId={sessionId}
      />

      {/* Custom Variables Dialog */}
      <CustomVariablesDialog
        isOpen={isVariablesDialogOpen}
        onClose={() => setIsVariablesDialogOpen(false)}
        suggestedVariables={suggestedVariables}
        onSuggestionsProcessed={handleVariablesSuggestionsProcessed}
      />

      {/* Asset Management Dialog */}
      {showAssetDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setShowAssetDialog(false)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground">Gestion des Actifs</h3>
            <p className="text-xs text-muted-foreground">Ajoutez les actifs (EUR/USD, NAS100, etc.) pour associer vos trades.</p>
            
            <div className="flex gap-2">
              <Input
                placeholder="Nouvel actif (ex: NAS100)"
                value={newAsset}
                onChange={(e) => setNewAsset(e.target.value)}
                className="flex-1 h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newAsset.trim()) {
                    setAssets(prev => [...prev, newAsset.trim()]);
                    setNewAsset("");
                  }
                }}
              />
              <Button
                size="sm"
                className="h-9"
                disabled={!newAsset.trim()}
                onClick={() => {
                  setAssets(prev => [...prev, newAsset.trim()]);
                  setNewAsset("");
                }}
              >
                Ajouter
              </Button>
            </div>

            {assets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {assets.map((asset, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted text-sm text-foreground rounded-md"
                  >
                    {asset}
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setAssets(prev => prev.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAssetDialog(false)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
