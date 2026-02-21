import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, LogIn, UserPlus } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";

type EAView = "signup" | "login";

const EarlyAccess = () => {
  const [view, setView] = useState<EAView>("signup");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Login state
  const [loginFirstName, setLoginFirstName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();

  // Check existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Check if user is early_access
        supabase.rpc("is_early_access").then(({ data }) => {
          if (data) navigate("/dashboard");
        });
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !phone.trim() || !email.trim()) {
      setError("Tous les champs sont obligatoires.");
      return;
    }

    setIsLoading(true);
    const { error: insertError } = await supabase
      .from("early_access_requests" as any)
      .insert({
        first_name: firstName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
      });

    if (insertError) {
      setError("Une erreur est survenue. Veuillez réessayer.");
      console.error(insertError);
    } else {
      setSubmitted(true);
      // Pre-fill login fields
      setLoginFirstName(firstName.trim());
      setLoginEmail(email.trim().toLowerCase());
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!loginFirstName.trim() || !loginEmail.trim()) {
      setLoginError("Prénom et email sont obligatoires.");
      return;
    }

    setLoginLoading(true);

    try {
      // EA users login with email + first name (lowercase, padded to 6 chars) as password
      const basePwd = loginFirstName.trim().toLowerCase();
      const password = basePwd.length >= 6 ? basePwd : basePwd.padEnd(6, basePwd);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login")) {
          setLoginError("Identifiants incorrects ou votre demande n'a pas encore été approuvée.");
        } else {
          setLoginError(error.message);
        }
        setLoginLoading(false);
        return;
      }

      if (data.user) {
        // Check profile status
        const { data: profile } = await supabase
          .from("profiles")
          .select("status, first_name, display_name")
          .eq("user_id", data.user.id)
          .single();

        const status = (profile as any)?.status;

        if (status === "pending") {
          await supabase.auth.signOut();
          setLoginError("Votre demande est en cours de validation. Vous serez notifié une fois approuvé.");
          setLoginLoading(false);
          return;
        }

        if (status === "frozen" || status === "banned") {
          await supabase.auth.signOut();
          setLoginError("Votre accès a été restreint. Contactez l'équipe.");
          setLoginLoading(false);
          return;
        }

        toast({ title: "Connexion réussie", description: `Bienvenue, ${(profile as any)?.first_name || loginFirstName} !` });
        navigate("/dashboard");
      }
    } catch (err: any) {
      setLoginError(err.message || "Erreur de connexion.");
    }
    setLoginLoading(false);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 md:px-6 py-8">
        {/* Logo */}
        <div className="text-center mb-8 md:mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-semibold tracking-tight text-foreground">
            Oracle<sup className="text-lg md:text-xl lg:text-2xl font-normal align-super ml-0.5 md:ml-1">™</sup>
          </h1>
        </div>

        <div className="w-full max-w-md h-px bg-border mb-8 md:mb-10" />

        {/* Toggle buttons */}
        <div className="w-full max-w-md flex mb-6 border border-border rounded-md overflow-hidden">
          <button
            onClick={() => setView("signup")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              view === "signup"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Soumettre ma demande
          </button>
          <button
            onClick={() => setView("login")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              view === "login"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn className="w-4 h-4" />
            Connexion
          </button>
        </div>

        <div className="w-full max-w-md">
          <div className="border border-border bg-card p-6 md:p-8 rounded-md">
            {view === "signup" ? (
              submitted ? (
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground mb-2">
                      Demande reçue
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Votre demande a bien été reçue. Notre équipe reviendra vers vous très prochainement.
                    </p>
                  </div>

                  {/* Show login form right after confirmation */}
                  <div className="border-t border-border pt-6">
                    <p className="text-xs text-muted-foreground text-center mb-4 font-mono uppercase tracking-wide">
                      Déjà approuvé ? Connectez-vous
                    </p>
                    <LoginForm
                      firstName={loginFirstName}
                      setFirstName={setLoginFirstName}
                      email={loginEmail}
                      setEmail={setLoginEmail}
                      isLoading={loginLoading}
                      error={loginError}
                      onSubmit={handleLogin}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6 md:mb-8 text-center">
                    <h2 className="text-lg md:text-xl font-bold text-foreground mb-2">
                      Accès Anticipé
                    </h2>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Rejoignez la liste d'attente et accédez en avant-première à Oracle.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Prénom
                      </label>
                      <Input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Votre prénom"
                        required
                        maxLength={50}
                        className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground rounded-md"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Numéro de téléphone
                      </label>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+33 6 12 34 56 78"
                        required
                        maxLength={20}
                        className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground rounded-md"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Adresse email
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        required
                        className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground rounded-md"
                      />
                    </div>

                    {error && (
                      <p className="text-xs text-destructive">{error}</p>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-12 bg-primary text-primary-foreground font-bold hover:bg-primary/90 rounded-md"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Soumettre ma demande"
                      )}
                    </Button>
                  </form>
                </>
              )
            ) : (
              <>
                <div className="mb-6 md:mb-8 text-center">
                  <h2 className="text-lg md:text-xl font-bold text-foreground mb-2">
                    Connexion Early Access
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Connectez-vous avec vos identifiants Early Access.
                  </p>
                </div>

                <LoginForm
                  firstName={loginFirstName}
                  setFirstName={setLoginFirstName}
                  email={loginEmail}
                  setEmail={setLoginEmail}
                  isLoading={loginLoading}
                  error={loginError}
                  onSubmit={handleLogin}
                />
              </>
            )}
          </div>
        </div>

        <p className="mt-8 md:mt-12 text-[10px] md:text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] md:tracking-[0.3em] text-center">
          Oracle © 2026 — Accès confidentiel
        </p>
      </div>
    </div>
  );
};

// ── Login sub-form ──
interface LoginFormProps {
  firstName: string;
  setFirstName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  isLoading: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}

const LoginForm = ({ firstName, setFirstName, email, setEmail, isLoading, error, onSubmit }: LoginFormProps) => (
  <form onSubmit={onSubmit} className="space-y-4 md:space-y-5">
    <div className="space-y-2">
      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Prénom
      </label>
      <Input
        type="text"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="Votre prénom"
        required
        maxLength={50}
        className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground rounded-md"
      />
    </div>

    <div className="space-y-2">
      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Adresse email
      </label>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="vous@exemple.com"
        required
        className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground rounded-md"
      />
    </div>

    {error && (
      <p className="text-xs text-destructive">{error}</p>
    )}

    <Button
      type="submit"
      className="w-full h-12 bg-primary text-primary-foreground font-bold hover:bg-primary/90 rounded-md"
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        "Connexion"
      )}
    </Button>
  </form>
);

export default EarlyAccess;
