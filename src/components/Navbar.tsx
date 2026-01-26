import { Button } from "@/components/ui/button";
import { BarChart3, Database, Settings } from "lucide-react";

export const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center shadow-lg">
              <span className="text-xl font-black text-primary-foreground">O</span>
            </div>
            <span className="text-xl font-bold tracking-tight">Oracle</span>
          </div>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="sm" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <Database className="w-4 h-4" />
              Trades
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </div>

          {/* CTA */}
          <Button variant="hero" size="sm">
            Connect Data
          </Button>
        </div>
      </div>
    </nav>
  );
};
