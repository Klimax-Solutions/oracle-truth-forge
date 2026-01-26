import { Database, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OracleLandingProps {
  onEnterDatabase: () => void;
  totalTrades: number;
  totalRR: number;
}

export const OracleLanding = ({ onEnterDatabase, totalTrades, totalRR }: OracleLandingProps) => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 border border-neutral-700 mb-6">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Oracle<sup className="text-lg font-normal align-super ml-1">™</sup>
            <span className="text-neutral-500 ml-2">01</span>
          </h1>
          <p className="text-neutral-500 text-lg max-w-md mx-auto">
            Base de données NAS100 — Méthodologie de trading systématique
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-12 mb-12">
          <div className="text-center">
            <p className="text-4xl font-bold text-white">{totalTrades}</p>
            <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider mt-1">
              Trades documentés
            </p>
          </div>
          <div className="w-px h-12 bg-neutral-800" />
          <div className="text-center">
            <p className="text-4xl font-bold text-emerald-500">+{totalRR.toFixed(0)}</p>
            <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider mt-1">
              RR Total
            </p>
          </div>
        </div>

        {/* Main CTA */}
        <div className="space-y-4">
          <button
            onClick={onEnterDatabase}
            className="w-full group border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-600 p-6 transition-all flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-lg font-semibold text-white mb-1">Accéder aux trades</p>
              <p className="text-sm text-neutral-500">Consulter la base de données complète</p>
            </div>
            <ArrowRight className="w-5 h-5 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </button>

          {/* Future setups placeholder */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-neutral-800 border-dashed p-6 flex flex-col items-center justify-center text-center opacity-50">
              <Plus className="w-6 h-6 text-neutral-600 mb-2" />
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">
                Setup 02
              </p>
              <p className="text-xs text-neutral-700 mt-1">À venir</p>
            </div>
            <div className="border border-neutral-800 border-dashed p-6 flex flex-col items-center justify-center text-center opacity-50">
              <Plus className="w-6 h-6 text-neutral-600 mb-2" />
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">
                Setup 03
              </p>
              <p className="text-xs text-neutral-700 mt-1">À venir</p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-12 p-4 border border-neutral-800 bg-neutral-950">
          <p className="text-xs text-neutral-500 text-center font-mono">
            Données vérifiées et documentées • 100% Win Rate • Méthodologie Oracle™
          </p>
        </div>
      </div>
    </div>
  );
};
