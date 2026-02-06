import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import CursorTrail from "@/components/auth/CursorTrail";
import VortexTransition from "@/components/auth/VortexTransition";
import LoginProgressBar from "@/components/auth/LoginProgressBar";

type AuthMode = "login" | "signup" | "forgot-password";

const ORACLE_LETTERS = ["O", "R", "A", "C", "L", "E"];

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isProgressActive, setIsProgressActive] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [revealedLetters, setRevealedLetters] = useState<boolean[]>(new Array(6).fill(false));
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const letterWidth = w / 6;
    const newRevealed = ORACLE_LETTERS.map((_, i) => {
      const zoneLeft = i * letterWidth;
      const zoneRight = zoneLeft + letterWidth;
      const inX = x >= zoneLeft && x <= zoneRight;
      const cardTop = h * 0.3;
      const cardBottom = h * 0.7;
      const inOuterY = y < cardTop || y > cardBottom;
      return inX && inOuterY;
    });

    setRevealedLetters(prev => {
      return prev.map((wasRevealed, i) => wasRevealed || newRevealed[i]);
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTimeout(() => {
      setRevealedLetters(new Array(6).fill(false));
    }, 1500);
  }, []);

  const handleProgressComplete = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      navigate("/dashboard");
    }, 1400);
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Fetch display_name from profiles
        if (data.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", data.user.id)
            .single();

          setUserName(profile?.display_name || email.split("@")[0]);
        }

        setIsLoading(false);
        setIsProgressActive(true);
      } else if (mode === "signup") {
        const trimmedName = firstName.trim();
        if (!trimmedName) {
          toast({
            title: "Prénom requis",
            description: "Veuillez entrer votre prénom.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: trimmedName,
            },
          },
        });
        if (error) throw error;
        toast({
          title: "Compte créé",
          description: "Vous pouvez maintenant vous connecter.",
        });
        setMode("login");
        setIsLoading(false);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
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

  const showingAnimation = isProgressActive || isTransitioning;

  return (
    <div
      className={`min-h-screen bg-background relative overflow-hidden transition-colors duration-700 ${isTransitioning ? "auth-vortex-bg" : ""}`}
      onMouseMove={!showingAnimation ? handleMouseMove : undefined}
      onMouseLeave={!showingAnimation ? handleMouseLeave : undefined}
    >
      {!showingAnimation && <CursorTrail />}

      <div className="auth-bg-letters" aria-hidden="true">
        {ORACLE_LETTERS.map((letter, i) => (
          <span
            key={i}
            className={`auth-bg-letter ${revealedLetters[i] ? "auth-bg-letter-visible" : ""}`}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            {letter}
          </span>
        ))}
      </div>

      <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20">
        <ThemeToggle />
      </div>

      <div className={`relative z-10 min-h-screen flex flex-col items-center justify-center px-4 md:px-6 py-8 transition-all duration-700 ${isTransitioning ? "auth-page-absorb" : ""}`}>
        <div className={`text-center mb-8 md:mb-16 transition-all duration-500 ${showingAnimation ? "opacity-0 scale-75" : "animate-fade-in"}`}>
          <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] md:tracking-[0.4em] text-muted-foreground mb-4 md:mb-6">
            {mode === "forgot-password" ? "Récupération" : "Authentification"}
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-semibold tracking-tight text-foreground">
            Oracle<sup className="text-lg md:text-xl lg:text-2xl font-normal align-super ml-0.5 md:ml-1">™</sup>
          </h1>
        </div>

        <div className={`w-full max-w-md h-px bg-border mb-8 md:mb-12 transition-all duration-500 ${showingAnimation ? "opacity-0 scale-x-0" : ""}`} />

        <div className={`w-full max-w-md ${isTransitioning ? "auth-card-vortex" : ""} ${isProgressActive ? "opacity-0 scale-90 transition-all duration-500" : ""}`}>
          <div className="auth-glow-card">
            <div className="auth-glow-card-inner border border-border bg-card p-6 md:p-8 rounded-md">
              {mode === "forgot-password" ? (
                <ForgotPasswordForm
                  email={email}
                  setEmail={setEmail}
                  isLoading={isLoading}
                  resetEmailSent={resetEmailSent}
                  onSubmit={handleForgotPassword}
                  onBack={() => { setMode("login"); setResetEmailSent(false); }}
                />
              ) : (
                <AuthForm
                  mode={mode}
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  firstName={firstName}
                  setFirstName={setFirstName}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  isLoading={isLoading}
                  showingAnimation={showingAnimation}
                  onSubmit={handleAuth}
                  onSwitchMode={() => setMode(mode === "login" ? "signup" : "login")}
                  onForgotPassword={() => setMode("forgot-password")}
                />
              )}
            </div>
          </div>
        </div>

        <p className={`mt-8 md:mt-16 text-[10px] md:text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] md:tracking-[0.3em] text-center transition-all duration-500 ${showingAnimation ? "opacity-0 translate-y-8" : ""}`}>
          Oracle © 2026 — Accès confidentiel
        </p>
      </div>

      <LoginProgressBar
        isActive={isProgressActive}
        onComplete={handleProgressComplete}
        userName={userName}
      />

      {isTransitioning && <VortexTransition isActive={isTransitioning} />}
    </div>
  );
};

