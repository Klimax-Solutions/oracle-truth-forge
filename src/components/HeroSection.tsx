import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Shield, Zap } from "lucide-react";
import { ProgressRing } from "./ProgressRing";

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background effects */}
      <div className="absolute inset-0 trading-grid opacity-30" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background to-transparent" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <div className="space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
              <Zap className="w-4 h-4" />
              La vérification avant l'exécution
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight">
              Maîtrise ton
              <span className="block gradient-text glow-text">setup de trading</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Oracle transforme 300 trades analysés en compétence réelle. 
              Apprends, vérifie, exécute — dans cet ordre.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="xl" className="group">
                Commencer la vérification
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="xl">
                Voir la démo
              </Button>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-8 pt-4">
              <div className="space-y-1">
                <p className="text-3xl font-black gradient-text">300</p>
                <p className="text-sm text-muted-foreground">Trades analysés</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div className="space-y-1">
                <p className="text-3xl font-black gradient-text">2,300</p>
                <p className="text-sm text-muted-foreground">RR Total</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div className="space-y-1">
                <p className="text-3xl font-black gradient-text">67%</p>
                <p className="text-sm text-muted-foreground">Win Rate</p>
              </div>
            </div>
          </div>

          {/* Right visual */}
          <div className="relative animate-slide-up hidden lg:block">
            <div className="relative">
              {/* Main card */}
              <div className="glass-card rounded-3xl p-8 glow-border">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold">Progression</h3>
                    <p className="text-muted-foreground">Phase de vérification</p>
                  </div>
                  <ProgressRing progress={42} label="Complété" sublabel="126/300 trades" />
                </div>

                {/* Phase indicators */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-success/10 border border-success/20">
                    <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Phase 1-4: 25 trades × 4</p>
                      <p className="text-sm text-success">Complété</p>
                    </div>
                    <span className="text-success font-mono font-bold">✓</span>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/10 border border-primary/20 animate-pulse-glow">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Phase 5-6: 50 trades × 2</p>
                      <p className="text-sm text-primary">En cours — 26/50</p>
                    </div>
                    <span className="text-primary font-mono font-bold">52%</span>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Zap className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-muted-foreground">Phase finale: 100 trades</p>
                      <p className="text-sm text-muted-foreground">À venir</p>
                    </div>
                    <span className="text-muted-foreground font-mono">—</span>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-6 -right-6 glass-card rounded-2xl p-4 animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="font-mono font-bold text-success">+7.6R</p>
                    <p className="text-xs text-muted-foreground">Dernier trade</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
