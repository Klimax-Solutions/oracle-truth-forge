import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

// Maintenance désactivée globalement. On bloque uniquement les rôles "member"
// déjà connectés (les vrais clients existants) le temps de finaliser la maj.
// Tout le reste (anonymes, signups, EA, staff) passe normalement.
export const MAINTENANCE_MODE = false; // legacy export, plus utilisé pour bloquer le site
// Routes toujours accessibles, même pour un membre bloqué.
// On inclut tous les funnels publics (/:slug/landing|apply|discovery|final) + la home + les flux auth.
const ALLOWED_EXACT = ["/", "/auth", "/reset-password", "/setup-password"];
const ALLOWED_SUFFIXES = ["/landing", "/apply", "/discovery", "/final"];
const isAllowedRoute = (pathname: string) => {
  if (ALLOWED_EXACT.includes(pathname)) return true;
  return ALLOWED_SUFFIXES.some((s) => pathname.endsWith(s));
};

export const MaintenanceLock = () => {
  const location = useLocation();
  const [shouldBlock, setShouldBlock] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) setShouldBlock(false);
          return;
        }
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        const list = (roles ?? []).map((r) => r.role);
        // Bloque uniquement si l'user a STRICTEMENT le rôle member (aucun autre rôle).
        // Si admin / super_admin / setter / closer / early_access → accès normal.
        const onlyMember = list.length > 0 && list.every((r) => r === "member");
        if (mounted) setShouldBlock(onlyMember);
      } catch {
        if (mounted) setShouldBlock(false);
      }
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!shouldBlock) return null;
  if (isAllowedRoute(location.pathname)) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-border/10 rounded-lg p-8 space-y-6 bg-card">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-full border border-border/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Mise à jour en cours
          </h1>
          <p className="text-sm text-muted-foreground">
            Merci de patienter quelques instants, nous finalisons une mise à jour
            de la plateforme. Ton accès sera rétabli automatiquement très bientôt.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full gap-2"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
};
