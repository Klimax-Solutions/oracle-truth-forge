import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useEarlyAccess = () => {
  const [isEarlyAccess, setIsEarlyAccess] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.rpc("is_early_access");
      setIsEarlyAccess(!!data);

      if (data) {
        // Fetch the expires_at for this user's early_access role
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("expires_at")
            .eq("user_id", user.id)
            .eq("role", "early_access")
            .maybeSingle();
          if (roleData?.expires_at) {
            setExpiresAt(roleData.expires_at);
          }
        }
      }
      setLoading(false);
    };
    check();
  }, []);

  return { isEarlyAccess, expiresAt, loading };
};
