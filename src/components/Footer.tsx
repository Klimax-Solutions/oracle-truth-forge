export const Footer = () => {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center shadow-lg">
              <span className="text-xl font-black text-primary-foreground">O</span>
            </div>
            <div>
              <span className="text-lg font-bold">Oracle</span>
              <p className="text-xs text-muted-foreground">Trading Verification System</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            © 2026 Oracle. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
};
