// ─────────────────────────────────────────────────────────────────────────────
// useCustomVariables — options des dropdowns de saisie de trades
//
// Architecture 3 couches (dans le marbre — 2026-04-29) :
//   1. Options hardcodées  : constantes TSX (fixedOptions), jamais en DB
//   2. Options partagées   : user_id IS NULL — gérées par l'admin, vues par TOUS
//   3. Options personnelles: user_id = user.id — gérées par le user, vues par LUI SEUL
//
// Supprimer une option n'affecte PAS rétrospectivement les trades
// (valeurs stockées en texte brut dans user_executions, pas en FK)
//
// Slice D — Learning Cycles
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CustomVariable {
  id: string;
  variable_type: string;
  variable_value: string;
  user_id: string | null;
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

const makeEmptyGrouped = (extraKeys: string[] = []): CustomVariables => ({
  direction_structure: [],
  setup_type: [],
  entry_model: [],
  entry_timing: [],
  entry_timeframe: [],
  sl_placement: [],
  tp_placement: [],
  ...Object.fromEntries(extraKeys.map(k => [k, []])),
});

const groupByType = (rows: CustomVariable[], keys: string[]): CustomVariables => {
  const grouped = makeEmptyGrouped(keys);
  rows.forEach((v) => {
    if (v.variable_type in grouped) {
      grouped[v.variable_type].push(v.variable_value);
    } else {
      grouped[v.variable_type] = [v.variable_value];
    }
  });
  return grouped;
};

export const useCustomVariables = () => {
  const [globalVariables, setGlobalVariables]     = useState<CustomVariables>(makeEmptyGrouped());
  const [personalVariables, setPersonalVariables] = useState<CustomVariables>(makeEmptyGrouped());
  const [customTypes, setCustomTypes]             = useState<CustomVariableTypes[]>([]);
  const [loading, setLoading]                     = useState(true);

  const fetchVariables = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    // ── Types custom définis par l'admin ──────────────────────────────────────
    const { data: typesData } = await supabase
      .from("user_variable_types")
      .select("*")
      .eq("user_id", user?.id ?? "");

    const userCustomTypes: CustomVariableTypes[] = typesData?.map(t => ({
      key: t.type_key,
      label: t.type_label,
      isCustom: true,
    })) || [];
    setCustomTypes(userCustomTypes);

    const extraKeys = userCustomTypes.map(t => t.key);

    // ── Options partagées (user_id IS NULL) ───────────────────────────────────
    const { data: globalData } = await supabase
      .from("user_custom_variables")
      .select("*")
      .is("user_id", null);

    // ── Options personnelles (user_id = auth.uid()) ───────────────────────────
    const { data: personalData } = user?.id
      ? await supabase
          .from("user_custom_variables")
          .select("*")
          .eq("user_id", user.id)
      : { data: [] };

    setGlobalVariables(groupByType(globalData || [], extraKeys));
    setPersonalVariables(groupByType(personalData || [], extraKeys));
    setLoading(false);
  };

  useEffect(() => {
    fetchVariables();

    const channel = supabase
      .channel("custom_variables_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_custom_variables" }, () => {
        fetchVariables();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_variable_types" }, () => {
        fetchVariables();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return {
    // Nouvelles clés séparées
    globalVariables,
    personalVariables,
    // Backward-compat : variables = globalVariables (utilisé dans certains anciens composants)
    variables: globalVariables,
    customTypes,
    loading,
    refetch: fetchVariables,
  };
};
