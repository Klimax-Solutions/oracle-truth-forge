import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const EarlyAccess = () => {
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
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

    // Check for duplicate email
    const { data: existingEmail } = await supabase
      .from("early_access_requests" as any)
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (existingEmail) {
      setError("Cette adresse email a déjà été utilisée pour une demande.");
      setIsLoading(false);
      return;
    }

    // Check for duplicate phone
    const { data: existingPhone } = await supabase
      .from("early_access_requests" as any)
      .select("id")
      .eq("phone", phone.trim())
      .maybeSingle();

    if (existingPhone) {
      setError("Ce numéro de téléphone a déjà été utilisé pour une demande.");
      setIsLoading(false);
      return;
    }

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
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 md:px-6 py-8">
        <div className="text-center mb-8 md:mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-semibold tracking-tight text-foreground">
            Oracle<sup className="text-lg md:text-xl lg:text-2xl font-normal align-super ml-0.5 md:ml-1">™</sup>
          </h1>
        </div>

        <div className="w-full max-w-md h-px bg-border mb-8 md:mb-10" />

        <div className="w-full max-w-md">
          <div className="border border-border bg-card p-6 md:p-8 rounded-md">
            {submitted ? (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-2">
                    Demande envoyée
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Votre demande a bien été reçue. Vous recevrez une confirmation dès que votre accès aura été validé par notre équipe.
                  </p>
                </div>

                <div className="border border-border rounded-md bg-muted/30 p-4 text-left space-y-2">
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Comment me connecter ?
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    Une fois votre demande approuvée, rendez-vous sur la page de connexion et utilisez l'option <strong>« Connexion par email »</strong>. Vous recevrez un lien sécurisé dans votre boîte mail pour accéder directement à la plateforme.
                  </p>
                </div>

                <Link to="/auth">
                  <Button variant="outline" className="w-full gap-2 mt-2">
                    Aller à la page de connexion
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
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

                <div className="mt-6 pt-4 border-t border-border text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    Déjà un accès ?
                  </p>
                  <Link to="/auth">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                      Se connecter
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
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

export default EarlyAccess;