// ---- Sub-components ----

interface AuthFormProps {
  mode: "login" | "signup";
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  firstName: string;
  setFirstName: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  isLoading: boolean;
  showingAnimation: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchMode: () => void;
  onForgotPassword: () => void;
}

const AuthForm = ({
  mode, email, setEmail, password, setPassword, firstName, setFirstName,
  showPassword, setShowPassword, isLoading, showingAnimation,
  onSubmit, onSwitchMode, onForgotPassword,
}: AuthFormProps) => (
  <>
    <div className="mb-6 md:mb-8">
      <h2 className="text-base md:text-lg font-bold text-foreground mb-1">
        {mode === "login" ? "Connexion" : "Créer un compte"}
      </h2>
      <p className="text-xs md:text-sm text-muted-foreground">
        {mode === "login" ? "Accédez à votre base de données" : "Rejoignez la plateforme Oracle"}
      </p>
    </div>

    <form onSubmit={onSubmit} className="space-y-4 md:space-y-6">
      {/* First name - signup only */}
      {mode === "signup" && (
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Prénom</label>
          <Input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Votre prénom"
            required
            maxLength={50}
            className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-ring rounded-md"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Email</label>
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
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Mot de passe</label>
          {mode === "login" && (
            <button type="button" onClick={onForgotPassword} className="text-xs text-primary hover:text-primary/80 transition-colors">
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
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground font-bold hover:bg-primary/90 rounded-md transition-colors" disabled={isLoading || showingAnimation}>
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === "login" ? "Se connecter" : "Créer le compte"}
      </Button>
    </form>

    <div className="mt-6 text-center">
      <button type="button" onClick={onSwitchMode} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        {mode === "login" ? "Pas de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
      </button>
    </div>
  </>
);

// Forgot password form
interface ForgotPasswordFormProps {
  email: string;
  setEmail: (v: string) => void;
  isLoading: boolean;
  resetEmailSent: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

const ForgotPasswordForm = ({ email, setEmail, isLoading, resetEmailSent, onSubmit, onBack }: ForgotPasswordFormProps) => (
  <>
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
    >
      <ArrowLeft className="w-4 h-4" />
      Retour
    </button>
    <div className="mb-6 md:mb-8">
      <h2 className="text-base md:text-lg font-bold text-foreground mb-1">
        Mot de passe oublié
      </h2>
      <p className="text-xs md:text-sm text-muted-foreground">
        {resetEmailSent
          ? "Un email de réinitialisation a été envoyé"
          : "Entrez votre email pour recevoir un lien de réinitialisation"}
      </p>
    </div>

    {resetEmailSent ? (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Vérifiez votre boîte mail à <strong>{email}</strong>
        </p>
        <Button type="button" variant="outline" onClick={onBack} className="w-full">
          Retour à la connexion
        </Button>
      </div>
    ) : (
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" required className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-ring rounded-md" />
        </div>
        <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground font-bold hover:bg-primary/90 rounded-md transition-colors" disabled={isLoading}>
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Envoyer le lien"}
        </Button>
      </form>
    )}
  </>
);

export default Auth;
