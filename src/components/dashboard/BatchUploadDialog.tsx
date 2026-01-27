import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Download,
  FolderOpen,
  FileArchive,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BatchUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface TradeData {
  trade_number: number;
  trade_date: string;
  direction: "Long" | "Short";
  entry_time?: string;
  exit_time?: string;
  exit_date?: string;
  entry_price?: number;
  exit_price?: number;
  stop_loss?: number;
  take_profit?: number;
  rr?: number;
  result?: "Win" | "Loss" | "BE";
  setup_type?: string;
  entry_model?: string;
  direction_structure?: string;
  entry_timing?: string;
  notes?: string;
  screenshot_file?: File;
}

interface UploadProgress {
  current: number;
  total: number;
  percent: number;
  status: "idle" | "parsing" | "uploading" | "complete" | "error";
  currentItem?: string;
  errors: string[];
  successes: number;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const BATCH_SIZE = 10; // Process 10 trades at a time

export const BatchUploadDialog = ({
  open,
  onOpenChange,
  onComplete,
}: BatchUploadDialogProps) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [parsedTrades, setParsedTrades] = useState<TradeData[]>([]);
  const [progress, setProgress] = useState<UploadProgress>({
    current: 0,
    total: 0,
    percent: 0,
    status: "idle",
    errors: [],
    successes: 0,
  });
  const [uploadMode, setUploadMode] = useState<"csv" | "manual">("csv");

