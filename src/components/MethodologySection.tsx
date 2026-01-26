import { BookOpen, CheckCircle, RotateCcw, Trophy } from "lucide-react";

const steps = [
  {
    icon: BookOpen,
    title: "Apprendre",
    description: "Étudie le setup avec les 300 trades documentés et leurs analyses détaillées.",
    color: "primary"
  },
  {
    icon: CheckCircle,
    title: "Vérifier",
    description: "Trace 25 trades sur ton chart, puis corrige avec la base de données Oracle.",
    color: "warning"
  },
  {
    icon: RotateCcw,
    title: "Itérer",
    description: "Répète le cycle: 4×25, puis 2×50, jusqu'à maîtriser les 300 occurrences.",
    color: "success"
  },
  {
    icon: Trophy,
    title: "Exécuter",
    description: "Une fois vérifié, tu es prêt à exécuter avec confiance sur le marché réel.",
    color: "primary"
  }
];

export const MethodologySection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/50 to-background" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            La méthode <span className="gradient-text">anti-Dunning-Kruger</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            90% des traders échouent parce qu'ils sautent l'étape de vérification. 
            Oracle t'oblige à prouver ta compréhension avant d'exécuter.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="glass-card rounded-2xl p-6 relative group hover:border-primary/30 transition-all duration-300"
              >
                {/* Step number */}
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center text-sm font-bold text-primary-foreground shadow-lg">
                  {index + 1}
                </div>

                <div className="pt-4 space-y-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    step.color === "primary" ? "bg-primary/10 text-primary" :
                    step.color === "warning" ? "bg-warning/10 text-warning" :
                    "bg-success/10 text-success"
                  }`}>
                    <Icon className="w-7 h-7" />
                  </div>

                  <h3 className="text-xl font-bold">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-border to-primary/30" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
