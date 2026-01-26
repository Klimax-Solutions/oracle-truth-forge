import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

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
      "group border border-neutral-800 bg-neutral-950 overflow-hidden cursor-pointer",
      "hover:border-neutral-600 transition-all duration-300",
      "hover:bg-neutral-900",
      className
    )}>
      {/* Image placeholder */}
      <div className="aspect-video bg-neutral-900 relative overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={`Trade ${id}`} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid-pattern opacity-50" />
        )}
        
        {/* Trade number */}
        <div className="absolute top-3 right-3">
          <span className="text-xs font-mono text-neutral-500">
            #{id.toString().padStart(3, '0')}
          </span>
        </div>

        {/* Direction badge */}
        <div className="absolute top-3 left-3">
          <span className={cn(
            "px-2 py-1 text-xs font-mono uppercase tracking-wider",
            isLong 
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
              : "bg-red-500/10 text-red-500 border border-red-500/20"
          )}>
            {isLong ? "Long" : "Short"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white">{pair}</span>
          <div className={cn(
            "flex items-center gap-1.5 text-sm font-mono",
            isWin ? "text-emerald-500" : "text-red-500"
          )}>
            {isWin ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{isWin ? "+" : "-"}{rr.toFixed(1)}R</span>
          </div>
        </div>

        <div className="text-xs text-neutral-500 font-mono">
          {entryTime}
        </div>
      </div>
    </div>
  );
};
