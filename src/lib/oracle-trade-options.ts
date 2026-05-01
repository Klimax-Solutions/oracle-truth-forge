/**
 * ORACLE TRADE OPTIONS — Whitelist d'origine (référence historique)
 * ===================================================================
 *
 * Ce fichier est une **référence documentaire**, pas une source de gating.
 * Il préserve la mémoire des options Oracle d'origine, hardcodées avant
 * le commit `7a9eb6c` (2026-04-29) qui les a migrées en DB.
 *
 * Utilité :
 *   1. Auditer la pollution éventuelle dans `user_custom_variables` (user_id IS NULL)
 *      après la migration destructive #27 (2026-04-29) qui a fusionné les options
 *      perso de tous les users dans le pool global (UPDATE user_id → NULL).
 *   2. Permettre à l'admin de "revert" propre s'il souhaite nettoyer la DB
 *      pour ne garder que les options Oracle officielles.
 *   3. Servir de source de vérité documentaire pour les évolutions futures.
 *
 * Le code applicatif (TradeEntryDialog) ne lit PAS ce fichier — il s'appuie
 * sur `user_custom_variables` (DB, admin-managed). Cette whitelist est un
 * doublon volontaire à des fins de mémoire/audit.
 *
 * ─────────────────────────────────────────────────────────────────────
 * RÈGLE DANS LE MARBRE (CLAUDE.md §13, 2026-05-01) :
 *
 * Mode Oracle (TradeEntryDialog mode="oracle") :
 *   - globalOptions   = user_custom_variables WHERE user_id IS NULL (DB)
 *   - personalOptions = []  ← user ne peut JAMAIS ajouter de perso pour Oracle
 *   - canManage       = isAdmin (admin garde la main complète sur la liste DB)
 *
 * Mode Personal (TradeEntryDialog mode="personal", trades persos = backtesting/live) :
 *   - globalOptions   = user_custom_variables WHERE user_id IS NULL (DB)
 *   - personalOptions = user_custom_variables WHERE user_id = auth.uid()
 *   - canManage       = true (user → ajoute en perso, admin → ajoute en global)
 * ─────────────────────────────────────────────────────────────────────
 *
 * Source des constantes : commits `de2cb6b` (création OracleTradeDialog)
 * jusqu'à `7a9eb6c~1` (juste avant la migration en DB).
 *
 * Champs sans whitelist d'origine (toujours DB-managed depuis le début) :
 *   - sl_placement
 *   - tp_placement
 *   - direction_structure
 */

export const ORACLE_TRADE_OPTIONS_ORIGINAL = {
  setup_type: ["A", "B", "C"],

  entry_model: [
    "Englobante M1",
    "Englobante M3",
    "Englobante M5",
    "High-Low 3 bougies",
    "WICK",
    "Prise de liquidité",
  ],

  entry_timing: [
    "US Open 15:30",
    "London Close (16h)",
  ],

  entry_timeframe: ["15s", "30s", "M1", "M3", "M5", "M15"],
} as const;

/**
 * Whitelists associées aux widgets screenshots (pas aux dropdowns du dialog
 * principal). Conservées ici pour documentation, mais non gatées en code.
 */
export const ORACLE_SCREENSHOT_OPTIONS_ORIGINAL = {
  context_timeframe: ["H4", "H1", "M15"],
  entry_tf_screenshot: ["M15", "M5", "M3", "M1", "30s", "15s", "5s"],
} as const;

/**
 * Variables sans whitelist d'origine — confirmé après remontée jusqu'au
 * premier commit OracleTradeDialog (de2cb6b). Ces champs ont toujours été
 * entièrement DB-managed.
 */
export const ORACLE_DB_ONLY_FIELDS = [
  "sl_placement",
  "tp_placement",
  "direction_structure",
] as const;
