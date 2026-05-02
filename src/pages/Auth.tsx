import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, ArrowLeft, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import VortexTransition from "@/components/auth/VortexTransition";
import LoginProgressBar from "@/components/auth/LoginProgressBar";
import { prefetchDashboardData } from "@/lib/prefetchCache";

type AuthMode = "login" | "forgot-password" | "magic-link";

const ORACLE_LETTERS = ["O", "R", "A", "C", "L", "E"];

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
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

        if (data.user) {
          // If logging in with password, ensure flag is set
          if (!data.user.user_metadata?.password_set) {
            await supabase.auth.updateUser({ data: { password_set: true } });
          }
          // Check user status
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, first_name, status")
            .eq("user_id", data.user.id)
            .single();

          const status = (profile as any)?.status;

          if (status === "pending") {
            await supabase.auth.signOut();
            toast({
              title: "Compte en attente",
              description: "Votre compte est en cours de validation par un administrateur. Vous serez notifié une fois approuvé.",
            });
            setIsLoading(false);
            return;
          }

          if (status === "frozen" || status === "banned") {
            await supabase.auth.signOut();
            toast({
              title: "Accès refusé",
              description: status === "frozen" ? "Votre compte a été gelé." : "Votre compte a été banni.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }

          // Generate a simple device fingerprint
          const deviceFingerprint = `${navigator.platform}|${screen.width}x${screen.height}|${navigator.language}`;
          
          // Check how many distinct devices this user already has
          const { data: existingSessions } = await supabase
            .from("user_sessions")
            .select("id, device_fingerprint")
            .eq("user_id", data.user.id);

          // Admins et super_admins sont exemptés de la politique anti-partage —
          // ils se connectent légitimement depuis plusieurs environnements (localhost, Lovable Preview, prod).
          const { data: userRolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id);
          const isStaff = (userRolesData || []).some(
            (r: any) => r.role === "admin" || r.role === "super_admin"
          );

          const knownFingerprints = (existingSessions || []).map(s => (s as any).device_fingerprint).filter(Boolean);
          const isNewDevice = !knownFingerprints.includes(deviceFingerprint);

          // Gel si nouveau device ET déjà 5 devices connus ET pas admin/super_admin
          if (!isStaff && isNewDevice && knownFingerprints.length >= 5) {
            await supabase
              .from("profiles")
              .update({ status: "frozen", frozen_at: new Date().toISOString(), frozen_by: null, status_reason: "Connexion depuis un 6ème appareil détectée" })
              .eq("user_id", data.user.id);

            await supabase
              .from("security_alerts")
              .insert({
                user_id: data.user.id,
                alert_type: "multi_device",
                device_info: `${navigator.userAgent} | Fingerprint: ${deviceFingerprint}`,
              });

            await supabase.auth.signOut();
            toast({
              title: "Sécurité — Compte gelé",
              description: "Une connexion depuis un nouvel appareil a été détectée (limite atteinte). Votre compte a été temporairement gelé. Contactez un administrateur.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          
          // Register or update device session. Do not use upsert here: the DB may not
          // have a unique constraint on (user_id, device_fingerprint), which would
          // silently fail and leave the dashboard with an invalid local token.
          const sessionToken = crypto.randomUUID();
          const existingDeviceSession = (existingSessions || []).find(
            s => (s as any).device_fingerprint === deviceFingerprint,
          );

          const sessionWrite = existingDeviceSession
            ? await supabase
                .from("user_sessions")
                .update({
                  session_token: sessionToken,
                  device_info: navigator.userAgent,
                  device_fingerprint: deviceFingerprint,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", (existingDeviceSession as any).id)
            : await supabase
                .from("user_sessions")
                .insert({
                  user_id: data.user.id,
                  session_token: sessionToken,
                  device_info: navigator.userAgent,
                  device_fingerprint: deviceFingerprint,
                });

          if (sessionWrite.error) {
            throw sessionWrite.error;
          }

          localStorage.setItem("oracle_session_token", sessionToken);

          // Source de vérité = profiles.first_name (rempli par funnel ou
          // WelcomeNameDialog au 1er login dans Dashboard.tsx).
          // ⚠️ Ne PAS fallback sur display_name : le trigger handle_new_user
          // y stocke le email handle ("regenwetteremilien") quand user_metadata
          // est vide → on aurait "Bonjour, regenwetteremilien". Fallback neutre.
          const fn = (profile as any)?.first_name?.trim();
          setUserName(fn || "à toi");
        }

        setIsLoading(false);
        setIsProgressActive(true);

        // Prefetch données critiques Dashboard pendant l'animation (~3.5s).
        // Fire-and-forget : ne jamais await, ne bloque pas l'animation.
        // En cas d'erreur : Dashboard fait ses propres fetches normalement (cache miss = fallback).
        prefetchDashboardData(data.user.id).catch(() => {});
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
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/setup-password`,
        },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      toast({
        title: "Lien envoyé",
        description: "Vérifiez votre boîte mail pour vous connecter.",
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
      {/* Cursor trail removed */}

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
            {mode === "forgot-password" ? "Récupération" : mode === "magic-link" ? "Connexion par email" : "Authentification"}
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
              ) : mode === "magic-link" ? (
                <MagicLinkForm
                  email={email}
                  setEmail={setEmail}
                  isLoading={isLoading}
                  linkSent={magicLinkSent}
                  onSubmit={handleMagicLink}
                  onBack={() => { setMode("login"); setMagicLinkSent(false); }}
                />
              ) : (
                <AuthForm
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  isLoading={isLoading}
                  showingAnimation={showingAnimation}
                  onSubmit={handleAuth}
                  onForgotPassword={() => setMode("forgot-password")}
                  onMagicLink={() => setMode("magic-link")}
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
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  isLoading: boolean;
  showingAnimation: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
  onMagicLink: () => void;
}

const AuthForm = ({
  email, setEmail, password, setPassword,
  showPassword, setShowPassword, isLoading, showingAnimation,
  onSubmit, onForgotPassword, onMagicLink,
}: AuthFormProps) => (
  <>
    <div className="mb-6 md:mb-8">
      <h2 className="text-base md:text-lg font-bold text-foreground mb-1">
        Connexion
      </h2>
      <p className="text-xs md:text-sm text-muted-foreground">
        Accédez à votre base de données
      </p>
    </div>

    <form onSubmit={onSubmit} className="space-y-4 md:space-y-6">
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
          <button type="button" onClick={onForgotPassword} className="text-xs text-primary hover:text-primary/80 transition-colors">
            Mot de passe oublié ?
          </button>
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
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Se connecter"}
      </Button>
    </form>

    <div className="mt-6 space-y-5">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-px bg-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Première connexion ?
          </span>
        </div>
      </div>

      <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
        <button type="button" onClick={onMagicLink} className="w-full flex items-center justify-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
          <Mail className="w-4 h-4" />
          Recevoir mon lien de connexion par email
        </button>
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Si votre accès a été approuvé, vous recevrez un lien sécurisé pour vous connecter. Aucun mot de passe requis pour la première fois.
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        L'accès à Oracle se fait uniquement sur candidature via notre processus dédié.
      </p>
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

// Magic link form
interface MagicLinkFormProps {
  email: string;
  setEmail: (v: string) => void;
  isLoading: boolean;
  linkSent: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

const MagicLinkForm = ({ email, setEmail, isLoading, linkSent, onSubmit, onBack }: MagicLinkFormProps) => (
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
        Connexion par email
      </h2>
      <p className="text-xs md:text-sm text-muted-foreground">
        {linkSent
          ? "Un lien de connexion a été envoyé"
          : "Recevez un lien sécurisé dans votre boîte mail pour vous connecter instantanément."}
      </p>
    </div>

    {linkSent ? (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm text-foreground font-medium mb-1">
          Lien envoyé !
        </p>
        <p className="text-sm text-muted-foreground mb-5">
          Vérifiez votre boîte mail à <strong className="text-foreground">{email}</strong>
        </p>
        <p className="text-xs text-muted-foreground mb-5">
          Cliquez sur le lien reçu pour accéder directement à la plateforme. Si vous ne le trouvez pas, vérifiez vos spams.
        </p>

        <div className="flex flex-col gap-2 mb-5">
          <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors">
            Ouvrir Gmail
          </a>
          <a href="https://outlook.live.com" target="_blank" rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors">
            Ouvrir Outlook
          </a>
          <a href="https://mail.yahoo.com" target="_blank" rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors">
            Ouvrir Yahoo Mail
          </a>
        </div>

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
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Envoyer le lien de connexion"}
        </Button>
      </form>
    )}
  </>
);

export default Auth;
