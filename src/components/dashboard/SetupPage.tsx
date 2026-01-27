import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OraclePage } from "./OraclePage";
import { SetupPerso } from "./SetupPerso";
import { Database, User } from "lucide-react";

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
  const [activeSubTab, setActiveSubTab] = useState("oracle");

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="flex-1 flex flex-col">
        {/* Sub-tabs header */}
        <div className="border-b border-border bg-card px-6 py-3">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="oracle" className="gap-2 data-[state=active]:bg-background">
              <Database className="w-4 h-4" />
              Oracle
            </TabsTrigger>
            <TabsTrigger value="perso" className="gap-2 data-[state=active]:bg-background">
              <User className="w-4 h-4" />
              Setup Perso
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Content */}
        <TabsContent value="oracle" className="flex-1 m-0 data-[state=inactive]:hidden">
          <OraclePage trades={trades} initialFilters={initialFilters} />
        </TabsContent>

        <TabsContent value="perso" className="flex-1 m-0 data-[state=inactive]:hidden">
          <SetupPerso />
        </TabsContent>
      </Tabs>
    </div>
  );
};
