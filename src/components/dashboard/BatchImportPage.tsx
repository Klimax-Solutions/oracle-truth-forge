import { useState, useRef, useCallback, useEffect } from "react";
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
  Send,
  RefreshCw,
  EyeOff,
  CheckSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
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

interface StoredImage {
  id: string;
  name: string;
  path: string;
  tradeNumber: number;
  type: "m15" | "m5";
  signedUrl?: string;
  isLinkedOracle?: boolean;
  isLinkedPerso?: boolean;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const BATCH_SIZE = 10;

export const BatchImportPage = () => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [parsedTrades, setParsedTrades] = useState<TradeData[]>([]);
  const [importType, setImportType] = useState<"oracle" | "screenshots" | "database">("oracle");
  const [storedImages, setStoredImages] = useState<StoredImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [sendingImages, setSendingImages] = useState<Set<string>>(new Set());
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [hideLinkedImages, setHideLinkedImages] = useState(false);
  const [batchSending, setBatchSending] = useState(false);
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

  // Load all stored images from supabase storage with linked status
  const loadStoredImages = async () => {
    setLoadingImages(true);
    try {
      const { data: files, error } = await supabase.storage
        .from("trade-screenshots")
        .list("oracle", { limit: 1000 });
      
      if (error) {
        console.error("Error listing storage files:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les images",
          variant: "destructive",
        });
        return;
      }
      
      if (files && files.length > 0) {
        const images: StoredImage[] = [];
        const tradeNumbers = new Set<number>();
        
        // First pass: extract all trade numbers
        for (const file of files) {
          const match = file.name.match(/trade_(\d+)_(m15|m5)/i);
          if (match) {
            tradeNumbers.add(parseInt(match[1]));
          }
        }
        
        // Fetch linked status from Oracle (trades table)
        const { data: oracleTrades } = await supabase
          .from("trades")
          .select("trade_number, screenshot_m15_m5, screenshot_m1")
          .in("trade_number", Array.from(tradeNumbers));
        
        // Fetch linked status from Setup Perso (user_personal_trades table)
        const { data: { user } } = await supabase.auth.getUser();
        let persoTrades: any[] = [];
        if (user) {
          const { data } = await supabase
            .from("user_personal_trades")
            .select("trade_number, screenshot_url")
            .eq("user_id", user.id)
            .in("trade_number", Array.from(tradeNumbers));
          persoTrades = data || [];
        }
        
        // Create lookup maps
        const oracleLinked = new Map<string, boolean>();
        if (oracleTrades) {
          for (const trade of oracleTrades) {
            if (trade.screenshot_m15_m5) {
              oracleLinked.set(`${trade.trade_number}_m15`, true);
            }
            if (trade.screenshot_m1) {
              oracleLinked.set(`${trade.trade_number}_m5`, true);
            }
          }
        }
        
        const persoLinked = new Map<string, boolean>();
        for (const trade of persoTrades) {
          if (trade.screenshot_url) {
            persoLinked.set(`${trade.trade_number}`, true);
          }
        }
        
        for (const file of files) {
          // Extract trade number and type from filename (e.g., trade_151_m15.png)
          const match = file.name.match(/trade_(\d+)_(m15|m5)/i);
          if (match) {
            const tradeNumber = parseInt(match[1]);
            const type = match[2].toLowerCase() as "m15" | "m5";
            
            // Generate signed URL
            const { data: signedData } = await supabase.storage
              .from("trade-screenshots")
              .createSignedUrl(`oracle/${file.name}`, 3600);
            
            const key = `${tradeNumber}_${type}`;
            
            images.push({
              id: file.id || file.name,
              name: file.name,
              path: `oracle/${file.name}`,
              tradeNumber,
              type,
              signedUrl: signedData?.signedUrl,
              isLinkedOracle: oracleLinked.has(key),
              isLinkedPerso: persoLinked.has(`${tradeNumber}`),
            });
          }
        }
        
        // Sort by trade number
        images.sort((a, b) => a.tradeNumber - b.tradeNumber);
        setStoredImages(images);
        setSelectedImages(new Set()); // Reset selection
        
        toast({
          title: "Images chargées",
          description: `${images.length} image(s) trouvée(s) dans le stockage`,
        });
      } else {
        setStoredImages([]);
        toast({
          title: "Aucune image",
          description: "Le stockage Oracle est vide",
        });
      }
    } catch (e: any) {
      console.error("Error loading images:", e);
      toast({
        title: "Erreur",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoadingImages(false);
    }
  };

  // Load images when switching to database tab
  useEffect(() => {
    if (importType === "database" && storedImages.length === 0) {
      loadStoredImages();
    }
  }, [importType]);

  // Send image to Oracle or Setup Perso
  const sendImageToDatabase = async (image: StoredImage, destination: "oracle" | "perso") => {
    setSendingImages(prev => new Set(prev).add(image.id));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Non connecté",
          description: "Vous devez être connecté",
          variant: "destructive",
        });
        return;
      }

      const columnName = image.type === "m15" ? "screenshot_m15_m5" : "screenshot_m1";
      const updateData: Record<string, string> = { [columnName]: image.path };

      if (destination === "oracle") {
        // Update trades table (Oracle) - use select to verify update worked
        console.log(`Sending image to Oracle: trade #${image.tradeNumber}, column: ${columnName}, path: ${image.path}`);
        
        const { data, error } = await supabase
          .from("trades")
          .update(updateData)
          .eq("trade_number", image.tradeNumber)
          .select("id, trade_number");

        if (error) {
          console.error("Oracle update error:", error);
          throw new Error(error.message);
        }

        if (!data || data.length === 0) {
          console.warn(`Trade #${image.tradeNumber} not found in Oracle`);
          toast({
            title: "Trade non trouvé",
            description: `Aucun trade #${image.tradeNumber} dans la base Oracle`,
            variant: "destructive",
          });
          return;
        }

        console.log(`Successfully updated trade #${image.tradeNumber}`, data);
        toast({
          title: "Image liée à Oracle",
          description: `Trade #${image.tradeNumber} (${image.type.toUpperCase()}) mis à jour`,
        });
        
        // Refresh to update linked status
        await loadStoredImages();
      } else {
        // Update user_personal_trades table (Setup Perso)
        // First check if trade exists for this user
        const { data: existingTrade, error: checkError } = await supabase
          .from("user_personal_trades")
          .select("id")
          .eq("user_id", user.id)
          .eq("trade_number", image.tradeNumber)
          .maybeSingle();

        if (checkError) throw new Error(checkError.message);

        if (existingTrade) {
          // Update existing trade
          const { error } = await supabase
            .from("user_personal_trades")
            .update({ screenshot_url: image.path })
            .eq("id", existingTrade.id);

          if (error) throw new Error(error.message);

          toast({
            title: "Image liée à Setup Perso",
            description: `Trade #${image.tradeNumber} mis à jour`,
          });
          
          // Refresh to update linked status
          await loadStoredImages();
        } else {
          toast({
            title: "Trade non trouvé",
            description: `Aucun trade #${image.tradeNumber} dans votre Setup Perso`,
            variant: "destructive",
          });
        }
      }
    } catch (e: any) {
      console.error("Error sending image:", e);
      toast({
        title: "Erreur",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSendingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(image.id);
        return newSet;
      });
    }
  };

  // Toggle image selection
  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  // Get filtered images based on hideLinkedImages
  const filteredStoredImages = hideLinkedImages
    ? storedImages.filter(img => !img.isLinkedOracle)
    : storedImages;

  // Get selectable images (exclude already linked to Oracle)
  const selectableImages = filteredStoredImages.filter(img => !img.isLinkedOracle);

  // Select all visible images that are NOT already linked
  const selectAllImages = () => {
    const allIds = selectableImages.map(img => img.id);
    setSelectedImages(new Set(allIds));
  };

  // Deselect all images
  const deselectAllImages = () => {
    setSelectedImages(new Set());
  };

  // Check if all selectable images are selected
  const allSelected = selectableImages.length > 0 && 
    selectableImages.every(img => selectedImages.has(img.id));

  // Batch send selected images to database
  const batchSendToDatabase = async (destination: "oracle" | "perso") => {
    if (selectedImages.size === 0) {
      toast({
        title: "Aucune image sélectionnée",
        description: "Sélectionnez des images à envoyer",
        variant: "destructive",
      });
      return;
    }

    setBatchSending(true);
    const imagesToSend = storedImages.filter(img => selectedImages.has(img.id));
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Non connecté",
        description: "Vous devez être connecté",
        variant: "destructive",
      });
      setBatchSending(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Group images by trade number to batch updates
    const imagesByTrade = new Map<number, StoredImage[]>();
    for (const image of imagesToSend) {
      const existing = imagesByTrade.get(image.tradeNumber) || [];
      existing.push(image);
      imagesByTrade.set(image.tradeNumber, existing);
    }

    console.log(`Batch sending ${imagesToSend.length} images for ${imagesByTrade.size} trades to ${destination}`);

    if (destination === "oracle") {
      // Process Oracle updates in batches
      for (const [tradeNumber, images] of imagesByTrade) {
        try {
          // Build update object with all images for this trade
          const updateData: Record<string, string> = {};
          for (const image of images) {
            const columnName = image.type === "m15" ? "screenshot_m15_m5" : "screenshot_m1";
            updateData[columnName] = image.path;
          }

          console.log(`Updating trade #${tradeNumber} with:`, updateData);

          // Use select to check if update was successful
          const { data, error, count } = await supabase
            .from("trades")
            .update(updateData)
            .eq("trade_number", tradeNumber)
            .select("id, trade_number");

          if (error) {
            console.error(`Error updating trade #${tradeNumber}:`, error);
            errors.push(`Trade #${tradeNumber}: ${error.message}`);
            errorCount += images.length;
          } else if (!data || data.length === 0) {
            console.warn(`Trade #${tradeNumber} not found or not updated`);
            errors.push(`Trade #${tradeNumber}: non trouvé dans Oracle`);
            errorCount += images.length;
          } else {
            console.log(`Successfully updated trade #${tradeNumber}`, data);
            successCount += images.length;
          }
        } catch (e: any) {
          console.error(`Exception updating trade #${tradeNumber}:`, e);
          errors.push(`Trade #${tradeNumber}: ${e.message}`);
          errorCount += images.length;
        }
      }
    } else {
      // Process Setup Perso updates
      for (const image of imagesToSend) {
        try {
          const { data: existingTrade, error: checkError } = await supabase
            .from("user_personal_trades")
            .select("id")
            .eq("user_id", user.id)
            .eq("trade_number", image.tradeNumber)
            .maybeSingle();

          if (checkError) throw checkError;

          if (existingTrade) {
            const { error } = await supabase
              .from("user_personal_trades")
              .update({ screenshot_url: image.path })
              .eq("id", existingTrade.id);

            if (error) throw error;
            successCount++;
          } else {
            errors.push(`Trade #${image.tradeNumber}: non trouvé dans Setup Perso`);
            errorCount++;
          }
        } catch (e: any) {
          errors.push(`Trade #${image.tradeNumber}: ${e.message}`);
          errorCount++;
        }
      }
    }

    setBatchSending(false);
    setSelectedImages(new Set());
    
    // Show detailed toast
    const description = successCount > 0 
      ? `${successCount} image(s) liée(s) avec succès.${errorCount > 0 ? ` ${errorCount} erreur(s).` : ""}`
      : `Aucune image liée. ${errors.slice(0, 3).join(", ")}${errors.length > 3 ? "..." : ""}`;

    toast({
      title: successCount > 0 ? "Envoi terminé" : "Échec de l'envoi",
      description,
      variant: errorCount > 0 && successCount === 0 ? "destructive" : "default",
    });

    // Log errors for debugging
    if (errors.length > 0) {
      console.log("Batch send errors:", errors);
    }

    // Reload to update linked status
    await loadStoredImages();
  };

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
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Import Batch (Admin)
          </h2>
          <p className="text-sm text-muted-foreground font-mono">
            Importer des trades Oracle avec leurs screenshots en masse
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.dispatchEvent(new CustomEvent('navigate-oracle-screenshots'))}
        >
          <ImageIcon className="w-4 h-4" />
          Afficher Trades avec Screenshots
        </Button>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Tabs for import type */}
          <Tabs value={importType} onValueChange={(v) => setImportType(v as "oracle" | "screenshots" | "database")}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="oracle" className="gap-2">
                <Database className="w-4 h-4" />
                CSV + Screenshots
              </TabsTrigger>
              <TabsTrigger value="screenshots" className="gap-2">
                <ImageIcon className="w-4 h-4" />
                Screenshots uniquement
              </TabsTrigger>
              <TabsTrigger value="database" className="gap-2">
                <FolderOpen className="w-4 h-4" />
                Base de données image
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

            {/* Image Database Tab */}
            <TabsContent value="database" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Base de données des images</CardTitle>
                      <CardDescription>
                        Toutes les images uploadées dans le stockage Oracle. Envoyez-les vers la base de votre choix.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={hideLinkedImages ? "default" : "outline"}
                        size="sm"
                        onClick={() => setHideLinkedImages(!hideLinkedImages)}
                        className="gap-2"
                      >
                        <EyeOff className="w-4 h-4" />
                        Masquer liées
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadStoredImages}
                        disabled={loadingImages}
                        className="gap-2"
                      >
                        {loadingImages ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Actualiser
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Selection bar */}
                  {filteredStoredImages.length > 0 && (
                    <div className="flex items-center justify-between px-2 py-2 bg-muted/30 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => allSelected ? deselectAllImages() : selectAllImages()}
                        />
                        <span className="text-sm text-muted-foreground">
                          {selectedImages.size > 0
                            ? `${selectedImages.size} sélectionnée(s)`
                            : "Tout sélectionner"}
                        </span>
                      </div>
                      {selectedImages.size > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="default"
                              size="sm"
                              className="gap-2"
                              disabled={batchSending}
                            >
                              {batchSending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                              Envoyer sélection vers
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => batchSendToDatabase("oracle")}
                              className="gap-2"
                            >
                              <Database className="w-4 h-4" />
                              Base Oracle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => batchSendToDatabase("perso")}
                              className="gap-2"
                            >
                              <FolderOpen className="w-4 h-4" />
                              Setup Perso
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )}

                  {loadingImages ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : storedImages.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Aucune image dans le stockage</p>
                      <p className="text-xs mt-1">
                        Uploadez des screenshots via les autres onglets
                      </p>
                    </div>
                  ) : filteredStoredImages.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Toutes les images sont déjà liées</p>
                      <p className="text-xs mt-1">
                        Désactivez le filtre pour les voir
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredStoredImages.map((image) => {
                        const isDuplicate = image.isLinkedOracle;
                        return (
                          <div
                            key={image.id}
                            className={cn(
                              "flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                              isDuplicate
                                ? "bg-amber-500/10 border border-amber-500/30 opacity-70"
                                : selectedImages.has(image.id)
                                  ? "bg-primary/10 border border-primary/30"
                                  : "bg-muted/50 hover:bg-muted"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              {/* Checkbox - disabled for duplicates */}
                              <Checkbox
                                checked={selectedImages.has(image.id)}
                                onCheckedChange={() => !isDuplicate && toggleImageSelection(image.id)}
                                disabled={isDuplicate}
                                className={cn(isDuplicate && "opacity-50 cursor-not-allowed")}
                              />
                              
                              {/* Thumbnail */}
                              {image.signedUrl ? (
                                <img
                                  src={image.signedUrl}
                                  alt={image.name}
                                  className={cn(
                                    "w-12 h-12 object-cover rounded border border-border",
                                    isDuplicate && "grayscale"
                                  )}
                                />
                              ) : (
                                <div className="w-12 h-12 bg-muted rounded border border-border flex items-center justify-center">
                                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                              
                              {/* Trade info */}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "font-mono font-bold",
                                    isDuplicate ? "text-muted-foreground" : "text-foreground"
                                  )}>
                                    Trade #{image.tradeNumber}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-xs px-2 py-0.5 rounded font-medium",
                                      image.type === "m15"
                                        ? "bg-primary/20 text-primary"
                                        : "bg-emerald-500/20 text-emerald-600"
                                    )}
                                  >
                                    {image.type.toUpperCase()}
                                  </span>
                                  {isDuplicate && (
                                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-500/20 text-amber-600">
                                      ⚠ Doublon Oracle
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                                  {image.name}
                                </p>
                              </div>
                            </div>

                            {/* Send button - disabled for duplicates */}
                            {isDuplicate ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 opacity-50 cursor-not-allowed"
                                disabled
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Déjà lié
                              </Button>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    disabled={sendingImages.has(image.id)}
                                  >
                                    {sendingImages.has(image.id) ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Send className="w-4 h-4" />
                                    )}
                                    Envoyer vers
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => sendImageToDatabase(image, "oracle")}
                                    className="gap-2"
                                  >
                                    <Database className="w-4 h-4" />
                                    Base Oracle
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => sendImageToDatabase(image, "perso")}
                                    className="gap-2"
                                  >
                                    <FolderOpen className="w-4 h-4" />
                                    Setup Perso
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats */}
              {storedImages.length > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                  <span>
                    {filteredStoredImages.length} affichée(s) sur {storedImages.length} au total
                    {hideLinkedImages && ` (${storedImages.length - filteredStoredImages.length} masquée(s))`}
                  </span>
                  <span>
                    {storedImages.filter(i => i.type === "m15").length} M15 • {storedImages.filter(i => i.type === "m5").length} M5
                  </span>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
};
