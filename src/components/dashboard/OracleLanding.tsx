import { ArrowRight, Zap, TrendingUp, BarChart2 } from "lucide-react";

interface OracleLandingProps {
  onEnterDatabase: () => void;
  totalTrades: number;
  totalRR: number;
}

export const OracleLanding = ({ onEnterDatabase, totalTrades, totalRR }: OracleLandingProps) => {
  const avgRR = totalTrades > 0 ? (totalRR / totalTrades).toFixed(2) : "0";
  
  return (
    <div className="h-full flex flex-col">
      {/* Hero section */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-3xl w-full">
          {/* Title */}
          <div className="mb-12">
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-neutral-600 mb-3">
              Base de données NAS100
            </p>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-white mb-3">
              ORACLE<span className="text-neutral-600">_01</span>
            </h1>
            <p className="text-base text-neutral-500 max-w-lg">
              Méthodologie de trading systématique. Données vérifiées et documentées.
            </p>
          </div>

          {/* Stats grid - more compact */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="border border-neutral-800 p-4 rounded-sm bg-neutral-950/50 group hover:border-neutral-600 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-neutral-500" />
                <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider">
                  Trades
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{totalTrades}</p>
            </div>

            <div className="border border-emerald-500/30 p-4 rounded-sm bg-emerald-500/5 group hover:bg-emerald-500/10 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider">
                  RR Total
                </span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">+{totalRR.toFixed(0)}</p>
            </div>

            <div className="border border-neutral-800 p-4 rounded-sm bg-neutral-950/50 group hover:border-neutral-600 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-neutral-500" />
                <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider">
                  RR Moyen
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{avgRR}</p>
            </div>
          </div>

          {/* Main CTA - smoother design */}
          <button
            onClick={onEnterDatabase}
            className="w-full group border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-500 p-5 rounded-sm transition-all duration-200 flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-lg font-medium text-white mb-1">Accéder à Oracle</p>
              <p className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors">
                Consulter les {totalTrades} trades documentés
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </button>

          {/* Future setups */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {["02", "03", "04"].map((num) => (
              <div 
                key={num}
                className="border border-dashed border-neutral-800 p-3 rounded-sm text-center opacity-40 hover:opacity-60 transition-opacity cursor-not-allowed"
              >
                <p className="text-xs font-mono text-neutral-600 uppercase tracking-wider">
                  Setup {num}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-neutral-800 px-6 py-3 flex items-center justify-between">
        <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider">
          100% Win Rate • Méthodologie Oracle™
        </p>
        <p className="text-[10px] text-neutral-700 font-mono">
          v1.0
        </p>
      </div>
    </div>
  );
};
