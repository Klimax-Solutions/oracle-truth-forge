import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Check, X, Image, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Trade {
  id: string;
  trade_number: number;
  trade_date: string;
  direction: string;
  rr: number | null;
  screenshot_m15_m5: string | null;
  screenshot_m1: string | null;
}

interface ScreenshotUploaderProps {
  trades: Trade[];
  onUpdate: () => void;
}

export const ScreenshotUploader = ({ trades, onUpdate }: ScreenshotUploaderProps) => {
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [uploading, setUploading] = useState<{ m15_m5: boolean; m1: boolean }>({
    m15_m5: false,
    m1: false,
  });

  const uploadFile = useCallback(
    async (file: File, type: "m15_m5" | "m1") => {
      if (!selectedTrade) return;

      setUploading((prev) => ({ ...prev, [type]: true }));

      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `trade_${selectedTrade.trade_number}_${type}.${fileExt}`;
        const filePath = `${selectedTrade.id}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("trade-screenshots")
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("trade-screenshots")
          .getPublicUrl(filePath);

        // Update trade record
        const updateColumn = type === "m15_m5" ? "screenshot_m15_m5" : "screenshot_m1";
        const { error: updateError } = await supabase
          .from("trades")
          .update({ [updateColumn]: urlData.publicUrl })
          .eq("id", selectedTrade.id);

        if (updateError) throw updateError;

        toast({
          title: "Screenshot uploadé",
          description: `${type === "m15_m5" ? "M15/M5" : "M1"} ajouté au trade #${selectedTrade.trade_number}`,
        });

        // Update local state
        setSelectedTrade((prev) =>
          prev ? { ...prev, [updateColumn]: urlData.publicUrl } : null
        );
        onUpdate();
      } catch (error: any) {
        toast({
          title: "Erreur d'upload",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setUploading((prev) => ({ ...prev, [type]: false }));
      }
    },
    [selectedTrade, onUpdate]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, type: "m15_m5" | "m1") => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        uploadFile(file, type);
      }
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, type: "m15_m5" | "m1") => {
      const file = e.target.files?.[0];
      if (file) {
        uploadFile(file, type);
      }
    },
    [uploadFile]
  );

  const getTradeStatus = (trade: Trade) => {
    const hasM15 = !!trade.screenshot_m15_m5;
    const hasM1 = !!trade.screenshot_m1;
    if (hasM15 && hasM1) return "complete";
    if (hasM15 || hasM1) return "partial";
    return "empty";
  };

  return (
    <div className="h-full flex gap-4 p-6">
      {/* Trade list */}
      <Card className="w-80 bg-neutral-950 border-neutral-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-widest text-neutral-400">
            Trades ({trades.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-1 p-3">
              {trades.map((trade) => {
                const status = getTradeStatus(trade);
                return (
                  <button
                    key={trade.id}
                    onClick={() => setSelectedTrade(trade)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors",
                      selectedTrade?.id === trade.id
                        ? "bg-neutral-800 text-white"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs">#{trade.trade_number}</span>
                      <span className="text-xs text-neutral-500">{trade.trade_date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {status === "complete" && (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      {status === "partial" && (
                        <div className="w-3.5 h-3.5 rounded-full bg-amber-500/20 border border-amber-500/50" />
                      )}
                      {status === "empty" && (
                        <X className="w-3.5 h-3.5 text-neutral-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card className="flex-1 bg-neutral-950 border-neutral-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-widest text-neutral-400">
            {selectedTrade
              ? `Trade #${selectedTrade.trade_number} - ${selectedTrade.trade_date}`
              : "Sélectionner un trade"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedTrade ? (
            <div className="grid grid-cols-2 gap-6">
              {/* M15/M5 Upload */}
              <DropZone
                label="M15/M5 Macro Context"
                imageUrl={selectedTrade.screenshot_m15_m5}
                uploading={uploading.m15_m5}
                onDrop={(e) => handleDrop(e, "m15_m5")}
                onFileSelect={(e) => handleFileSelect(e, "m15_m5")}
                id="m15_m5"
              />

              {/* M1 Upload */}
              <DropZone
                label="M1 Entry"
                imageUrl={selectedTrade.screenshot_m1}
                uploading={uploading.m1}
                onDrop={(e) => handleDrop(e, "m1")}
                onFileSelect={(e) => handleFileSelect(e, "m1")}
                id="m1"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-neutral-600">
              <Image className="w-12 h-12 mb-4" />
              <p className="text-sm">Sélectionne un trade pour uploader les screenshots</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface DropZoneProps {
  label: string;
  imageUrl: string | null;
  uploading: boolean;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  id: string;
}

const DropZone = ({
  label,
  imageUrl,
  uploading,
  onDrop,
  onFileSelect,
  id,
}: DropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-500">
        {label}
      </h3>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          setIsDragging(false);
          onDrop(e);
        }}
        className={cn(
          "relative aspect-video rounded-md border-2 border-dashed transition-colors overflow-hidden",
          isDragging
            ? "border-emerald-500 bg-emerald-500/10"
            : imageUrl
            ? "border-neutral-700 bg-neutral-900"
            : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
        )}
      >
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        ) : imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={label}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <label
                htmlFor={`file-${id}`}
                className="cursor-pointer px-4 py-2 bg-white/10 rounded-md text-white text-sm hover:bg-white/20 transition-colors"
              >
                Remplacer
              </label>
            </div>
          </>
        ) : (
          <label
            htmlFor={`file-${id}`}
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer text-neutral-500 hover:text-neutral-400 transition-colors"
          >
            <Upload className="w-8 h-8 mb-2" />
            <span className="text-xs">Glisser-déposer ou cliquer</span>
          </label>
        )}
        <input
          id={`file-${id}`}
          type="file"
          accept="image/*"
          onChange={onFileSelect}
          className="hidden"
        />
      </div>
      {imageUrl && (
        <div className="flex items-center gap-2 text-xs text-emerald-500">
          <Check className="w-3.5 h-3.5" />
          <span>Uploadé</span>
        </div>
      )}
    </div>
  );
};
