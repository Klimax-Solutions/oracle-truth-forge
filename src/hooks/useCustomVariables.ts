// ─────────────────────────────────────────────────────────────────────────────
// useCustomVariables — options globales des dropdowns de saisie de trades
//
// Règles dans le marbre (2026-04-29) :
//   - Les options sont globales (user_id IS NULL en DB)
//   - Tous les membres voient la même liste
//   - Seuls les admins peuvent ajouter / supprimer des options
//   - Supprimer une option n'affecte PAS rétrospectivement les trades
//     (valeurs stockées en texte brut dans user_executions, pas en FK)
// ─────────────────────────────────────────────────────────────────────────────

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
  sl_placement: string[];
  tp_placement: string[];
  [key: string]: string[];
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
    // Les options sont globales (user_id IS NULL) — pas besoin de l'uid pour les valeurs
    // On garde le user check uniquement pour user_variable_types (types custom par admin)
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch custom types (colonnes additionnelles définies par l'admin)
    const { data: typesData } = await supabase
      .from("user_variable_types")
      .select("*")
      .eq("user_id", user?.id ?? "");

    const userCustomTypes = typesData?.map(t => ({
      key: t.type_key,
      label: t.type_label,
      isCustom: true,
    })) || [];

    setCustomTypes(userCustomTypes);

    // Fetch options globales (user_id IS NULL)
    const { data } = await supabase
      .from("user_custom_variables")
      .select("*")
      .is("user_id", null);   // ← options globales uniquement

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

      userCustomTypes.forEach(t => { grouped[t.key] = []; });

      data.forEach((v: CustomVariable) => {
        if (v.variable_type in grouped) {
          grouped[v.variable_type].push(v.variable_value);
        } else {
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

    const channel = supabase
      .channel("global_custom_variables_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_custom_variables" }, () => {
        fetchVariables();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_variable_types" }, () => {
        fetchVariables();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { variables, customTypes, loading, refetch: fetchVariables };
};
