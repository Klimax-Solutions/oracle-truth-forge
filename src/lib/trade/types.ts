/**
 * src/lib/trade/types.ts
 *
 * Types partagés pour les composants Trade UI (TradeExpandCard, TradeEntryDialog).
 *
 * RÈGLE ABSOLUE : aucune perte de données.
 * On n'utilise PAS un type normalisé — on utilise un discriminated union
 * qui préserve intégralement chaque type original.
 *
 * Spec : docs/trade-ui-components-2026-04-30.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// ORACLE — user_executions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors `user_executions` DB Row (+ trade_number from Oracle trades table).
 * Champs communs avec PersonalTrade : direction, rr, trade_date, entry_time,
 * result, setup_type, notes, entry_model, direction_structure, entry_timing,
 * entry_timeframe, context_timeframe, sl_placement, tp_placement,
 * stop_loss_size, entry_price, exit_price, stop_loss, take_profit, exit_date,
 * exit_time, trade_duration, news_day, news_label, screenshot_url,
 * screenshot_entry_url.
 *
 * Champs spécifiques Oracle : trade_number (numéro Oracle 1-314), notes.
 */
export interface OracleExecution {
  // ── Identifiants ──────────────────────────────────────────────────────────
  id: string;
  trade_number: number;            // Numéro Oracle (1-314)

  // ── Champs communs ────────────────────────────────────────────────────────
  trade_date: string;
  direction: "Long" | "Short";
  direction_structure: string | null;
  entry_time: string | null;
  exit_time: string | null;
  exit_date: string | null;
  trade_duration: string | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  stop_loss_size: string | null;
  rr: number | null;
  result: "Win" | "Loss" | "BE" | string | null;
  setup_type: string | null;
  entry_timing: string | null;
  entry_model: string | null;
  entry_timeframe: string | null;
  context_timeframe: string | null;
  sl_placement: string | null;
  tp_placement: string | null;
  news_day: boolean | null;
  news_label: string | null;
  screenshot_url: string | null;
  screenshot_entry_url: string | null;

  // ── Spécifique Oracle ─────────────────────────────────────────────────────
  notes: string | null;

  // ── Méta DB (optionnel — présent sur les rows complètes) ──────────────────
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAL — user_personal_trades
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors `user_personal_trades` DB Row.
 * Champs spécifiques Personal : asset, day_of_week, session_id,
 * screenshot_context_url, chart_link, comment, custom_setup_id,
 * speculation_hl_valid, target_hl_valid, target_timing.
 */
export interface PersonalTrade {
  // ── Identifiants ──────────────────────────────────────────────────────────
  id: string;
  trade_number: number;
  session_id: string | null;

  // ── Champs communs ────────────────────────────────────────────────────────
  trade_date: string;
  direction: string;
  direction_structure: string | null;
  entry_time: string | null;
  exit_time: string | null;
  exit_date: string | null;
  trade_duration: string | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  stop_loss_size: string | null;
  rr: number | null;
  result: string | null;
  setup_type: string | null;
  entry_timing: string | null;
  entry_model: string | null;
  entry_timeframe: string | null;
  context_timeframe: string | null;
  sl_placement: string | null;
  tp_placement: string | null;
  news_day: boolean | null;
  news_label: string | null;
  screenshot_url: string | null;
  screenshot_entry_url: string | null;

  // ── Spécifique Personal ───────────────────────────────────────────────────
  asset: string | null;
  day_of_week: string;
  screenshot_context_url: string | null;
  chart_link: string | null;
  comment: string | null;
  custom_setup_id: string | null;
  speculation_hl_valid: boolean | null;
  target_hl_valid: boolean | null;
  target_timing: string | null;

  // ── Méta DB (optionnel — présent sur les rows complètes) ──────────────────
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCRIMINATED UNION — source de vérité partagée
// ─────────────────────────────────────────────────────────────────────────────

export type OracleTradeCard   = OracleExecution & { kind: "oracle" };
export type PersonalTradeCard = PersonalTrade   & { kind: "personal" };

/**
 * Type unifié pour tous les composants Trade UI (TradeExpandCard, TradeEntryDialog).
 *
 * Usage :
 *   if (trade.kind === "oracle")   → accès aux champs OracleExecution
 *   if (trade.kind === "personal") → accès aux champs PersonalTrade
 *
 * Garantie : aucun champ perdu. Tous les champs originaux accessibles
 * derrière le type guard correspondant.
 */
export type TradeCardData = OracleTradeCard | PersonalTradeCard;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

export function isOracleTrade(trade: TradeCardData): trade is OracleTradeCard {
  return trade.kind === "oracle";
}

export function isPersonalTrade(trade: TradeCardData): trade is PersonalTradeCard {
  return trade.kind === "personal";
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — conversions depuis les types source
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ajoute le discriminant `kind` à un OracleExecution.
 * Utilisé dans UserDataEntry.tsx pour passer les trades à TradeExpandCard.
 *
 * Aucun champ n'est perdu — c'est un spread pur.
 */
export function toOracleTradeCard(trade: OracleExecution): OracleTradeCard {
  return { ...trade, kind: "oracle" };
}

/**
 * Ajoute le discriminant `kind` à un PersonalTrade.
 * Utilisé dans SetupPerso.tsx pour passer les trades à TradeExpandCard.
 *
 * Aucun champ n'est perdu — c'est un spread pur.
 */
export function toPersonalTradeCard(trade: PersonalTrade): PersonalTradeCard {
  return { ...trade, kind: "personal" };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAMPS COMMUNS — accès sans guard (utilitaire)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Champs disponibles sur les deux types sans type guard.
 * Utile pour les parties du UI communes (header compact, mini-charts).
 */
export type TradeCommonFields = {
  id: string;
  trade_number: number;
  trade_date: string;
  direction: string;
  rr: number | null;
  result: string | null;
  entry_time: string | null;
  setup_type: string | null;
};

/**
 * Extrait les champs communs d'un TradeCardData.
 * Utile pour le header compact de TradeExpandCard.
 */
export function getCommonFields(trade: TradeCardData): TradeCommonFields {
  return {
    id:           trade.id,
    trade_number: trade.trade_number,
    trade_date:   trade.trade_date,
    direction:    trade.direction,
    rr:           trade.rr,
    result:       trade.result,
    entry_time:   trade.entry_time,
    setup_type:   trade.setup_type,
  };
}