  const csvInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Calculate total file size
  const getTotalFileSize = useCallback(() => {
    let total = csvFile?.size || 0;
    screenshotFiles.forEach((f) => (total += f.size));
    return total;
  }, [csvFile, screenshotFiles]);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Handle CSV file selection
  const handleCsvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Fichier trop volumineux",
        description: `La taille maximale est de 20 MB. Votre fichier: ${formatFileSize(file.size)}`,
        variant: "destructive",
      });
      return;
    }

    setCsvFile(file);
    await parseCSV(file);
  };

  // Parse CSV file
  const parseCSV = async (file: File) => {
    setProgress((p) => ({ ...p, status: "parsing", currentItem: file.name }));

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        throw new Error("Le fichier CSV doit contenir au moins une ligne de données.");
      }

      // Parse header
      const headers = lines[0].split(";").map((h) => h.trim().toLowerCase());

      // Required columns
      const requiredCols = ["trade_number", "trade_date", "direction"];
      const missingCols = requiredCols.filter(
        (col) => !headers.includes(col)
      );

      if (missingCols.length > 0) {
        throw new Error(
          `Colonnes manquantes: ${missingCols.join(", ")}. Utilisez le template CSV.`
        );
      }

      // Parse data rows
      const trades: TradeData[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(";").map((v) => v.trim());
        if (values.length < headers.length) continue;

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || "";
        });

        // Validate required fields
        if (!row.trade_number || !row.trade_date || !row.direction) {
          errors.push(`Ligne ${i + 1}: Données manquantes`);
          continue;
        }

        const tradeNum = parseInt(row.trade_number);
        if (isNaN(tradeNum)) {
          errors.push(`Ligne ${i + 1}: trade_number invalide`);
          continue;
        }

        const direction = row.direction.toLowerCase();
        if (direction !== "long" && direction !== "short") {
          errors.push(`Ligne ${i + 1}: direction doit être Long ou Short`);
          continue;
        }

        trades.push({
          trade_number: tradeNum,
          trade_date: row.trade_date,
          direction: direction === "long" ? "Long" : "Short",
          entry_time: row.entry_time || undefined,
          exit_time: row.exit_time || undefined,
          exit_date: row.exit_date || undefined,
          entry_price: row.entry_price ? parseFloat(row.entry_price) : undefined,
          exit_price: row.exit_price ? parseFloat(row.exit_price) : undefined,
          stop_loss: row.stop_loss ? parseFloat(row.stop_loss) : undefined,
          take_profit: row.take_profit ? parseFloat(row.take_profit) : undefined,
          rr: row.rr ? parseFloat(row.rr) : undefined,
          result: row.result as "Win" | "Loss" | "BE" | undefined,
          setup_type: row.setup_type || undefined,
          entry_model: row.entry_model || undefined,
          direction_structure: row.direction_structure || undefined,
          entry_timing: row.entry_timing || undefined,
          notes: row.notes || undefined,
        });
      }

      setParsedTrades(trades);
      setProgress({
        current: 0,
        total: trades.length,
        percent: 0,
        status: "idle",
        errors,
        successes: 0,
      });

      if (errors.length > 0) {
        toast({
          title: `${trades.length} trades parsés`,
          description: `${errors.length} erreur(s) de parsing détectée(s).`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Fichier parsé",
          description: `${trades.length} trades prêts à importer.`,
        });
      }
    } catch (error: any) {
      setProgress((p) => ({
        ...p,
        status: "error",
        errors: [error.message],
      }));
      toast({
        title: "Erreur de parsing",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle screenshot files selection
  const handleScreenshotsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    let totalSize = getTotalFileSize();

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;

      totalSize += file.size;
      if (totalSize > MAX_FILE_SIZE) {
        toast({
          title: "Limite de taille atteinte",
          description: `La taille totale ne peut pas dépasser 20 MB.`,
          variant: "destructive",
        });
        break;
      }

      validFiles.push(file);
    }

    setScreenshotFiles((prev) => [...prev, ...validFiles]);
  };

  // Match screenshots to trades by filename
  const matchScreenshotToTrade = (
    tradeNumber: number
  ): File | undefined => {
    // Look for files named like "trade_1.png", "1.jpg", "execution_1.png" etc.
    return screenshotFiles.find((file) => {
      const name = file.name.toLowerCase();
      const patterns = [
        `trade_${tradeNumber}`,
        `trade${tradeNumber}`,
        `execution_${tradeNumber}`,
        `${tradeNumber}.`,
        `_${tradeNumber}.`,
        `-${tradeNumber}.`,
      ];
      return patterns.some((p) => name.includes(p));
    });
  };

  // Upload a single screenshot
  const uploadScreenshot = async (
    userId: string,
    tradeNumber: number,
    file: File
  ): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/execution_${tradeNumber}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("trade-screenshots")
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("trade-screenshots").getPublicUrl(data.path);

    return publicUrl;
  };

  // Process batch upload
  const handleBatchUpload = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Non connecté",
        description: "Vous devez être connecté pour importer des trades.",
        variant: "destructive",
      });
      return;
    }

    if (parsedTrades.length === 0) {
      toast({
        title: "Aucun trade",
        description: "Veuillez d'abord charger un fichier CSV.",
        variant: "destructive",
      });
      return;
    }

    setProgress({
      current: 0,
      total: parsedTrades.length,
      percent: 0,
      status: "uploading",
      errors: [],
      successes: 0,
    });

    const errors: string[] = [];
    let successCount = 0;

    // Process in batches
    for (let i = 0; i < parsedTrades.length; i += BATCH_SIZE) {
      const batch = parsedTrades.slice(i, i + BATCH_SIZE);

      for (const trade of batch) {
        setProgress((p) => ({
          ...p,
          currentItem: `Trade #${trade.trade_number}`,
        }));

        try {
          // Match and upload screenshot if available
          let screenshotUrl: string | null = null;
          const matchedFile = matchScreenshotToTrade(trade.trade_number);

          if (matchedFile) {
            screenshotUrl = await uploadScreenshot(
              user.id,
              trade.trade_number,
              matchedFile
            );
          }

          // Insert trade data
          const { error } = await supabase.from("user_executions").insert({
            user_id: user.id,
            trade_number: trade.trade_number,
            trade_date: trade.trade_date,
            direction: trade.direction,
            entry_time: trade.entry_time || null,
            exit_time: trade.exit_time || null,
            exit_date: trade.exit_date || null,
            entry_price: trade.entry_price || null,
            exit_price: trade.exit_price || null,
            stop_loss: trade.stop_loss || null,
            take_profit: trade.take_profit || null,
            rr: trade.rr || null,
            result: trade.result || null,
            setup_type: trade.setup_type || null,
            entry_model: trade.entry_model || null,
            direction_structure: trade.direction_structure || null,
            entry_timing: trade.entry_timing || null,
            notes: trade.notes || null,
            screenshot_url: screenshotUrl,
          });

          if (error) {
            if (error.code === "23505") {
              errors.push(`Trade #${trade.trade_number}: déjà existant`);
            } else {
              errors.push(`Trade #${trade.trade_number}: ${error.message}`);
            }
          } else {
            successCount++;
          }
        } catch (e: any) {
          errors.push(`Trade #${trade.trade_number}: ${e.message}`);
        }

        // Update progress
        setProgress((p) => ({
          ...p,
          current: p.current + 1,
          percent: Math.round(((p.current + 1) / parsedTrades.length) * 100),
          errors,
          successes: successCount,
        }));
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setProgress((p) => ({ ...p, status: "complete" }));

    toast({
      title: "Import terminé",
      description: `${successCount} trades importés avec succès. ${errors.length} erreur(s).`,
      variant: errors.length > 0 ? "destructive" : "default",
    });

    if (successCount > 0) {
      onComplete();
    }
  };

  // Reset dialog
  const handleReset = () => {
    setCsvFile(null);
    setScreenshotFiles([]);
    setParsedTrades([]);
    setProgress({
      current: 0,
      total: 0,
      percent: 0,
      status: "idle",
      errors: [],
      successes: 0,
    });
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (screenshotInputRef.current) screenshotInputRef.current.value = "";
  };

  // Download CSV template
  const downloadTemplate = () => {
    const headers = [
      "trade_number",
      "trade_date",
      "direction",
      "entry_time",
      "exit_time",
      "exit_date",
      "entry_price",
      "exit_price",
      "stop_loss",
      "take_profit",
      "rr",
      "result",
      "setup_type",
      "entry_model",
      "direction_structure",
      "entry_timing",
      "notes",
    ];

    const exampleRow = [
      "1",
      "2025-01-27",
      "Long",
      "15:45",
      "16:30",
      "2025-01-27",
      "21500.50",
      "21550.00",
      "21480.00",
      "21550.00",
      "2.5",
      "Win",
      "A",
      "BOS",
      "Continuation",
      "Open US 15:30",
      "Trade sur structure haussière",
    ];

    const csv = [headers.join(";"), exampleRow.join(";")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_trades_import.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Remove a screenshot file
  const removeScreenshot = (index: number) => {
    setScreenshotFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const isUploading = progress.status === "uploading";
  const isComplete = progress.status === "complete";
  const totalSize = getTotalFileSize();
  const sizePercent = (totalSize / MAX_FILE_SIZE) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Import Batch de Trades
          </DialogTitle>
          <DialogDescription>
            Importez plusieurs trades et leurs screenshots en une seule fois.
            Limite: 20 MB total.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* File size indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Espace utilisé</span>
                <span
                  className={cn(
                    "font-mono",
                    sizePercent > 90 ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {formatFileSize(totalSize)} / 20 MB
                </span>
              </div>
              <Progress
                value={sizePercent}
                className={cn("h-2", sizePercent > 90 && "[&>div]:bg-destructive")}
              />
            </div>

            {/* CSV Upload Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  1. Fichier CSV des trades
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={downloadTemplate}
                >
                  <Download className="w-3.5 h-3.5" />
                  Template CSV
                </Button>
              </div>

              <div
                onClick={() => csvInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  csvFile
                    ? "border-primary/50 bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvSelect}
                  className="hidden"
                  disabled={isUploading}
                />
                {csvFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium text-sm">{csvFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(csvFile.size)} • {parsedTrades.length} trades
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCsvFile(null);
                        setParsedTrades([]);
                        if (csvInputRef.current) csvInputRef.current.value = "";
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Cliquez pour sélectionner un fichier CSV
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Séparateur: point-virgule (;)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Screenshots Upload Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                2. Screenshots (optionnel)
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Nommez vos fichiers avec le numéro du trade (ex: trade_1.png, 1.jpg)
              </p>

              <div
                onClick={() => screenshotInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  screenshotFiles.length > 0
                    ? "border-primary/50 bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <input
                  ref={screenshotInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleScreenshotsSelect}
                  className="hidden"
                  disabled={isUploading}
                />
                <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Cliquez pour sélectionner des images
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  PNG, JPG, WEBP
                </p>
              </div>

              {/* Screenshot list */}
              {screenshotFiles.length > 0 && (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {screenshotFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <ImageIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-muted-foreground flex-shrink-0">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeScreenshot(idx)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Parsing errors */}
            {progress.errors.length > 0 && progress.status !== "uploading" && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  {progress.errors.length} erreur(s) détectée(s)
                </div>
                <ul className="text-xs text-destructive/80 space-y-1 max-h-24 overflow-y-auto">
                  {progress.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {progress.errors.length > 10 && (
                    <li className="text-muted-foreground">
                      ... et {progress.errors.length - 10} autres
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Upload progress */}
            {(isUploading || isComplete) && (
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {progress.currentItem}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Import terminé
                      </>
                    )}
                  </span>
                  <span className="font-mono text-xs">
                    {progress.current}/{progress.total}
                  </span>
                </div>
                <Progress value={progress.percent} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="text-emerald-500">
                    {progress.successes} importés
                  </span>
                  {progress.errors.length > 0 && (
                    <span className="text-destructive">
                      {progress.errors.length} erreurs
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4 pt-4 border-t gap-2">
          <Button variant="outline" onClick={handleReset} disabled={isUploading}>
            Réinitialiser
          </Button>
          <Button
            onClick={handleBatchUpload}
            disabled={parsedTrades.length === 0 || isUploading || isComplete}
            className="gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Import en cours...
              </>
            ) : isComplete ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Terminé
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Importer {parsedTrades.length} trades
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
