import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/dashboard");
      } else {
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
        setIsLogin(true);
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

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 grid-pattern" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-neutral-500 mb-6">
            Authentification
          </p>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-white">
            Oracle<sup className="text-2xl md:text-3xl font-normal align-super ml-1">™</sup>
          </h1>
        </div>

        {/* Divider */}
        <div className="w-full max-w-md h-px bg-neutral-800 mb-12" />

        {/* Auth form */}
        <div className="w-full max-w-md">
          <div className="border border-neutral-800 bg-neutral-950 p-8">
            <div className="mb-8">
              <h2 className="text-lg font-bold text-white mb-1">
                {isLogin ? "Connexion" : "Créer un compte"}
              </h2>
              <p className="text-sm text-neutral-500">
                {isLogin
                  ? "Accédez à votre base de données"
                  : "Rejoignez la plateforme Oracle"}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  required
                  className="h-12 bg-black border-neutral-800 text-white placeholder:text-neutral-600 focus:border-neutral-600 rounded-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                  Mot de passe
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-12 bg-black border-neutral-800 text-white placeholder:text-neutral-600 focus:border-neutral-600 rounded-none pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
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
                className="w-full h-12 bg-white text-black font-bold hover:bg-neutral-200 rounded-none transition-colors"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isLogin ? (
                  "Se connecter"
                ) : (
                  "Créer le compte"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-neutral-500 hover:text-white transition-colors"
              >
                {isLogin
                  ? "Pas de compte ? Créer un compte"
                  : "Déjà un compte ? Se connecter"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-16 text-xs text-neutral-600 font-mono uppercase tracking-[0.3em]">
          Oracle © 2026 — Accès confidentiel
        </p>
      </div>
    </div>
  );
};

export default Auth;
