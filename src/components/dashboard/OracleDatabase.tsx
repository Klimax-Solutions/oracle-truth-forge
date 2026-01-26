import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Trade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  direction_structure: string;
  entry_time: string;
  exit_time: string;
  trade_duration: string;
  rr: number;
  stop_loss_size: string;
  setup_type: string;
  entry_timing: string;
  entry_model: string;
  target_timing: string;
  speculation_hl_valid: boolean;
  target_hl_valid: boolean;
  news_day: boolean;
  news_label: string;
}

interface OracleDatabaseProps {
  trades: Trade[];
}

export const OracleDatabase = ({ trades }: OracleDatabaseProps) => {
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const totalTrades = trades.length;
  const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);
  const longTrades = trades.filter((t) => t.direction === "Long").length;
  const shortTrades = trades.filter((t) => t.direction === "Short").length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with stats */}
      <div className="p-6 border-b border-neutral-800">
        <div className="flex items-center justify-center gap-8 md:gap-12">
          <div className="text-center">
            <p className="text-2xl md:text-3xl font-bold text-white">{totalTrades}</p>
            <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">Trades</p>
          </div>
          <div className="w-px h-8 bg-neutral-800" />
          <div className="text-center">
            <p className="text-2xl md:text-3xl font-bold text-white">+{totalRR.toFixed(0)}</p>
            <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">RR Total</p>
          </div>
          <div className="w-px h-8 bg-neutral-800" />
          <div className="text-center flex items-center gap-4">
            <div>
              <p className="text-2xl md:text-3xl font-bold text-white">{longTrades}</p>
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">Long</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold text-white">{shortTrades}</p>
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">Short</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trades list */}
      <div className="flex-1 overflow-auto p-4">
        {trades.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-500 text-lg mb-4">Aucun trade dans la base de données</p>
            <p className="text-neutral-600 text-sm">Les données seront importées prochainement.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {trades.map((trade) => (
              <div
                key={trade.id}
                onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                className={cn(
                  "border transition-all cursor-pointer",
                  selectedTrade?.id === trade.id
                    ? "border-white bg-neutral-900"
                    : "border-neutral-800 hover:border-neutral-700 bg-neutral-950"
                )}
              >
                {/* Main row */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="text-2xl font-bold text-neutral-700 w-12">
                      {String(trade.trade_number).padStart(3, "0")}
                    </span>

                    <div
                      className={cn(
                        "flex items-center gap-2 w-20",
                        trade.direction === "Long" ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {trade.direction === "Long" ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="text-sm font-mono uppercase">{trade.direction}</span>
                    </div>

                    <div className="hidden md:block">
                      <p className="text-sm text-white">{formatDate(trade.trade_date)}</p>
                      <p className="text-xs text-neutral-600">{trade.day_of_week}</p>
                    </div>

                    <div className="hidden lg:block">
                      <p className="text-xs text-neutral-500 font-mono">{trade.setup_type || "—"}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-white">+{trade.rr?.toFixed(2) || "0"}</p>
                    <p className="text-xs text-neutral-600 font-mono uppercase">RR</p>
                  </div>
                </div>

                {/* Expanded details */}
                {selectedTrade?.id === trade.id && (
                  <div className="px-6 py-4 border-t border-neutral-800 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Entrée</p>
                      <p className="text-sm text-white">{trade.entry_time || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Sortie</p>
                      <p className="text-sm text-white">{trade.exit_time || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Durée</p>
                      <p className="text-sm text-white">{trade.trade_duration || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Stop Loss</p>
                      <p className="text-sm text-white">{trade.stop_loss_size || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Structure</p>
                      <p className="text-sm text-white">{trade.direction_structure || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Entry Timing</p>
                      <p className="text-sm text-white">{trade.entry_timing || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Modèle</p>
                      <p className="text-sm text-white">{trade.entry_model || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-600 font-mono uppercase mb-1">News</p>
                      <p className="text-sm text-white">
                        {trade.news_day ? trade.news_label || "Oui" : "Non"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
