import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useEarlyAccess = () => {
  const [isEarlyAccess, setIsEarlyAccess] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [earlyAccessType, setEarlyAccessType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const check = async () => {
    try {
      const { data } = await supabase.rpc("is_early_access");
      setIsEarlyAccess(!!data);

      if (data) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // activate_ea_timer() supprimé — expires_at est posé à l'approbation (J+7 déterministe)
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("expires_at, early_access_type" as any)
            .eq("user_id", user.id)
            .eq("role", "early_access")
            .maybeSingle();
          if (roleData) {
            const rd = roleData as any;
            if (rd.expires_at) setExpiresAt(rd.expires_at);
            setEarlyAccessType(rd.early_access_type || null);
          }
        }
      } else {
        setExpiresAt(null);
        setEarlyAccessType(null);
      }
    } catch (err) {
      console.warn('[useEarlyAccess] check error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();

    const channel = supabase
      .channel('ea-role-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        check();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isExpired = !!(isEarlyAccess && expiresAt && new Date(expiresAt) <= new Date());

  return { isEarlyAccess, isExpired, expiresAt, earlyAccessType, loading };
};
