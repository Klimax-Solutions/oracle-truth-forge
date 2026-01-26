import { cn } from "@/lib/utils";
import { Database, Calendar, Target, BarChart3, Clock } from "lucide-react";

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "oracle", label: "Database Oracle01", icon: Database },
  { id: "journal", label: "Journal de Trading", icon: Calendar },
  { id: "winrate", label: "Win Rate Analysis", icon: Target },
  { id: "distribution", label: "Distribution RR", icon: BarChart3 },
  { id: "timing", label: "Timing Analysis", icon: Clock },
];

export const DashboardSidebar = ({ activeTab, onTabChange }: DashboardSidebarProps) => {
  return (
    <aside className="w-64 border-r border-neutral-800 bg-neutral-950 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-500 mb-2">
          Database
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Oracle<sup className="text-sm font-normal align-super ml-0.5">™</sup>
        </h1>
      </div>

      {/* Tabs */}
      <nav className="flex-1 p-3 space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-left transition-all",
              "text-sm font-mono uppercase tracking-wider",
              activeTab === tab.id
                ? "bg-white text-black"
                : "text-neutral-500 hover:text-white hover:bg-neutral-800"
            )}
          >
            <tab.icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-800">
        <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider text-center">
          Oracle™ © 2026
        </p>
      </div>
    </aside>
  );
};
