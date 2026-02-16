import { useState, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { extractStoragePath } from "@/hooks/useSignedUrl";

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
}

interface TradeNavigationLightboxProps {
  items: TradeScreenshotItem[];
  initialIndex: number;
  initialScreenshot: "m15" | "m5";
  open: boolean;
  onClose: () => void;
}

export const TradeNavigationLightbox = ({
  items,
  initialIndex,
  initialScreenshot,
  open,
  onClose,
}: TradeNavigationLightboxProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [activeScreen, setActiveScreen] = useState<"m15" | "m5">(initialScreenshot);
  const [zoom, setZoom] = useState(1);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrl, setLoadingUrl] = useState(false);

  const currentItem = items[currentIndex];

  const resetZoom = useCallback(() => setZoom(1), []);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setActiveScreen(initialScreenshot);
      setZoom(1);
    }
  }, [open, initialIndex, initialScreenshot]);

  // Sign URL for current item
  useEffect(() => {
    if (!open || !currentItem) return;

    const path = activeScreen === "m15" ? currentItem.screenshotM15 : currentItem.screenshotM5;
    if (!path) return;

    const cacheKey = `${currentIndex}_${activeScreen}`;
    if (signedUrls[cacheKey]) return;

    // Check if already a signed URL
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

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 5));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25));
      if (e.key === "0") setZoom(1);
      if (e.key === "Tab") {
        e.preventDefault();
        toggleScreen();
      }
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
    }
  };

  const goToNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((i) => i + 1);
      setZoom(1);
    }
  };

  const toggleScreen = () => {
    const other = activeScreen === "m15" ? "m5" : "m15";
    const path = activeScreen === "m15" ? currentItem?.screenshotM5 : currentItem?.screenshotM15;
    if (path) {
      setActiveScreen(other);
      setZoom(1);
    }
  };

  if (!open || !currentItem) return null;

  const currentPath = activeScreen === "m15" ? currentItem.screenshotM15 : currentItem.screenshotM5;
  const cacheKey = `${currentIndex}_${activeScreen}`;
  const imageUrl = signedUrls[cacheKey];
  const hasM15 = !!currentItem.screenshotM15;
  const hasM5 = !!currentItem.screenshotM5;

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
          {/* Trade number */}
          <span className="text-base font-mono font-bold text-foreground flex-shrink-0">
            #{currentItem.tradeNumber}
          </span>

          {/* Direction */}
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-mono font-semibold flex-shrink-0",
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

          {/* Date */}
          <span className="text-sm font-mono text-muted-foreground flex-shrink-0">
            {new Date(currentItem.tradeDate).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>

          {/* RR */}
          {currentItem.rr !== null && currentItem.rr !== undefined && (
            <span
              className={cn(
                "text-base font-mono font-bold flex-shrink-0",
                currentItem.rr >= 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {currentItem.rr >= 0 ? "+" : ""}
              {currentItem.rr.toFixed(1)}R
            </span>
          )}

          {/* Separator */}
          <div className="w-px h-5 bg-border flex-shrink-0" />

          {/* Entry/exit times */}
          {currentItem.entryTime && (
            <span className="text-sm font-mono text-muted-foreground flex-shrink-0">
              E: {currentItem.entryTime}
            </span>
          )}
          {currentItem.exitTime && (
            <span className="text-sm font-mono text-muted-foreground flex-shrink-0">
              S: {currentItem.exitTime}
            </span>
          )}

          {/* Setup */}
          {currentItem.setupType && (
            <span className="px-2 py-0.5 bg-primary/20 text-primary text-sm font-mono rounded flex-shrink-0">
              {currentItem.setupType}
            </span>
          )}

          {/* Structure */}
          {currentItem.directionStructure && (
            <span className="text-sm font-mono text-muted-foreground flex-shrink-0">
              {currentItem.directionStructure}
            </span>
          )}

          {/* Model */}
          {currentItem.entryModel && (
            <span className="text-sm font-mono text-muted-foreground flex-shrink-0">
              {currentItem.entryModel}
            </span>
          )}

          {/* Timing */}
          {currentItem.entryTiming && (
            <span className="text-sm font-mono text-muted-foreground flex-shrink-0">
              {currentItem.entryTiming}
            </span>
          )}

          {/* Notes */}
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
          {/* M15/M5 toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            <button
              onClick={() => { if (hasM15) { setActiveScreen("m15"); setZoom(1); } }}
              className={cn(
                "px-2 py-1 text-[10px] font-mono rounded transition-colors",
                activeScreen === "m15"
                  ? "bg-primary text-primary-foreground"
                  : hasM15
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-muted-foreground/30 cursor-not-allowed"
              )}
              disabled={!hasM15}
            >
              M15
            </button>
            <button
              onClick={() => { if (hasM5) { setActiveScreen("m5"); setZoom(1); } }}
              className={cn(
                "px-2 py-1 text-[10px] font-mono rounded transition-colors",
                activeScreen === "m5"
                  ? "bg-primary text-primary-foreground"
                  : hasM5
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-muted-foreground/30 cursor-not-allowed"
              )}
              disabled={!hasM5}
            >
              M5
            </button>
          </div>

          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
            className="p-1.5 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-foreground/70 min-w-[2.5rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.25, 5))}
            className="p-1.5 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetZoom}
            className="p-1.5 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation counter */}
      <div
        className="flex-shrink-0 text-center py-1.5 bg-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] font-mono text-muted-foreground">
          {currentIndex + 1} / {items.length}
        </span>
      </div>

      {/* Image area with navigation arrows */}
      <div className="flex-1 flex items-center justify-center relative min-h-0">
        {/* Left arrow */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          disabled={currentIndex === 0}
          className={cn(
            "absolute left-3 z-[210] p-3 rounded-full bg-card/80 border border-border text-foreground transition-all",
            currentIndex === 0
              ? "opacity-20 cursor-not-allowed"
              : "hover:bg-card hover:scale-110"
          )}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Image */}
        <div
          className="overflow-auto max-w-[85vw] max-h-[calc(100vh-120px)] cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => {
            e.stopPropagation();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom((z) => Math.min(Math.max(z + delta, 0.25), 5));
          }}
        >
          {loadingUrl || !imageUrl ? (
            <div className="flex items-center justify-center w-64 h-64">
              {currentPath ? (
                <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-sm text-muted-foreground font-mono">
                  Pas de screenshot {activeScreen.toUpperCase()}
                </span>
              )}
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={`Trade #${currentItem.tradeNumber} ${activeScreen.toUpperCase()}`}
              className="transition-transform duration-150 ease-out select-none"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
              draggable={false}
            />
          )}
        </div>

        {/* Right arrow */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          disabled={currentIndex === items.length - 1}
          className={cn(
            "absolute right-3 z-[210] p-3 rounded-full bg-card/80 border border-border text-foreground transition-all",
            currentIndex === items.length - 1
              ? "opacity-20 cursor-not-allowed"
              : "hover:bg-card hover:scale-110"
          )}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
