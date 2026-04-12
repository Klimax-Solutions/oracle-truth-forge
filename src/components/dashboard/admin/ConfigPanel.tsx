// ============================================
// Config Panel — Réglages admin
// Tabs: Roles, Funnel Editor, Quêtes, Paramètres EA
// Branch: crm-integration
// ============================================

import { useState, lazy, Suspense } from "react";
import { Settings, Crown, Layers, TrendingUp, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const RoleManagement = lazy(() => import("@/components/dashboard/admin/RoleManagement").then(m => ({ default: m.RoleManagement })));
const FunnelEditorPage = lazy(() => import("@/components/dashboard/admin/FunnelEditorPage"));
const EarlyAccessManagement = lazy(() => import("@/components/dashboard/EarlyAccessManagement").then(m => ({ default: m.EarlyAccessManagement })));

const TABS = [
  { id: "roles", label: "Roles", icon: Crown },
  { id: "funnel", label: "Funnel Editor", icon: Layers },
  { id: "ea-params", label: "Parametres EA", icon: Users },
] as const;

type TabId = typeof TABS[number]["id"];

export default function ConfigPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("roles");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Settings className="w-4.5 h-4.5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Configuration</h2>
            <p className="text-xs text-muted-foreground">Roles, funnel, quetes, parametres EA</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === t.id
                  ? "bg-violet-500/15 text-violet-400 border border-violet-500/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        }>
          {activeTab === "roles" && <RoleManagement />}
          {activeTab === "funnel" && <FunnelEditorPage />}
          {activeTab === "ea-params" && <EarlyAccessManagement />}
        </Suspense>
      </div>
    </div>
  );
}
