import { useState, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, CheckCircle, XCircle, Loader2, GitCompare, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { extractStoragePath } from "@/hooks/useSignedUrl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface TradeScreenshotItem {
  tradeNumber: number;
  tradeDate: string;
  direction: string;
  directionStructure?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  rr?: number | null;
  setupType?: string | null;
  entryModel?: string | null;
  entryTiming?: string | null;
  entryTimeframe?: string | null;
  notes?: string | null;
  screenshotM15?: string | null;
  screenshotM5?: string | null;
  executionId?: string;
}

export interface OracleMatch {
  tradeNumber: number;
  tradeDate: string;
  direction: string;
  entryTime?: string | null;
  rr?: number | null;
  screenshotM15?: string | null;
  screenshotM5?: string | null;
}

interface TradeNavigationLightboxProps {
  items: TradeScreenshotItem[];
  initialIndex: number;
  initialScreenshot: "m15" | "m5";
  open: boolean;
  onClose: () => void;
  onValidate?: (executionId: string, isValid: boolean, note: string) => void;
  onSupplementaryNote?: (executionId: string, note: string) => void;
  validationState?: Record<string, { isValid: boolean; note: string; supplementaryNote?: string }>;
  savingValidation?: string | null;
  oracleTrades?: OracleMatch[];
  isSuperAdmin?: boolean;
}

