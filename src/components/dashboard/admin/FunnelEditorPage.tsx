// ============================================
// Funnel Editor Page — Wrapper that switches between List and Editor
// Lives inside Dashboard as a tab, manages its own navigation state
// Includes Error Boundary to prevent crashes from killing the Dashboard
// Branch: crm-integration
// ============================================

import React, { useState } from "react";
import FunnelList from "./FunnelList";
import FunnelEditor from "./FunnelEditor";
import { AlertTriangle } from "lucide-react";

// Error Boundary — catches crashes in FunnelEditor without killing Dashboard
class FunnelErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[FunnelEditor] Crash:", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-lg font-display text-white">Erreur dans l'editeur</h3>
          <p className="text-sm text-white/40 max-w-md text-center font-mono">
            {this.state.error?.message || "Erreur inconnue"}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); this.props.onReset(); }}
            className="px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.10] text-sm text-white/70 hover:text-white hover:bg-white/[0.10] transition-all font-display"
          >
            Retour a la liste
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function FunnelEditorPage() {
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);

  if (editingFunnelId) {
    return (
      <FunnelErrorBoundary onReset={() => setEditingFunnelId(null)}>
        <FunnelEditor
          funnelId={editingFunnelId}
          onBack={() => setEditingFunnelId(null)}
        />
      </FunnelErrorBoundary>
    );
  }

  return (
    <FunnelList
      onEditFunnel={(id) => setEditingFunnelId(id)}
    />
  );
}
