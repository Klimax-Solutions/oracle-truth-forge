import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Clock, Target } from "lucide-react";

interface TradeCardProps {
  id: number;
  pair?: string;
  direction: "long" | "short";
  entryTime?: string;
  result: "win" | "loss";
  rr: number;
  imageUrl?: string;
  className?: string;
}

export const TradeCard = ({
  id,
  pair = "EUR/USD",
  direction,
  entryTime = "09:30",
  result,
  rr,
  imageUrl,
  className
}: TradeCardProps) => {
  const isWin = result === "win";
  const isLong = direction === "long";

  return (
    <div className={cn(
      "glass-card rounded-xl overflow-hidden group cursor-pointer",
      "hover:border-primary/40 transition-all duration-300",
      "hover:shadow-[0_0_40px_hsl(38_92%_50%_/_0.15)]",
      "hover:scale-[1.02]",
      className
    )}>
      {/* Image placeholder */}
      <div className="aspect-video bg-gradient-to-br from-secondary to-muted relative overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={`Trade ${id}`} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 trading-grid opacity-50" />
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={cn(
            "px-2.5 py-1 rounded-md text-xs font-bold backdrop-blur-md",
            isLong 
              ? "bg-success/20 text-success border border-success/30" 
              : "bg-destructive/20 text-destructive border border-destructive/30"
          )}>
            {isLong ? "LONG" : "SHORT"}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-card/80 backdrop-blur-md text-foreground">
            #{id.toString().padStart(3, '0')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-lg">{pair}</span>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold",
            isWin 
              ? "bg-success/10 text-success" 
              : "bg-destructive/10 text-destructive"
          )}>
            {isWin ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{isWin ? "+" : "-"}{rr.toFixed(1)}R</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{entryTime}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            <span>Setup #1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
