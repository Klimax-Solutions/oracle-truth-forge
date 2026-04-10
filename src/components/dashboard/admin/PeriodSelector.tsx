import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PeriodMode = 'day' | 'week' | 'month' | 'all';

interface PeriodSelectorProps {
  mode: PeriodMode;
  setMode: (mode: PeriodMode) => void;
  periodLabel: string;
  periodLabelShort?: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  isAtToday: boolean;
  allowFuture?: boolean;
}

export default function PeriodSelector({
  mode,
  setMode,
  periodLabel,
  periodLabelShort,
  onPrevious,
  onNext,
  onToday,
  isAtToday,
  allowFuture = false,
}: PeriodSelectorProps) {
  const disableNext = isAtToday && !allowFuture;
  const mobileLabel = periodLabelShort || periodLabel;

  return (
    <div className="flex items-center justify-between w-full md:w-auto md:justify-end gap-2 md:gap-3">
      {/* Period Toggle */}
      <div className="flex items-center bg-white/[0.04] rounded-lg p-1 border border-white/[0.08]">
        {(['day', 'week', 'month', 'all'] as PeriodMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`relative px-2 md:px-2.5 py-1.5 text-[10px] md:text-xs font-display rounded-md transition-all ${
              mode === m ? 'text-white' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {mode === m && (
              <div className="absolute inset-0 bg-primary/20 border border-primary/30 rounded-md" />
            )}
            <span className="relative">
              {m === 'day' ? 'Jour' : m === 'week' ? 'Sem.' : m === 'month' ? 'Mois' : 'Total'}
            </span>
          </button>
        ))}
      </div>

      {/* Navigation (hidden in 'all' mode) */}
      {mode !== 'all' ? (
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-1 border border-white/[0.08]">
          <button
            onClick={onPrevious}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="w-[90px] md:w-[110px] px-1 text-center">
            <span className="text-white font-display text-[11px] md:text-sm capitalize whitespace-nowrap md:hidden">
              {mobileLabel}
            </span>
            <span className="text-white font-display text-sm capitalize whitespace-nowrap hidden md:inline">
              {periodLabel}
            </span>
          </div>
          <button
            onClick={onNext}
            disabled={disableNext}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
              disableNext
                ? 'text-white/10 cursor-not-allowed'
                : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isAtToday && (
            <button
              onClick={onToday}
              className="px-2 py-1 rounded-md bg-primary/20 text-primary text-[10px] md:text-xs font-display hover:bg-primary/30 transition-all ml-0.5"
            >
              Auj.
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-3 py-2 border border-white/[0.08]">
          <span className="text-white font-display text-[11px] md:text-sm whitespace-nowrap">
            {periodLabel}
          </span>
        </div>
      )}
    </div>
  );
}