export const TradeNavigationLightbox = ({
  items,
  initialIndex,
  initialScreenshot,
  open,
  onClose,
  onValidate,
  onSupplementaryNote,
  validationState,
  savingValidation,
  oracleTrades,
  isSuperAdmin = false,
}: TradeNavigationLightboxProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [activeScreen, setActiveScreen] = useState<"m15" | "m5">(initialScreenshot);
  const [zoom, setZoom] = useState(1);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [showOracleComparison, setShowOracleComparison] = useState(false);
  const [oracleSignedUrls, setOracleSignedUrls] = useState<Record<string, string>>({});
  const [showRefusalDialog, setShowRefusalDialog] = useState(false);
  const [refusalNote, setRefusalNote] = useState("");
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationNote, setValidationNote] = useState("");
  const [skipValidationNote, setSkipValidationNote] = useState(false);
  const [showSupplementaryDialog, setShowSupplementaryDialog] = useState(false);
  const [supplementaryNote, setSupplementaryNote] = useState("");

  const currentItem = items[currentIndex];

  const resetZoom = useCallback(() => setZoom(1), []);

  const matchingOracle = oracleTrades?.find(o => o.tradeDate === currentItem?.tradeDate);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setActiveScreen(initialScreenshot);
      setZoom(1);
      setShowOracleComparison(false);
    }
  }, [open, initialIndex, initialScreenshot]);

  // Sign URL for current item
  useEffect(() => {
    if (!open || !currentItem) return;

    const path = activeScreen === "m15" ? currentItem.screenshotM15 : currentItem.screenshotM5;
    if (!path) return;

    const cacheKey = `${currentIndex}_${activeScreen}`;
    if (signedUrls[cacheKey]) return;

    if (path.includes("token=")) {
      setSignedUrls((prev) => ({ ...prev, [cacheKey]: path }));
      return;
    }

    const signUrl = async () => {
      setLoadingUrl(true);
      const pathToSign = extractStoragePath(path) || path;
      try {
        const { data } = await supabase.storage
          .from("trade-screenshots")
          .createSignedUrl(pathToSign, 3600);
        if (data?.signedUrl) {
          setSignedUrls((prev) => ({ ...prev, [cacheKey]: data.signedUrl }));
        }
      } catch (e) {
        console.error("Error signing URL:", e);
      } finally {
        setLoadingUrl(false);
      }
    };
    signUrl();
  }, [open, currentIndex, activeScreen, currentItem, signedUrls]);

  // Sign Oracle screenshot URLs
  useEffect(() => {
    if (!open || !showOracleComparison || !matchingOracle) return;

    const oraclePath = activeScreen === "m15" ? matchingOracle.screenshotM15 : matchingOracle.screenshotM5;
    if (!oraclePath) return;

    const cacheKey = `oracle_${matchingOracle.tradeNumber}_${activeScreen}`;
    if (oracleSignedUrls[cacheKey]) return;

    if (oraclePath.includes("token=")) {
      setOracleSignedUrls((prev) => ({ ...prev, [cacheKey]: oraclePath }));
      return;
    }

    const signUrl = async () => {
      const pathToSign = extractStoragePath(oraclePath) || oraclePath;
      try {
        const { data } = await supabase.storage
          .from("trade-screenshots")
          .createSignedUrl(pathToSign, 3600);
        if (data?.signedUrl) {
          setOracleSignedUrls((prev) => ({ ...prev, [cacheKey]: data.signedUrl }));
        }
      } catch (e) {
        console.error("Error signing Oracle URL:", e);
      }
    };
    signUrl();
  }, [open, showOracleComparison, matchingOracle, activeScreen, oracleSignedUrls]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") { e.preventDefault(); goToPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goToNext(); }
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 5));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25));
      if (e.key === "0") setZoom(1);
      if (e.key === "Tab") { e.preventDefault(); toggleScreen(); }
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, currentIndex, activeScreen, items.length]);

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setZoom(1);
      setShowOracleComparison(false);
    }
  };

  const goToNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((i) => i + 1);
      setZoom(1);
      setShowOracleComparison(false);
    }
  };

  const toggleScreen = () => {
    setActiveScreen(prev => prev === "m15" ? "m5" : "m15");
    setZoom(1);
  };

  if (!open || !currentItem) return null;

  const currentPath = activeScreen === "m15" ? currentItem.screenshotM15 : currentItem.screenshotM5;
  const cacheKey = `${currentIndex}_${activeScreen}`;
  const imageUrl = signedUrls[cacheKey];

  const currentValidation = currentItem.executionId && validationState
    ? validationState[currentItem.executionId]
    : null;

  const oracleCacheKey = matchingOracle ? `oracle_${matchingOracle.tradeNumber}_${activeScreen}` : "";
  const oracleImageUrl = oracleCacheKey ? oracleSignedUrls[oracleCacheKey] : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Trade metadata header */}
      <div
        className="flex-shrink-0 px-4 py-3 bg-card/90 border-b border-border flex items-center justify-between gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0 overflow-x-auto">
          <span className="text-lg font-mono font-bold text-foreground flex-shrink-0">
            #{currentItem.tradeNumber}
          </span>

          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-mono font-semibold flex-shrink-0",
              currentItem.direction === "Long"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            )}
          >
            {currentItem.direction === "Long" ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {currentItem.direction}
          </div>

          <span className="text-sm font-mono text-muted-foreground flex-shrink-0">
            {new Date(currentItem.tradeDate).toLocaleDateString("fr-FR", {
              day: "2-digit", month: "short", year: "numeric",
            })}
          </span>

          {currentItem.rr !== null && currentItem.rr !== undefined && (
            <span className={cn("text-lg font-mono font-bold flex-shrink-0", currentItem.rr >= 0 ? "text-emerald-400" : "text-red-400")}>
              {currentItem.rr >= 0 ? "+" : ""}{currentItem.rr.toFixed(1)}R
            </span>
          )}

          <div className="w-px h-5 bg-border flex-shrink-0" />

          {currentItem.entryTime && (
            <span className="text-sm font-mono text-muted-foreground flex-shrink-0">E: {currentItem.entryTime}</span>
          )}
          {currentItem.exitTime && (
            <span className="text-sm font-mono text-muted-foreground flex-shrink-0">S: {currentItem.exitTime}</span>
          )}

          {currentItem.setupType && (
            <span className="px-2 py-0.5 bg-primary/20 text-primary text-sm font-mono rounded flex-shrink-0">{currentItem.setupType}</span>
          )}
          {currentItem.directionStructure && (
            <span className="text-sm font-mono text-muted-foreground flex-shrink-0">{currentItem.directionStructure}</span>
          )}
          {currentItem.entryModel && (
            <span className="text-sm font-mono text-muted-foreground flex-shrink-0">{currentItem.entryModel}</span>
          )}
          {currentItem.entryTiming && (
            <span className="text-sm font-mono text-muted-foreground flex-shrink-0">{currentItem.entryTiming}</span>
          )}

          {currentItem.notes && (
            <>
              <div className="w-px h-5 bg-border flex-shrink-0" />
              <span className="text-sm font-mono text-muted-foreground truncate max-w-[300px]" title={currentItem.notes}>
                {currentItem.notes}
              </span>
            </>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            <button
              onClick={() => { setActiveScreen("m15"); setZoom(1); }}
              className={cn(
                "px-2.5 py-1 text-[11px] font-mono rounded transition-colors",
                activeScreen === "m15"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Contexte
            </button>
            <button
              onClick={() => { setActiveScreen("m5"); setZoom(1); }}
              className={cn(
                "px-2.5 py-1 text-[11px] font-mono rounded transition-colors",
                activeScreen === "m5"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Entrée
            </button>
          </div>

          {matchingOracle && (
            <button
              onClick={() => setShowOracleComparison(!showOracleComparison)}
              className={cn(
                "px-2.5 py-1.5 text-[11px] font-mono rounded-md border transition-colors flex items-center gap-1.5",
                showOracleComparison
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/80 border-border text-foreground hover:bg-card"
              )}
            >
              <GitCompare className="w-3.5 h-3.5" />
              Comparer Oracle
            </button>
          )}

          <button onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))} className="p-1.5 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-foreground/70 min-w-[2.5rem] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(z + 0.25, 5))} className="p-1.5 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={resetZoom} className="p-1.5 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation counter */}
      <div className="flex-shrink-0 text-center py-1.5 bg-black/50" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] font-mono text-muted-foreground">
          {currentIndex + 1} / {items.length}
        </span>
      </div>

      {/* Image area with navigation arrows */}
      <div className="flex-1 flex items-center justify-center relative min-h-0">
        <button
          onClick={(e) => { e.stopPropagation(); goToPrev(); }}
          disabled={currentIndex === 0}
          className={cn(
            "absolute left-3 z-[210] p-3 rounded-full bg-card/80 border border-border text-foreground transition-all",
            currentIndex === 0 ? "opacity-20 cursor-not-allowed" : "hover:bg-card hover:scale-110"
          )}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div
          className={cn("flex gap-4", showOracleComparison && matchingOracle ? "max-w-[90vw]" : "")}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={cn(
              "overflow-auto cursor-grab active:cursor-grabbing",
              showOracleComparison && matchingOracle
                ? "max-w-[42vw] max-h-[calc(100vh-180px)]"
                : "max-w-[85vw] max-h-[calc(100vh-180px)]"
            )}
            onWheel={(e) => {
              e.stopPropagation();
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              setZoom((z) => Math.min(Math.max(z + delta, 0.25), 5));
            }}
          >
            {showOracleComparison && (
              <div className="text-center mb-2">
                <span className="text-xs font-mono text-muted-foreground bg-card/80 px-2 py-1 rounded">
                  Membre — #{currentItem.tradeNumber}
                </span>
              </div>
            )}
            {loadingUrl && currentPath ? (
              <div className="flex items-center justify-center w-64 h-64">
                <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !currentPath ? (
              <div className="flex items-center justify-center w-64 h-64">
                <span className="text-sm text-muted-foreground font-mono">
                  Pas de screenshot {activeScreen === "m15" ? "Contexte" : "Entrée"}
                </span>
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt={`Trade #${currentItem.tradeNumber} ${activeScreen === "m15" ? "Contexte" : "Entrée"}`}
                className="transition-transform duration-150 ease-out select-none"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                draggable={false}
              />
            ) : (
              <div className="flex items-center justify-center w-64 h-64">
                <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {showOracleComparison && matchingOracle && (
            <div
              className="overflow-auto max-w-[42vw] max-h-[calc(100vh-180px)] cursor-grab active:cursor-grabbing border-l border-border/50 pl-4"
              onWheel={(e) => {
                e.stopPropagation();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setZoom((z) => Math.min(Math.max(z + delta, 0.25), 5));
              }}
            >
              <div className="text-center mb-2">
                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                  Oracle — #{matchingOracle.tradeNumber} · {matchingOracle.direction} · {matchingOracle.entryTime || "—"}
                  {matchingOracle.rr !== null && matchingOracle.rr !== undefined && (
                    <span className={cn("ml-2", matchingOracle.rr >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {matchingOracle.rr >= 0 ? "+" : ""}{matchingOracle.rr.toFixed(1)}R
                    </span>
                  )}
                </span>
              </div>
              {oracleImageUrl ? (
                <img
                  src={oracleImageUrl}
                  alt={`Oracle #${matchingOracle.tradeNumber} ${activeScreen === "m15" ? "Contexte" : "Entrée"}`}
                  className="transition-transform duration-150 ease-out select-none"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                  draggable={false}
                />
              ) : (
                <div className="flex items-center justify-center w-64 h-64">
                  <span className="text-sm text-muted-foreground font-mono">
                    Pas de screenshot Oracle
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); goToNext(); }}
          disabled={currentIndex === items.length - 1}
          className={cn(
            "absolute right-3 z-[210] p-3 rounded-full bg-card/80 border border-border text-foreground transition-all",
            currentIndex === items.length - 1 ? "opacity-20 cursor-not-allowed" : "hover:bg-card hover:scale-110"
          )}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Footer - Validation controls */}
      {onValidate && currentItem.executionId && (
        <div
          className="flex-shrink-0 px-4 py-3 bg-card/90 border-t border-border flex items-center justify-between gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setValidationNote("");
                setShowValidationDialog(true);
              }}
              disabled={savingValidation === currentItem.executionId}
            >
              {savingValidation === currentItem.executionId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Valider le trade
            </Button>

            {/* Supplementary note button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                setSupplementaryNote(currentValidation?.supplementaryNote || "");
                setShowSupplementaryDialog(true);
              }}
            >
              <MessageSquarePlus className="w-4 h-4" />
              Note complémentaire
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                setRefusalNote("");
                setShowRefusalDialog(true);
              }}
              disabled={savingValidation === currentItem.executionId}
            >
              <XCircle className="w-4 h-4" />
              Refuser le trade
            </Button>

            {/* Current status indicator */}
            {currentValidation && (
              <span className={cn(
                "text-[10px] font-mono px-2 py-0.5 rounded",
                currentValidation.isValid ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
              )}>
                {currentValidation.isValid ? "✓ Validé" : "✗ Refusé"}
                {currentValidation.note && ` — ${currentValidation.note}`}
              </span>
            )}
            {currentValidation?.supplementaryNote && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                📝 Note: {currentValidation.supplementaryNote}
              </span>
            )}
          </div>

          {matchingOracle && !showOracleComparison && (
            <button
              onClick={() => setShowOracleComparison(true)}
              className="text-xs font-mono text-primary hover:text-primary/80 flex items-center gap-1.5 flex-shrink-0"
            >
              <GitCompare className="w-3.5 h-3.5" />
              Trade Oracle trouvé (#{matchingOracle.tradeNumber})
            </button>
          )}
        </div>
      )}

      {/* Validation justification dialog */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()} className="z-[300]">
          <DialogHeader>
            <DialogTitle>Valider le trade #{currentItem?.tradeNumber}</DialogTitle>
            <DialogDescription>
              {isSuperAdmin && skipValidationNote
                ? "Validation sans justification (mode super admin)."
                : "Justifiez pourquoi ce trade est validé."}
            </DialogDescription>
          </DialogHeader>
          {(!isSuperAdmin || !skipValidationNote) && (
            <Textarea
              value={validationNote}
              onChange={(e) => setValidationNote(e.target.value)}
              placeholder="Justification de la validation..."
              className="min-h-[80px]"
            />
          )}
          {isSuperAdmin && (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="skip-validation-note"
                checked={skipValidationNote}
                onCheckedChange={(checked) => {
                  setSkipValidationNote(!!checked);
                  if (checked) setValidationNote("");
                }}
              />
              <Label htmlFor="skip-validation-note" className="text-xs text-muted-foreground cursor-pointer">
                Valider sans justification obligatoire
              </Label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidationDialog(false)}>Annuler</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!isSuperAdmin || !skipValidationNote ? !validationNote.trim() : false}
              onClick={() => {
                if (currentItem.executionId && onValidate) {
                  onValidate(currentItem.executionId, true, validationNote.trim());
                }
                setShowValidationDialog(false);
                setSkipValidationNote(false);
              }}
            >
              Confirmer la validation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refusal justification dialog */}
      <Dialog open={showRefusalDialog} onOpenChange={setShowRefusalDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()} className="z-[300]">
          <DialogHeader>
            <DialogTitle>Refuser le trade #{currentItem?.tradeNumber}</DialogTitle>
            <DialogDescription>
              Veuillez justifier la raison pour laquelle ce trade est incorrect.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={refusalNote}
            onChange={(e) => setRefusalNote(e.target.value)}
            placeholder="Raison du refus..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefusalDialog(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={!refusalNote.trim()}
              onClick={() => {
                if (currentItem.executionId && onValidate) {
                  onValidate(currentItem.executionId, false, refusalNote.trim());
                }
                setShowRefusalDialog(false);
              }}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplementary note dialog */}
      <Dialog open={showSupplementaryDialog} onOpenChange={setShowSupplementaryDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()} className="z-[300]">
          <DialogHeader>
            <DialogTitle>Note complémentaire — Trade #{currentItem?.tradeNumber}</DialogTitle>
            <DialogDescription>
              Ajoutez des observations ou remarques supplémentaires sur ce trade.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={supplementaryNote}
            onChange={(e) => setSupplementaryNote(e.target.value)}
            placeholder="Note complémentaire..."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplementaryDialog(false)}>Annuler</Button>
            <Button
              onClick={() => {
                if (currentItem.executionId && onSupplementaryNote) {
                  onSupplementaryNote(currentItem.executionId, supplementaryNote.trim());
                }
                setShowSupplementaryDialog(false);
              }}
            >
              Enregistrer la note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
