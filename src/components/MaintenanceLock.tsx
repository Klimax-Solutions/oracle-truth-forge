import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";

// ===== Toggle maintenance mode here =====
export const MAINTENANCE_MODE = true;
const UNLOCK_PASSWORD = "oracle2025";
const STORAGE_KEY = "oracle_maintenance_unlock";
// Routes always accessible (auth flows)
const ALLOWED_ROUTES = ["/auth", "/reset-password", "/setup-password"];

export const MaintenanceLock = () => {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === "1",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!MAINTENANCE_MODE) {
      setChecking(false);
      return;
    }

    let mounted = true;

    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) {
            setIsAdmin(false);
            setChecking(false);
          }
          return;
        }
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        const adminRoles = ["super_admin", "admin"];
        const hasAdmin =
          roles?.some((r) => adminRoles.includes(r.role)) ?? false;
        if (mounted) {
          setIsAdmin(hasAdmin);
          setChecking(false);
        }
      } catch {
        if (mounted) setChecking(false);
      }
    };

    checkAdmin();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!MAINTENANCE_MODE) return null;
  if (checking) return null;
  if (isAdmin) return null;
  if (unlocked) return null;
  if (ALLOWED_ROUTES.includes(location.pathname)) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === UNLOCK_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
      setError("");
    } else {
      setError("Mot de passe incorrect");
      setPassword("");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-border/10 rounded-lg p-8 space-y-6 bg-card">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-full border border-border/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Oracle mis en veille temporairement
          </h1>
          <p className="text-sm text-muted-foreground">
            Maintenance en cours. L'accès sera rétabli sous peu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            autoFocus
            className="text-center"
          />
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
          <Button type="submit" className="w-full">
            Déverrouiller
          </Button>
        </form>
      </div>
    </div>
  );
};
