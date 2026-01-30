import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  Database,
  Calendar,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TradeData {
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  direction_structure?: string;
  entry_time?: string;
  exit_time?: string;
  trade_duration?: string;
  rr?: number;
  stop_loss_size?: string;
  setup_type?: string;
  entry_timing?: string;
  entry_model?: string;
  target_timing?: string;
  speculation_hl_valid?: boolean;
  target_hl_valid?: boolean;
  news_day?: boolean;
  news_label?: string;
  screenshot_m15_m5?: string;
  screenshot_m1?: string;
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
const BATCH_SIZE = 10;

export const BatchImportPage = () => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [parsedTrades, setParsedTrades] = useState<TradeData[]>([]);
  const [importType, setImportType] = useState<"oracle" | "screenshots">("oracle");
  const [progress, setProgress] = useState<UploadProgress>({
    current: 0,
    total: 0,
    percent: 0,
    status: "idle",
    errors: [],
    successes: 0,
  });
  const [matchedScreenshots, setMatchedScreenshots] = useState<{tradeNumber: number; m15?: File; m5?: File}[]>([]);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const screenshotOnlyInputRef = useRef<HTMLInputElement>(null);
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

  // Get day of week from date
  const getDayOfWeek = (dateStr: string): string => {
    const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const date = new Date(dateStr);
    return days[date.getDay()];
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

  // Parse CSV file for Oracle trades
  const parseCSV = async (file: File) => {
    setProgress((p) => ({ ...p, status: "parsing", currentItem: file.name }));

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        throw new Error("Le fichier CSV doit contenir au moins une ligne de données.");
      }

      // Parse header
      const headers = lines[0].split(";").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

      // Required columns for Oracle
      const requiredCols = ["trade_number", "trade_date", "direction"];
      const missingCols = requiredCols.filter((col) => !headers.includes(col));

      if (missingCols.length > 0) {
        throw new Error(`Colonnes manquantes: ${missingCols.join(", ")}. Utilisez le template CSV.`);
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
          day_of_week: row.day_of_week || getDayOfWeek(row.trade_date),
          direction: direction === "long" ? "Long" : "Short",
          direction_structure: row.direction_structure || undefined,
          entry_time: row.entry_time || undefined,
          exit_time: row.exit_time || undefined,
          trade_duration: row.trade_duration || undefined,
          rr: row.rr ? parseFloat(row.rr) : undefined,
          stop_loss_size: row.stop_loss_size || undefined,
          setup_type: row.setup_type || undefined,
          entry_timing: row.entry_timing || undefined,
          entry_model: row.entry_model || undefined,
          target_timing: row.target_timing || undefined,
          speculation_hl_valid: row.speculation_hl_valid === "true" || row.speculation_hl_valid === "1",
          target_hl_valid: row.target_hl_valid === "true" || row.target_hl_valid === "1",
          news_day: row.news_day === "true" || row.news_day === "1",
          news_label: row.news_label || undefined,
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

  // Match M15 screenshot to trade
  const matchM15Screenshot = (tradeNumber: number): File | undefined => {
    return screenshotFiles.find((file) => {
      const name = file.name.toLowerCase();
      return (
        (name.includes(`trade_${tradeNumber}_m15`) ||
          name.includes(`trade${tradeNumber}_m15`) ||
          name.includes(`${tradeNumber}_m15`)) &&
        !name.includes("m5")
      );
    });
  };

  // Match M5 screenshot to trade
  const matchM5Screenshot = (tradeNumber: number): File | undefined => {
    return screenshotFiles.find((file) => {
      const name = file.name.toLowerCase();
      return (
        name.includes(`trade_${tradeNumber}_m5`) ||
        name.includes(`trade${tradeNumber}_m5`) ||
        name.includes(`${tradeNumber}_m5`)
      );
    });
  };

  // Upload a screenshot - returns the storage path (not public URL)
  const uploadScreenshot = async (
    tradeNumber: number,
    file: File,
    type: "m15" | "m5"
  ): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `oracle/trade_${tradeNumber}_${type}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("trade-screenshots")
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    // Return the storage path, not a public URL
    // Signed URLs will be generated on-demand when displaying
    return data.path;
  };

  // Process batch upload for Oracle trades
  const handleBatchUpload = async () => {
    const { data: { user } } = await supabase.auth.getUser();
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
          // Upload screenshots if available
          let screenshotM15Url: string | null = null;
          let screenshotM5Url: string | null = null;

          const m15File = matchM15Screenshot(trade.trade_number);
          const m5File = matchM5Screenshot(trade.trade_number);

          if (m15File) {
            screenshotM15Url = await uploadScreenshot(trade.trade_number, m15File, "m15");
          }

          if (m5File) {
            screenshotM5Url = await uploadScreenshot(trade.trade_number, m5File, "m5");
          }

          // Insert/update Oracle trade in trades table
          const { error } = await supabase.from("trades").upsert({
            user_id: user.id,
            trade_number: trade.trade_number,
            trade_date: trade.trade_date,
            day_of_week: trade.day_of_week,
            direction: trade.direction,
            direction_structure: trade.direction_structure || null,
            entry_time: trade.entry_time || null,
            exit_time: trade.exit_time || null,
            trade_duration: trade.trade_duration || null,
            rr: trade.rr || null,
            stop_loss_size: trade.stop_loss_size || null,
            setup_type: trade.setup_type || null,
            entry_timing: trade.entry_timing || null,
            entry_model: trade.entry_model || null,
            target_timing: trade.target_timing || null,
            speculation_hl_valid: trade.speculation_hl_valid || false,
            target_hl_valid: trade.target_hl_valid || false,
            news_day: trade.news_day || false,
            news_label: trade.news_label || null,
            screenshot_m15_m5: screenshotM15Url,
            screenshot_m1: screenshotM5Url,
          }, { onConflict: 'trade_number,user_id' });

          if (error) {
            errors.push(`Trade #${trade.trade_number}: ${error.message}`);
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
  };

  // Parse files and extract matched screenshots
  const parseAndMatchScreenshots = (files: File[]): {tradeNumber: number; m15?: File; m5?: File}[] => {
    const tradeMap = new Map<number, {m15?: File; m5?: File}>();

    for (const file of files) {
      const name = file.name.toLowerCase();
      
      // Enhanced regex patterns to match various filename formats
      const m15Patterns = [
        /trade[_\s]?(\d+)[_\s]?m15/i,
        /trade[_\s]?(\d+)[_\s]?h1/i,
        /trade[_\s]?(\d+)[_\s]+.*contexte/i,
        /(\d+)[_\s]?m15/i,
        /(\d+)[_\s]?h1/i,
      ];
      
      const m5Patterns = [
        /trade[_\s]?(\d+)[_\s]?m5/i,
        /trade[_\s]?(\d+)[_\s]?m1[^5]/i,
        /trade[_\s]?(\d+)[_\s]?m1$/i,
        /trade[_\s]?(\d+)[_\s]+.*entr[ée]e?/i,
        /(\d+)[_\s]?m5/i,
        /(\d+)[_\s]?m1[^5]/i,
      ];
      
      let isM15 = false;
      let isM5 = false;
      let tradeNum: number | null = null;
      
      for (const pattern of m15Patterns) {
        const match = name.match(pattern);
        if (match) {
          tradeNum = parseInt(match[1]);
          isM15 = true;
          break;
        }
      }
      
      if (!isM15) {
        for (const pattern of m5Patterns) {
          const match = name.match(pattern);
          if (match) {
            tradeNum = parseInt(match[1]);
            isM5 = true;
            break;
          }
        }
      }
      
      if (!tradeNum && name.includes('trade')) {
        const genericMatch = name.match(/trade[_\s]?(\d+)/i);
        if (genericMatch) {
          tradeNum = parseInt(genericMatch[1]);
          isM15 = true;
        }
      }
      
      if (tradeNum && !isNaN(tradeNum)) {
        if (!tradeMap.has(tradeNum)) tradeMap.set(tradeNum, {});
        if (isM15) {
          tradeMap.get(tradeNum)!.m15 = file;
        } else if (isM5) {
          tradeMap.get(tradeNum)!.m5 = file;
        }
      }
    }

    const matched: {tradeNumber: number; m15?: File; m5?: File}[] = [];
    tradeMap.forEach((files, tradeNumber) => {
      matched.push({ tradeNumber, ...files });
    });
    matched.sort((a, b) => a.tradeNumber - b.tradeNumber);
    return matched;
  };

  // Check for existing screenshots in storage to detect duplicates
  const checkExistingScreenshots = async (tradeNumbers: number[]): Promise<Set<string>> => {
    const existingFiles = new Set<string>();
    
    try {
      // List all files in the oracle folder
      const { data: files, error } = await supabase.storage
        .from("trade-screenshots")
        .list("oracle", { limit: 1000 });
      
      if (error) {
        console.error("Error listing storage files:", error);
        return existingFiles;
      }
      
      if (files) {
        for (const file of files) {
          // Extract trade number and type from filename (e.g., trade_151_m15.png)
          const match = file.name.match(/trade_(\d+)_(m15|m5)/i);
          if (match) {
            const key = `${match[1]}_${match[2].toLowerCase()}`;
            existingFiles.add(key);
          }
        }
      }
    } catch (e) {
      console.error("Error checking existing screenshots:", e);
    }
    
    return existingFiles;
  };

  // Auto-upload screenshots when selected
  const handleScreenshotsOnlySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    let totalSize = 0;

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

    if (validFiles.length === 0) return;

    setScreenshotFiles(validFiles);
    
    // Parse and match screenshots
    const matched = parseAndMatchScreenshots(validFiles);
    
    if (matched.length === 0) {
      toast({
        title: "Aucun trade détecté",
        description: "Nommez vos fichiers: trade_[N]_m15.png ou trade_[N]_m5.png",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicates in storage
    const tradeNumbers = matched.map(m => m.tradeNumber);
    const existingFiles = await checkExistingScreenshots(tradeNumbers);
    
    // Filter out duplicates
    const filteredMatches: {tradeNumber: number; m15?: File; m5?: File}[] = [];
    let duplicateCount = 0;
    
    for (const match of matched) {
      const m15Key = `${match.tradeNumber}_m15`;
      const m5Key = `${match.tradeNumber}_m5`;
      
      const hasM15Duplicate = match.m15 && existingFiles.has(m15Key);
      const hasM5Duplicate = match.m5 && existingFiles.has(m5Key);
      
      // Create a new match without duplicates
      const newMatch: {tradeNumber: number; m15?: File; m5?: File} = { tradeNumber: match.tradeNumber };
      
      if (match.m15 && !hasM15Duplicate) {
        newMatch.m15 = match.m15;
      } else if (hasM15Duplicate) {
        duplicateCount++;
      }
      
      if (match.m5 && !hasM5Duplicate) {
        newMatch.m5 = match.m5;
      } else if (hasM5Duplicate) {
        duplicateCount++;
      }
      
      // Only add if there's at least one file to upload
      if (newMatch.m15 || newMatch.m5) {
        filteredMatches.push(newMatch);
      }
    }
    
    setMatchedScreenshots(filteredMatches);
    
    if (duplicateCount > 0) {
      toast({
        title: `${duplicateCount} doublon(s) ignoré(s)`,
        description: `Ces screenshots existent déjà dans le stockage.`,
        variant: "default",
      });
    }
    
    if (filteredMatches.length === 0) {
      toast({
        title: "Tous les fichiers sont des doublons",
        description: "Ces screenshots existent déjà dans Oracle.",
      });
      return;
    }

    // Auto-upload immediately (only non-duplicates)
    toast({
      title: "Upload automatique",
      description: `${filteredMatches.length} trade(s) à uploader. ${duplicateCount > 0 ? `${duplicateCount} doublon(s) ignoré(s).` : ''}`,
    });

    await autoUploadScreenshots(filteredMatches);
  };

  // Automatic upload function
  const autoUploadScreenshots = async (matches: {tradeNumber: number; m15?: File; m5?: File}[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Non connecté",
        description: "Vous devez être connecté.",
        variant: "destructive",
      });
      return;
    }

    setProgress({
      current: 0,
      total: matches.length,
      percent: 0,
      status: "uploading",
      errors: [],
      successes: 0,
    });

    const errors: string[] = [];
    let successCount = 0;

    for (const match of matches) {
      setProgress((p) => ({
        ...p,
        currentItem: `Trade #${match.tradeNumber}`,
      }));

      try {
        let screenshotM15Url: string | null = null;
        let screenshotM5Url: string | null = null;

        if (match.m15) {
          screenshotM15Url = await uploadScreenshot(match.tradeNumber, match.m15, "m15");
        }

        if (match.m5) {
          screenshotM5Url = await uploadScreenshot(match.tradeNumber, match.m5, "m5");
        }

        // Update existing trade with screenshot URLs
        const updateData: Record<string, string | null> = {};
        if (screenshotM15Url) updateData.screenshot_m15_m5 = screenshotM15Url;
        if (screenshotM5Url) updateData.screenshot_m1 = screenshotM5Url;

        const { error } = await supabase
          .from("trades")
          .update(updateData)
          .eq("trade_number", match.tradeNumber);

        if (error) {
          errors.push(`Trade #${match.tradeNumber}: ${error.message}`);
        } else {
          successCount++;
        }
      } catch (e: any) {
        errors.push(`Trade #${match.tradeNumber}: ${e.message}`);
      }

      setProgress((p) => ({
        ...p,
        current: p.current + 1,
        percent: Math.round(((p.current + 1) / matches.length) * 100),
        errors,
        successes: successCount,
      }));
    }

    setProgress((p) => ({ ...p, status: "complete" }));

    toast({
      title: "Upload terminé ✓",
      description: `${successCount} screenshot(s) stocké(s) dans Oracle. ${errors.length > 0 ? `${errors.length} erreur(s).` : ''}`,
      variant: errors.length > 0 ? "destructive" : "default",
    });
  };

  // Legacy function kept for backwards compatibility - now handled by autoUploadScreenshots

  // Reset
  const handleReset = () => {
    setCsvFile(null);
    setScreenshotFiles([]);
    setParsedTrades([]);
    setMatchedScreenshots([]);
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
    if (screenshotOnlyInputRef.current) screenshotOnlyInputRef.current.value = "";
  };

  // Download CSV template for Oracle
  const downloadOracleTemplate = () => {
    const headers = [
      "trade_number",
      "trade_date",
      "day_of_week",
      "direction",
      "direction_structure",
      "entry_time",
      "exit_time",
      "trade_duration",
      "rr",
      "stop_loss_size",
      "setup_type",
      "entry_timing",
      "entry_model",
      "target_timing",
      "speculation_hl_valid",
      "target_hl_valid",
      "news_day",
      "news_label",
    ];

    const exampleRow = [
      "151",
      "2025-01-27",
      "Lundi",
      "Long",
      "Continuation",
      "15:45",
      "16:30",
      "45min",
      "2.5",
      "Petit",
      "A",
      "Open US 15:30",
      "BOS",
      "Classique",
      "true",
      "true",
      "false",
      "",
    ];

    const csv = [headers.join(";"), exampleRow.join(";")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_oracle_import.csv";
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground mb-1">
          Import Batch (Admin)
        </h2>
        <p className="text-sm text-muted-foreground font-mono">
          Importer des trades Oracle avec leurs screenshots en masse
        </p>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Tabs for import type */}
          <Tabs value={importType} onValueChange={(v) => setImportType(v as "oracle" | "screenshots")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oracle" className="gap-2">
                <Database className="w-4 h-4" />
                CSV + Screenshots
              </TabsTrigger>
              <TabsTrigger value="screenshots" className="gap-2">
                <ImageIcon className="w-4 h-4" />
                Screenshots uniquement
              </TabsTrigger>
            </TabsList>

            <TabsContent value="oracle" className="mt-6 space-y-6">
              {/* File size indicator */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Espace utilisé</span>
                    <span
                      className={cn(
                        "font-mono text-xs",
                        sizePercent > 90 ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {formatFileSize(totalSize)} / 20 MB
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Progress
                    value={sizePercent}
                    className={cn("h-2", sizePercent > 90 && "[&>div]:bg-destructive")}
                  />
                </CardContent>
              </Card>

              {/* CSV Upload Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">1. Fichier CSV des trades Oracle</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={downloadOracleTemplate}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Template CSV
                    </Button>
                  </div>
                  <CardDescription>
                    Séparateur point-virgule (;). Colonnes requises: trade_number, trade_date, direction
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    onClick={() => csvInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
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
                        <FileSpreadsheet className="w-10 h-10 text-primary" />
                        <div className="text-left">
                          <p className="font-medium">{csvFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(csvFile.size)} • {parsedTrades.length} trades parsés
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-4"
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
                        <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Cliquez pour sélectionner un fichier CSV
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Screenshots Upload Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">2. Screenshots (optionnel)</CardTitle>
                  <CardDescription>
                    Nommez vos fichiers: trade_[N]_m15.png et trade_[N]_m5.png (ex: trade_151_m15.png)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                      Cliquez pour sélectionner des images ({screenshotFiles.length} fichier{screenshotFiles.length !== 1 ? 's' : ''} chargé{screenshotFiles.length !== 1 ? 's' : ''})
                    </p>
                  </div>

                  {/* Screenshot list */}
                  {screenshotFiles.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {screenshotFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md text-sm"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <ImageIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{file.name}</span>
                            <span className="text-muted-foreground flex-shrink-0 text-xs">
                              ({formatFileSize(file.size)})
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeScreenshot(idx)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Parsing errors */}
              {progress.errors.length > 0 && progress.status !== "uploading" && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      {progress.errors.length} erreur(s) détectée(s)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-xs text-destructive/80 space-y-1 max-h-32 overflow-y-auto">
                      {progress.errors.slice(0, 15).map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                      {progress.errors.length > 15 && (
                        <li className="text-muted-foreground">
                          ... et {progress.errors.length - 15} autres
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Upload progress */}
              {(isUploading || isComplete) && (
                <Card>
                  <CardContent className="pt-6 space-y-4">
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
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4">
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
              </div>
            </TabsContent>

            {/* Screenshots Only Tab */}
            <TabsContent value="screenshots" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Upload Screenshots pour trades existants</CardTitle>
                  <CardDescription>
                    Uploadez des screenshots pour des trades déjà dans la base de données Oracle.
                    Nommez vos fichiers: trade_[N]_m15.png et trade_[N]_m5.png
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    onClick={() => screenshotOnlyInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                      screenshotFiles.length > 0
                        ? "border-primary/50 bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <input
                      ref={screenshotOnlyInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleScreenshotsOnlySelect}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Cliquez pour sélectionner des images PNG
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Max 20 MB au total
                    </p>
                  </div>

                  {/* Matched screenshots preview */}
                  {matchedScreenshots.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {matchedScreenshots.length} trade(s) détecté(s):
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {matchedScreenshots.map((match, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md text-sm"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-foreground">
                                #{match.tradeNumber}
                              </span>
                              <div className="flex gap-2">
                                {match.m15 && (
                                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                    M15
                                  </span>
                                )}
                                {match.m5 && (
                                  <span className="text-xs bg-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded">
                                    M5
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {match.m15 && <span>{match.m15.name}</span>}
                              {match.m15 && match.m5 && <span> + </span>}
                              {match.m5 && <span>{match.m5.name}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upload progress */}
              {(isUploading || isComplete) && (
                <Card>
                  <CardContent className="pt-6 space-y-4">
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
                            Upload terminé
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
                        {progress.successes} mis à jour
                      </span>
                      {progress.errors.length > 0 && (
                        <span className="text-destructive">
                          {progress.errors.length} erreurs
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Errors */}
              {progress.errors.length > 0 && progress.status === "complete" && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      {progress.errors.length} erreur(s)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-xs text-destructive/80 space-y-1">
                      {progress.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Actions - only show reset since upload is automatic */}
              <div className="flex items-center justify-end gap-3 pt-4">
                <Button variant="outline" onClick={handleReset} disabled={isUploading}>
                  Réinitialiser
                </Button>
                {isComplete && (
                  <div className="flex items-center gap-2 text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Stocké avec succès</span>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
};
