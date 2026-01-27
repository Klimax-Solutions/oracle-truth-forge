import { useState } from "react";
import { OraclePage } from "./OraclePage";
import { SetupPerso } from "./SetupPerso";
import { Database, User, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  screenshot_m15_m5: string | null;
  screenshot_m1: string | null;
}

interface SetupPageProps {
  trades: Trade[];
  initialFilters?: any;
}

export const SetupPage = ({ trades, initialFilters }: SetupPageProps) => {
  const [oracleCollapsed, setOracleCollapsed] = useState(false);
  const [persoCollapsed, setPersoCollapsed] = useState(false);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Oracle Section */}
      <div className={cn(
        "flex flex-col border-b border-border transition-all duration-300",
        oracleCollapsed ? "flex-shrink-0" : "flex-1 min-h-0"
      )}>
        {/* Oracle Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Oracle</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOracleCollapsed(!oracleCollapsed)}
            className="h-7 w-7 p-0"
          >
            {oracleCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* Oracle Content */}
        {!oracleCollapsed && (
          <div className="flex-1 overflow-hidden">
            <OraclePage trades={trades} initialFilters={initialFilters} />
          </div>
        )}
      </div>

      {/* Setup Perso Section */}
      <div className={cn(
        "flex flex-col transition-all duration-300",
        persoCollapsed ? "flex-shrink-0" : "flex-1 min-h-0"
      )}>
        {/* Perso Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Setup Perso</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPersoCollapsed(!persoCollapsed)}
            className="h-7 w-7 p-0"
          >
            {persoCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* Perso Content */}
        {!persoCollapsed && (
          <div className="flex-1 overflow-hidden">
            <SetupPerso />
          </div>
        )}
      </div>
    </div>
  );
};
