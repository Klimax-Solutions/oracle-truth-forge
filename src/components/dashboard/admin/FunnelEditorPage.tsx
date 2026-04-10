// ============================================
// Funnel Editor Page — Wrapper that switches between List and Editor
// Lives inside Dashboard as a tab, manages its own navigation state
// Branch: crm-integration
// ============================================

import { useState } from "react";
import FunnelList from "./FunnelList";
import FunnelEditor from "./FunnelEditor";

export default function FunnelEditorPage() {
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);

  if (editingFunnelId) {
    return (
      <FunnelEditor
        funnelId={editingFunnelId}
        onBack={() => setEditingFunnelId(null)}
      />
    );
  }

  return (
    <FunnelList
      onEditFunnel={(id) => setEditingFunnelId(id)}
    />
  );
}
