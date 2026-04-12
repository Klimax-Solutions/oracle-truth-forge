// ============================================
// Gestion Panel — Suivi produit post-vente
// Wraps AdminVerification (Utilisateurs, Vérifications, Suivi, Sécurité)
// Ne modifie PAS AdminVerification — l'encapsule avec un header propre
// Branch: crm-integration
// ============================================

import { lazy, Suspense } from "react";
import { Users, Loader2 } from "lucide-react";

const AdminVerification = lazy(() => import("@/components/dashboard/AdminVerification").then(m => ({ default: m.AdminVerification })));

export default function GestionPanel() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Gestion Produit</h2>
            <p className="text-xs text-muted-foreground">Suivi utilisateurs, verifications, accompagnement, securite</p>
          </div>
        </div>
      </div>

      {/* Content — AdminVerification with its own internal tabs */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        }>
          <AdminVerification />
        </Suspense>
      </div>
    </div>
  );
}
