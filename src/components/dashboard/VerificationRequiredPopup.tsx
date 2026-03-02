import { Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface VerificationRequiredPopupProps {
  open: boolean;
  cycleName: string;
  cycleNumber: number;
  progress: number;
  total: number;
  submitting: boolean;
  onRequestVerification: () => void;
}

export const VerificationRequiredPopup = ({
  open,
  cycleName,
  cycleNumber,
  progress,
  total,
  submitting,
  onRequestVerification,
}: VerificationRequiredPopupProps) => {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md border-primary/40 bg-card [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            {cycleNumber === 0
              ? "Phase d'ébauche terminée !"
              : `Fin du ${cycleName} !`}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {cycleNumber === 0
              ? `Vous avez récolté et analysé les ${total} datas de la phase d'ébauche. Demandez votre vérification pour débloquer le cycle suivant.`
              : `Vous avez récolté ${progress}/${total} datas pour le ${cycleName}. Demandez votre vérification pour passer à l'étape suivante.`}
          </DialogDescription>
        </DialogHeader>

        <Button
          onClick={onRequestVerification}
          disabled={submitting}
          className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-2 h-12 text-base animate-pulse"
        >
          <Send className="w-4 h-4" />
          {submitting ? "Envoi en cours..." : "Demander la vérification"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
