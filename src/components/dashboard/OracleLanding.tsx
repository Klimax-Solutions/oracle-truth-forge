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
        <div className="max-w-4xl w-full">
          {/* Title */}
          <div className="mb-16">
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-neutral-600 mb-4">
              Base de données NAS100
            </p>
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-white mb-4">
              ORACLE<span className="text-neutral-600">_01</span>
            </h1>
            <p className="text-lg text-neutral-500 max-w-xl">
              Méthodologie de trading systématique. Données vérifiées et documentées.
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-6 mb-12">
            <div className="border border-neutral-800 p-6 bg-neutral-950 group hover:border-neutral-600 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 border border-neutral-700 flex items-center justify-center">
                  <BarChart2 className="w-5 h-5 text-neutral-400" />
                </div>
              </div>
              <p className="text-4xl font-bold text-white mb-1">{totalTrades}</p>
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">
                Trades documentés
              </p>
            </div>

            <div className="border border-emerald-500/30 p-6 bg-emerald-500/5 group hover:bg-emerald-500/10 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 border border-emerald-500/50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <p className="text-4xl font-bold text-emerald-400 mb-1">+{totalRR.toFixed(0)}</p>
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">
                RR Total
              </p>
            </div>

            <div className="border border-neutral-800 p-6 bg-neutral-950 group hover:border-neutral-600 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 border border-neutral-700 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-neutral-400" />
                </div>
              </div>
              <p className="text-4xl font-bold text-white mb-1">{avgRR}</p>
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">
                RR Moyen
              </p>
            </div>
          </div>

          {/* Main CTA */}
          <button
            onClick={onEnterDatabase}
            className="w-full group border-2 border-white bg-white text-black hover:bg-transparent hover:text-white p-8 transition-all duration-300 flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-2xl font-bold mb-2">Accéder aux trades</p>
              <p className="text-sm opacity-70 group-hover:opacity-100 transition-opacity">
                Consulter la base de données complète des {totalTrades} trades
              </p>
            </div>
            <ArrowRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
          </button>

          {/* Future setups */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {["02", "03", "04"].map((num) => (
              <div 
                key={num}
                className="border border-dashed border-neutral-800 p-4 text-center opacity-40 hover:opacity-60 transition-opacity cursor-not-allowed"
              >
                <p className="text-xs font-mono text-neutral-600 uppercase tracking-wider">
                  Setup {num}
                </p>
                <p className="text-[10px] text-neutral-700 mt-1">À venir</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-neutral-800 px-8 py-4 flex items-center justify-between">
        <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">
          100% Win Rate • Méthodologie Oracle™
        </p>
        <p className="text-xs text-neutral-700 font-mono">
          v1.0
        </p>
      </div>
    </div>
  );
};
