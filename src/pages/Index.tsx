import { forwardRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fallback = window.setTimeout(() => {
      if (mounted) navigate("/auth", { replace: true });
    }, 4000);

    const redirectFromSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        window.clearTimeout(fallback);
        navigate(session ? "/dashboard" : "/auth", { replace: true });
      } catch {
        if (!mounted) return;
        window.clearTimeout(fallback);
        navigate("/auth", { replace: true });
      }
    };

    redirectFromSession();

    return () => {
      mounted = false;
      window.clearTimeout(fallback);
    };
  }, [navigate]);

  return (
    <div ref={ref} className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
