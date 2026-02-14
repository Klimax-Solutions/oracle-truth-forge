import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useEarlyAccess = () => {
  const [isEarlyAccess, setIsEarlyAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.rpc("is_early_access");
      setIsEarlyAccess(!!data);
      setLoading(false);
    };
    check();
  }, []);

  return { isEarlyAccess, loading };
};
