import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface WelcomeNameDialogProps {
  userId: string;
  /** Called once the profile.first_name has been saved. Parent should refetch the profile. */
  onComplete: (firstName: string) => void;
}

/**
 * Bloque le dashboard sur 1er login tant que le profil n'a pas de first_name.
 *
 * Source de vérité : profiles.first_name. Le funnel (approve-early-access) le remplit
 * bien à la création. Mais les comptes créés via Supabase Dashboard "Add user"
 * (admins, setters, closers) arrivent avec first_name=NULL → fallback bizarre
 * "Bonjour, {emailHandle}". Ce dialog corrige ça pour tout le monde.
 */
export const WelcomeNameDialog = ({ userId, onComplete }: WelcomeNameDialogProps) => {
  const [firstName, setFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Empêche le scroll body pendant que le dialog est ouvert
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = firstName.trim();
    if (!trimmed) return;
    if (trimmed.length > 60) {
      toast({ title: "Prénom trop long", description: "60 caractères max.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: trimmed, display_name: trimmed })
        .eq("user_id", userId);
      if (error) throw error;
      onComplete(trimmed);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message ?? "Impossible d'enregistrer.", variant: "destructive" });
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl p-6 sm:p-8 space-y-5 sm:space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">Comment on t'appelle ?</h2>
            <p className="text-sm text-muted-foreground">
              On préfère t'accueillir par ton prénom plutôt que par ton email.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="first_name" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Ton prénom
          </label>
          <Input
            id="first_name"
            autoFocus
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Charles"
            maxLength={60}
            className="text-base h-11"
            disabled={submitting}
          />
        </div>

        <Button
          type="submit"
          disabled={!firstName.trim() || submitting}
          className="w-full h-11 text-sm font-semibold"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuer"}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground/70">
          Tu pourras le modifier plus tard depuis ton profil.
        </p>
      </form>
    </div>
  );
};
