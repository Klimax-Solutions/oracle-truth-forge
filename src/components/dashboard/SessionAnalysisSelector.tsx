// ============================================
// SessionAnalysisSelector — sélecteur de session pour Data Analysis
// ============================================
// 2 dropdowns (Backtesting bleu + Live Trading orange) séparés par "OU".
// Sélection exclusive : choisir l'un désélectionne l'autre.
// Info banner sous le sélecteur rappelant la session analysée.
// ============================================

import { ChevronDown, FlaskConical, Radio } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SessionType = "backtesting" | "live";

export interface AnalysisSession {
  id: string;
  name: string;
  asset: string | null;
  type: SessionType;
}

interface SessionAnalysisSelectorProps {
  sessions: AnalysisSession[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

const BLUE = "#3B82F6";
const ORANGE = "#F97316";

const Dropdown = ({
  type,
  color,
  label,
  Icon,
  sessions,
  selectedId,
  onChange,
  otherTypeSelected,
}: {
  type: SessionType;
  color: string;
  label: string;
  Icon: React.ElementType;
  sessions: AnalysisSession[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  otherTypeSelected: boolean;
}) => {
  const current = sessions.find((s) => s.id === selectedId && s.type === type);
  const isActive = !!current;
  const sessionsOfType = sessions.filter((s) => s.type === type);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "group flex items-stretch gap-0 rounded-lg border-2 transition-all overflow-hidden min-w-[240px]",
            "hover:shadow-lg",
            isActive ? "shadow-md" : "",
            otherTypeSelected && !isActive && "opacity-40 hover:opacity-70",
          )}
          style={{
            borderColor: isActive ? color : `${color}40`,
            backgroundColor: isActive ? `${color}10` : "transparent",
            boxShadow: isActive ? `0 0 0 1px ${color}30, 0 4px 16px ${color}20` : undefined,
          }}
        >
          {/* Left color strip with icon */}
          <div
            className="flex items-center justify-center px-3 py-2.5 transition-colors"
            style={{
              backgroundColor: isActive ? color : `${color}20`,
              color: isActive ? "#fff" : color,
            }}
          >
            <Icon className="w-4 h-4" strokeWidth={2.5} />
          </div>

          {/* Middle content */}
          <div className="flex-1 flex flex-col items-start justify-center px-3 py-1.5 text-left">
            <span
              className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] leading-none"
              style={{ color }}
            >
              {label}
            </span>
            <span className={cn(
              "text-sm font-semibold truncate max-w-[160px] mt-0.5 leading-tight",
              isActive ? "text-foreground" : "text-muted-foreground",
            )}>
              {current ? current.name : "— Aucune session"}
            </span>
          </div>

          {/* Chevron */}
          <div className="flex items-center pr-3">
            <ChevronDown
              className="w-4 h-4 transition-transform group-hover:translate-y-0.5"
              style={{ color: isActive ? color : "hsl(var(--muted-foreground))" }}
            />
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 bg-popover border border-border">
        <div
          className="px-3 py-2 border-b border-border flex items-center gap-2"
          style={{ backgroundColor: `${color}08` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold" style={{ color }}>
            {label}
          </span>
        </div>
        <DropdownMenuRadioGroup
          value={isActive ? (selectedId as string) : "__none__"}
          onValueChange={(v) => {
            if (v === "__none__") onChange(null);
            else onChange(v);
          }}
        >
          <DropdownMenuRadioItem value="__none__" className="cursor-pointer text-muted-foreground italic">
            — Aucune session
          </DropdownMenuRadioItem>
          {sessionsOfType.length === 0 && (
            <div className="px-2 py-2 text-[10px] text-muted-foreground italic">
              Aucune session {type === "backtesting" ? "de backtesting" : "live"} créée
            </div>
          )}
          {sessionsOfType.map((s) => (
            <DropdownMenuRadioItem
              key={s.id}
              value={s.id}
              className="cursor-pointer flex flex-col items-start gap-0.5 py-2"
            >
              <span className="text-sm text-foreground font-medium">{s.name}</span>
              {s.asset && (
                <span className="text-[9px] text-muted-foreground font-mono uppercase">
                  {s.asset}
                </span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const SessionAnalysisSelector = ({
  sessions,
  selectedId,
  onChange,
}: SessionAnalysisSelectorProps) => {
  const selected = sessions.find((s) => s.id === selectedId) || null;
  const backtestingSelected = selected?.type === "backtesting";
  const liveSelected = selected?.type === "live";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Dropdown
        type="backtesting"
        color={BLUE}
        label="Backtesting"
        Icon={FlaskConical}
        sessions={sessions}
        selectedId={selectedId}
        onChange={onChange}
        otherTypeSelected={liveSelected}
      />
      <div className="flex items-center justify-center">
        <span className="text-[11px] font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.25em] px-1">
          OU
        </span>
      </div>
      <Dropdown
        type="live"
        color={ORANGE}
        label="Live Trading"
        Icon={Radio}
        sessions={sessions}
        selectedId={selectedId}
        onChange={onChange}
        otherTypeSelected={backtestingSelected}
      />
    </div>
  );
};

export default SessionAnalysisSelector;
