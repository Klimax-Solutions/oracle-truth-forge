import { cn } from "@/lib/utils";
import { Database, Calendar, BarChart3, Clock, ChevronRight, Crosshair, Video } from "lucide-react";
import { useState } from "react";

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "execution", label: "Exécution d'Oracle", icon: Crosshair },
  { id: "oracle", label: "Database Oracle01", icon: Database },
  { id: "journal", label: "Journal de Trading", icon: Calendar },
  { id: "distribution", label: "Distribution RR", icon: BarChart3 },
  { id: "timing", label: "Timing Analysis", icon: Clock },
  { id: "videos", label: "Vidéo du Setup Oracle", icon: Video },
];

export const DashboardSidebar = ({ activeTab, onTabChange }: DashboardSidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside 
      className={cn(
        "border-r border-neutral-800 bg-neutral-950 flex flex-col transition-all duration-300 ease-out",
        isExpanded ? "w-64" : "w-16"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-neutral-800 transition-all duration-300",
        isExpanded ? "p-6" : "p-4"
      )}>
        {isExpanded ? (
          <>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-500 mb-2">
              Database
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Oracle<sup className="text-sm font-normal align-super ml-0.5">™</sup>
            </h1>
          </>
        ) : (
          <div className="flex items-center justify-center">
            <span className="text-xl font-bold text-white">O</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <nav className="flex-1 p-2 space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 transition-all",
              "text-sm font-mono uppercase tracking-wider",
              isExpanded ? "px-4 py-3" : "px-0 py-3 justify-center",
              activeTab === tab.id
                ? "bg-white text-black"
                : "text-neutral-500 hover:text-white hover:bg-neutral-800"
            )}
          >
            <tab.icon className="w-4 h-4 flex-shrink-0" />
            {isExpanded && <span className="truncate text-left">{tab.label}</span>}
          </button>
        ))}
      </nav>

      {/* Expand indicator */}
      {!isExpanded && (
        <div className="p-4 flex justify-center">
          <ChevronRight className="w-4 h-4 text-neutral-600 animate-pulse" />
        </div>
      )}

      {/* Footer */}
      {isExpanded && (
        <div className="p-4 border-t border-neutral-800">
          <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider text-center">
            Oracle™ © 2026
          </p>
        </div>
      )}
    </aside>
  );
};
