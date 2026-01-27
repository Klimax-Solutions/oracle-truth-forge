import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CustomVariable {
  id: string;
  variable_type: string;
  variable_value: string;
}

export interface CustomVariables {
  direction_structure: string[];
  setup_type: string[];
  entry_model: string[];
  entry_timing: string[];
}

export const useCustomVariables = () => {
  const [variables, setVariables] = useState<CustomVariables>({
    direction_structure: [],
    setup_type: [],
    entry_model: [],
    entry_timing: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchVariables = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("user_custom_variables")
      .select("*")
      .eq("user_id", user.id);

    if (data) {
      const grouped: CustomVariables = {
        direction_structure: [],
        setup_type: [],
        entry_model: [],
        entry_timing: [],
      };

      data.forEach((v: CustomVariable) => {
        if (v.variable_type in grouped) {
          grouped[v.variable_type as keyof CustomVariables].push(v.variable_value);
        }
      });

      setVariables(grouped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVariables();

    // Subscribe to changes
    const channel = supabase
      .channel('custom_variables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_custom_variables' }, () => {
        fetchVariables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { variables, loading, refetch: fetchVariables };
};
