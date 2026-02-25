import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event from the reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // User arrived via reset link — ready to set new password
        setRecoveryReady(true);
      }
    });

    // Also check if there's already a session (user may have already been authenticated by the link)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setRecoveryReady(true);
      } else {
        // Wait a moment for the auth state change to fire
        setTimeout(async () => {
          const { data: { session: s } } = await supabase.auth.getSession();
          if (!s && !recoveryReady) {
            toast({
              title: "Lien invalide",
              description: "Le lien de réinitialisation est invalide ou a expiré.",
              variant: "destructive",
            });
            navigate("/auth");
          }
        }, 3000);
      }
    };
    checkSession();

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "Mot de passe modifié",
        description: "Votre mot de passe a été réinitialisé avec succès.",
      });

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Mot de passe réinitialisé
            </h1>
            <p className="text-muted-foreground">
              Redirection vers le tableau de bord...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 md:px-6 py-8">
        <div className="text-center mb-8 md:mb-16">
          <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] md:tracking-[0.4em] text-muted-foreground mb-4 md:mb-6">
            Réinitialisation
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-semibold tracking-tight text-foreground">
            Oracle<sup className="text-lg md:text-xl lg:text-2xl font-normal align-super ml-0.5 md:ml-1">™</sup>
          </h1>
        </div>

        <div className="w-full max-w-md h-px bg-border mb-8 md:mb-12" />

        <div className="w-full max-w-md">
          <div className="border border-border bg-card p-6 md:p-8 rounded-md">
            <div className="mb-6 md:mb-8">
              <h2 className="text-base md:text-lg font-bold text-foreground mb-1">
                Nouveau mot de passe
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground">
                Choisissez un nouveau mot de passe sécurisé
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 md:space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-ring rounded-md pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-ring rounded-md pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-primary text-primary-foreground font-bold hover:bg-primary/90 rounded-md transition-colors"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Réinitialiser le mot de passe"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Retour à la connexion
              </button>
            </div>
          </div>
        </div>

        <p className="mt-8 md:mt-16 text-[10px] md:text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] md:tracking-[0.3em] text-center">
          Oracle © 2026 — Accès confidentiel
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
