-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : seed des options partagées (migration des constantes TSX → DB)
--
-- Avant : options "fixes" hardcodées dans le code TSX (SETUP_TYPE_FIXED_OPTIONS, etc.)
--         → non modifiables via l'UI, changement = deploy obligatoire
--
-- Après : toutes les options sont en DB (user_id IS NULL = partagées)
--         → admin peut ajouter / supprimer via l'UI
--         → supprimer une option n'affecte PAS les trades existants
--           (valeurs stockées en texte dans user_executions, pas en FK)
--
-- Règle de sécurité : seuls is_admin() + is_super_admin() peuvent gérer
-- les options partagées (RLS migration 20260429240000, déjà appliquée)
--
-- Slice : D (Learning Cycles — formulaire trades)
-- Impact data : ZÉRO sur user_executions / user_personal_trades
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO public.user_custom_variables (variable_type, variable_value)
VALUES
  -- ── Type de Configuration (setup_type) ─────────────────────────────────────
  ('setup_type', 'A'),
  ('setup_type', 'B'),
  ('setup_type', 'C'),

  -- ── Entry Model ─────────────────────────────────────────────────────────────
  ('entry_model', 'Englobante M1'),
  ('entry_model', 'Englobante M3'),
  ('entry_model', 'Englobante M5'),
  ('entry_model', 'High-Low 3 bougies'),
  ('entry_model', 'WICK'),
  ('entry_model', 'Prise de liquidité'),

  -- ── Timing d'entrée (entry_timing) ─────────────────────────────────────────
  ('entry_timing', 'US Open 15:30'),
  ('entry_timing', 'London Close (16h)'),

  -- ── Time Frame d'entrée (entry_timeframe) ──────────────────────────────────
  ('entry_timeframe', '15s'),
  ('entry_timeframe', '30s'),
  ('entry_timeframe', 'M1'),
  ('entry_timeframe', 'M3'),
  ('entry_timeframe', 'M5'),
  ('entry_timeframe', 'M15')

ON CONFLICT DO NOTHING;
-- ON CONFLICT DO NOTHING : si une valeur existe déjà (ajoutée manuellement par l'admin),
-- elle est conservée telle quelle — aucune erreur, aucun doublon.

COMMIT;
