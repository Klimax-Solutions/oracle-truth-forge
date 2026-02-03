import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

type AuthMode = "login" | "signup" | "forgot-password";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/dashboard");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Compte créé",
          description: "Vous pouvez maintenant vous connecter.",
        });
        setMode("login");
      }
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast({
        title: "Email envoyé",
        description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe.",
      });
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-muted-foreground mb-6">
            {mode === "forgot-password" ? "Récupération" : "Authentification"}
          </p>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-foreground">
            Oracle<sup className="text-xl md:text-2xl font-normal align-super ml-1">™</sup>
          </h1>
        </div>

        {/* Divider */}
        <div className="w-full max-w-md h-px bg-border mb-12" />

        {/* Auth form */}
        <div className="w-full max-w-md">
          <div className="border border-border bg-card p-8 rounded-md">
            {mode === "forgot-password" ? (
              // Forgot password form
              <>
                {mode === "forgot-password" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setResetEmailSent(false);
                    }}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                  </button>
                )}
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-foreground mb-1">
                    Mot de passe oublié
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {resetEmailSent
                      ? "Un email de réinitialisation a été envoyé"
                      : "Entrez votre email pour recevoir un lien de réinitialisation"}
                  </p>
                </div>

                {resetEmailSent ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Vérifiez votre boîte mail à <strong>{email}</strong>
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMode("login");
                        setResetEmailSent(false);
                      }}
                      className="w-full"
                    >
                      Retour à la connexion
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        required
                        className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-ring rounded-md"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-primary text-primary-foreground font-bold hover:bg-primary/90 rounded-md transition-colors"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Envoyer le lien"
                      )}
                    </Button>
                  </form>
                )}
              </>
            ) : (
              // Login / Signup form
              <>
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-foreground mb-1">
                    {mode === "login" ? "Connexion" : "Créer un compte"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {mode === "login"
                      ? "Accédez à votre base de données"
                      : "Rejoignez la plateforme Oracle"}
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      required
                      className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-ring rounded-md"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Mot de passe
                      </label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => setMode("forgot-password")}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          Mot de passe oublié ?
                        </button>
                      )}
                    </div>
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

                  <Button
                    type="submit"
                    className="w-full h-12 bg-primary text-primary-foreground font-bold hover:bg-primary/90 rounded-md transition-colors"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : mode === "login" ? (
                      "Se connecter"
                    ) : (
                      "Créer le compte"
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => setMode(mode === "login" ? "signup" : "login")}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {mode === "login"
                      ? "Pas de compte ? Créer un compte"
                      : "Déjà un compte ? Se connecter"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-16 text-xs text-muted-foreground font-mono uppercase tracking-[0.3em]">
          Oracle © 2026 — Accès confidentiel
        </p>
      </div>
    </div>
  );
};

export default Auth;
