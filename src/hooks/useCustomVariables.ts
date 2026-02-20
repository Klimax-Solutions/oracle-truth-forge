import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CustomVariable {
  id: string;
  variable_type: string;
  variable_value: string;
}

interface CustomVariableType {
  id: string;
  type_key: string;
  type_label: string;
}

export interface CustomVariables {
  direction_structure: string[];
  setup_type: string[];
  entry_model: string[];
  entry_timing: string[];
  entry_timeframe: string[];
  [key: string]: string[]; // Allow dynamic keys for custom types
}

export interface CustomVariableTypes {
  key: string;
  label: string;
  isCustom: boolean;
}

export const useCustomVariables = () => {
  const [variables, setVariables] = useState<CustomVariables>({
    direction_structure: [],
    setup_type: [],
    entry_model: [],
    entry_timing: [],
    entry_timeframe: [],
    sl_placement: [],
    tp_placement: [],
  });
  const [customTypes, setCustomTypes] = useState<CustomVariableTypes[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVariables = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch custom types
    const { data: typesData } = await supabase
      .from("user_variable_types")
      .select("*")
      .eq("user_id", user.id);

    const userCustomTypes = typesData?.map(t => ({
      key: t.type_key,
      label: t.type_label,
      isCustom: true
    })) || [];

    setCustomTypes(userCustomTypes);

    // Fetch variables
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
        entry_timeframe: [],
        sl_placement: [],
        tp_placement: [],
      };

      // Initialize custom types in grouped
      userCustomTypes.forEach(t => {
        grouped[t.key] = [];
      });

      data.forEach((v: CustomVariable) => {
        if (v.variable_type in grouped) {
          grouped[v.variable_type].push(v.variable_value);
        } else {
          // Handle unknown types (create array if needed)
          grouped[v.variable_type] = grouped[v.variable_type] || [];
          grouped[v.variable_type].push(v.variable_value);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_variable_types' }, () => {
        fetchVariables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { variables, customTypes, loading, refetch: fetchVariables };
};
