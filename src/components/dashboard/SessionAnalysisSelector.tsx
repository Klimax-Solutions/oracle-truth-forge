// ============================================
// SessionAnalysisSelector — sélecteur de session pour Data Analysis
// ============================================
// 2 dropdowns (Backtesting bleu + Live Trading orange) séparés par "OU".
// Sélection exclusive : choisir l'un désélectionne l'autre.
// Info banner sous le sélecteur rappelant la session analysée.
// ============================================

import { ChevronDown } from "lucide-react";
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
  sessions,
  selectedId,
  onChange,
  otherTypeSelected,
}: {
  type: SessionType;
  color: string;
  label: string;
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
            "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono transition-all",
            "hover:bg-card/60",
            isActive ? "text-foreground" : "text-muted-foreground",
            otherTypeSelected && !isActive && "opacity-50",
          )}
          style={{
            borderColor: isActive ? color : "hsl(var(--border))",
            backgroundColor: isActive ? `${color}15` : "transparent",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="uppercase tracking-wider text-[10px]" style={{ color }}>
            {label}
          </span>
          <span className="text-foreground/80 truncate max-w-[140px]">
            {current ? current.name : "Aucune session"}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-popover border border-border">
        <DropdownMenuRadioGroup
          value={isActive ? (selectedId as string) : "__none__"}
          onValueChange={(v) => {
            if (v === "__none__") onChange(null);
            else onChange(v);
          }}
        >
          <DropdownMenuRadioItem value="__none__" className="cursor-pointer text-muted-foreground">
            Aucune session
          </DropdownMenuRadioItem>
          {sessionsOfType.length === 0 && (
            <div className="px-2 py-1.5 text-[10px] text-muted-foreground italic">
              Aucune session {type === "backtesting" ? "de backtesting" : "live"}
            </div>
          )}
          {sessionsOfType.map((s) => (
            <DropdownMenuRadioItem
              key={s.id}
              value={s.id}
              className="cursor-pointer flex flex-col items-start gap-0.5"
            >
              <span className="text-xs text-foreground">{s.name}</span>
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
    <div className="flex items-center gap-2 flex-wrap">
      <Dropdown
        type="backtesting"
        color={BLUE}
        label="Backtesting"
        sessions={sessions}
        selectedId={selectedId}
        onChange={onChange}
        otherTypeSelected={liveSelected}
      />
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
        ou
      </span>
      <Dropdown
        type="live"
        color={ORANGE}
        label="Live Trading"
        sessions={sessions}
        selectedId={selectedId}
        onChange={onChange}
        otherTypeSelected={backtestingSelected}
      />
    </div>
  );
};

export default SessionAnalysisSelector;
