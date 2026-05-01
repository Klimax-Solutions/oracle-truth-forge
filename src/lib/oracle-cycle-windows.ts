/**
 * ORACLE TEMPORAL RULES — Source de Vérité
 * =========================================
 * Ce fichier est la référence unique pour toutes les règles de temporalité
 * qui encadrent la saisie des trades utilisateur dans Oracle.
 *
 * Toute modification de ces règles DOIT passer par ce fichier.
 * Le fichier est importé par :
 *   - UserDataEntry.tsx     (validation + guidage dans le formulaire)
 *   - OracleDatabase.tsx    (filtrage accès Oracle)
 *   - OraclePage.tsx        (passage des données)
 *   - TradeRulesDoc.tsx     (documentation admin)
 *
 * ─────────────────────────────────────────────────────────────────
 * RÈGLES GRAVÉES DANS LE MARBRE
 * ─────────────────────────────────────────────────────────────────
 *
 *  R1 · ACCÈS ORACLE LIMITÉ
 *       Un utilisateur en cours de Cycle N ne voit les trades Oracle
 *       que jusqu'au Cycle N-1 inclus.
 *       Le Cycle N d'Oracle n'est débloqué qu'après avoir complété
 *       le Cycle N côté utilisateur.
 *       Enforcement : hard — filtrage dans OracleDatabase.
 *
 *  R2 · ORDRE CHRONOLOGIQUE STRICT
 *       Chaque nouveau trade doit avoir une date ≥ au trade précédent
 *       (trade_date ET exit_date pris en compte).
 *       Enforcement : hard — validation dans handleSave de UserDataEntry.
 *
 *  R3 · CONTINUITÉ INTER-CYCLES
 *       Le premier trade d'un nouveau cycle doit être postérieur
 *       au dernier trade du cycle précédent. Le changement de cycle
 *       ne remet pas la chronologie à zéro.
 *       Enforcement : hard — corolaire de R2 (même mécanisme).
 *
 * ─────────────────────────────────────────────────────────────────
 * RÈGLE DOUCE (guidage, non-bloquante)
 * ─────────────────────────────────────────────────────────────────
 *
 *  R4 · FENÊTRE TEMPORELLE ORACLE
 *       Chaque cycle Oracle couvre une période réelle du marché
 *       (2018–2021). L'utilisateur est guidé pour reporter ses trades
 *       dans une fenêtre équivalente, décalée de son offset personnel.
 *       Tolérance : ±30 % de la durée du cycle.
 *       Au-delà : warning affiché (pas un blocage).
 *       Enforcement : soft — bandeau informatif + warning dans le formulaire.
 *
 * ─────────────────────────────────────────────────────────────────
 * COMMENT FONCTIONNE L'OFFSET PERSONNEL (R4)
 * ─────────────────────────────────────────────────────────────────
 *
 *  Exemple :
 *    Oracle Cycle 1 couvre jan–mai 2019 (150 jours).
 *    L'utilisateur a terminé son Cycle 1 en juillet 2019.
 *    → offset = +60 jours (il est en avance de 60j sur Oracle).
 *
 *  Pour son Cycle 2 :
 *    Oracle Cycle 2 couvre juin–sep 2019.
 *    Fenêtre recommandée = juin–sep 2019 + 60 jours
 *                        = août–nov 2019.
 *    Tolérance (30 %) = ±environ 36 jours.
 *    Fenêtre verte   : [~juillet 2019, ~décembre 2019]
 *    Au-delà         : warning orange.
 *
 *  L'offset se DÉPLACE avec l'utilisateur cycle après cycle.
 *  Si son cycle 2 finit encore plus tard, son offset cycle 3 sera plus grand.
 */

// ─────────────────────────────────────────────────────────────────────────────
// FRONTIÈRES DES CYCLES (par numéros de trade Oracle)
// ─────────────────────────────────────────────────────────────────────────────

export const ORACLE_CYCLE_BOUNDARIES = [
  { cycleNum: 0, name: "Ébauche", tradeStart: 1,   tradeEnd: 15  },
  { cycleNum: 1, name: "Cycle 1", tradeStart: 16,  tradeEnd: 40  },
  { cycleNum: 2, name: "Cycle 2", tradeStart: 41,  tradeEnd: 65  },
  { cycleNum: 3, name: "Cycle 3", tradeStart: 66,  tradeEnd: 90  },
  { cycleNum: 4, name: "Cycle 4", tradeStart: 91,  tradeEnd: 115 },
  { cycleNum: 5, name: "Cycle 5", tradeStart: 116, tradeEnd: 165 },
  { cycleNum: 6, name: "Cycle 6", tradeStart: 166, tradeEnd: 215 },
  { cycleNum: 7, name: "Cycle 7", tradeStart: 216, tradeEnd: 265 },
  { cycleNum: 8, name: "Cycle 8", tradeStart: 266, tradeEnd: 314 },
] as const;

// Seuils de complétion des cycles côté utilisateur.
// Un cycle i est "complété" quand userTrades >= USER_CYCLE_THRESHOLDS[i].
// SOURCE DE VÉRITÉ : ORACLE_CYCLE_BOUNDARIES ci-dessus (tradeEnd de chaque cycle).
// Ne JAMAIS modifier ces valeurs indépendamment de ORACLE_CYCLE_BOUNDARIES.
// Correspondance : max CYCLE_THRESHOLDS dans UserDataEntry doit être identique.
export const USER_CYCLE_THRESHOLDS = [15, 40, 65, 90, 115, 165, 215, 265, 314];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface OracleCycleWindow {
  cycleNum: number;
  name: string;
  /** Date ISO YYYY-MM-DD du premier trade Oracle de ce cycle */
  oracleStart: string;
  /** Date ISO YYYY-MM-DD du dernier trade Oracle de ce cycle */
  oracleEnd: string;
  /** Durée en jours entre oracleStart et oracleEnd */
  durationDays: number;
}

export interface RecommendedWindow {
  /** Date ISO de début recommandée pour l'utilisateur */
  start: string;
  /** Date ISO de fin recommandée pour l'utilisateur */
  end: string;
  /** Tolérance en jours (±) pour la zone "warning" */
  toleranceDays: number;
  /** Offset personnel de l'utilisateur en jours */
  offsetDays: number;
}

export type WindowStatus = "in_window" | "warning" | "outside" | "unknown";

// ─────────────────────────────────────────────────────────────────────────────
// FONCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dérive les fenêtres calendaires Oracle à partir des trades Oracle réels.
 * À appeler avec le tableau `trades` passé à OracleDatabase/OraclePage.
 */
export function deriveOracleCycleWindows(
  oracleTrades: { trade_number: number; trade_date: string }[]
): OracleCycleWindow[] {
  return ORACLE_CYCLE_BOUNDARIES.map((b) => {
    const cycleTrades = oracleTrades
      .filter((t) => t.trade_number >= b.tradeStart && t.trade_number <= b.tradeEnd)
      .sort((a, c) => a.trade_date.localeCompare(c.trade_date));

    const oracleStart = cycleTrades[0]?.trade_date ?? "";
    const oracleEnd   = cycleTrades[cycleTrades.length - 1]?.trade_date ?? "";

    const durationDays =
      oracleStart && oracleEnd
        ? Math.round(
            (new Date(oracleEnd).getTime() - new Date(oracleStart).getTime()) /
              86_400_000
          )
        : 0;

    return {
      cycleNum: b.cycleNum,
      name: b.name,
      oracleStart,
      oracleEnd,
      durationDays,
    };
  });
}

/**
 * R1 — Retourne le numéro de trade Oracle maximum visible pour un utilisateur
 * ayant `totalUserTrades` trades saisis.
 *
 * Règle §0.3a (DANS LE MARBRE) — l'Ébauche (trades 1-15) est en accès DIRECT
 * dès J1, indépendamment du nombre de trades saisis. Le membre doit pouvoir
 * voir les 15 trades de référence pour les recopier.
 *
 * Au-delà : R1 standard — l'utilisateur voit les cycles précédents au fur et
 * à mesure qu'il atteint les seuils USER_CYCLE_THRESHOLDS.
 */
export function getOracleAccessLimit(totalUserTrades: number): number {
  // Plancher : Ébauche toujours visible (§0.3a)
  let maxOracleTrade = ORACLE_CYCLE_BOUNDARIES[0].tradeEnd; // 15
  for (let i = 0; i < USER_CYCLE_THRESHOLDS.length; i++) {
    if (totalUserTrades >= USER_CYCLE_THRESHOLDS[i]) {
      const boundary = ORACLE_CYCLE_BOUNDARIES[i];
      if (boundary) maxOracleTrade = boundary.tradeEnd;
    } else {
      break;
    }
  }
  return maxOracleTrade;
}

/**
 * Retourne le numéro de cycle (0 = Ébauche) dans lequel l'utilisateur
 * se trouve actuellement, basé sur son nombre de trades saisis.
 */
export function getUserCurrentCycleNum(totalUserTrades: number): number {
  for (let i = 0; i < USER_CYCLE_THRESHOLDS.length; i++) {
    if (totalUserTrades < USER_CYCLE_THRESHOLDS[i]) return i;
  }
  return USER_CYCLE_THRESHOLDS.length; // tous cycles complétés
}

/**
 * R2 + R3 — Retourne la date minimale autorisée pour un nouveau trade,
 * en prenant le maximum de toutes les dates (trade_date + exit_date)
 * des trades déjà saisis.
 */
export function getMinTradeDate(
  existingTrades: { trade_date: string; exit_date?: string | null }[]
): string | null {
  if (existingTrades.length === 0) return null;
  let maxDate = "";
  for (const t of existingTrades) {
    if (t.exit_date && t.exit_date > maxDate) maxDate = t.exit_date;
    if (t.trade_date > maxDate) maxDate = t.trade_date;
  }
  return maxDate || null;
}

/**
 * R4 — Calcule l'offset personnel de l'utilisateur en jours,
 * défini comme la différence entre la date du dernier trade saisi
 * dans le cycle précédent et la date de fin Oracle de ce même cycle.
 */
export function computeUserOffset(
  currentCycleNum: number,
  oracleWindows: OracleCycleWindow[],
  userTrades: { trade_number: number; trade_date: string; exit_date?: string | null }[],
  userCycleThresholds: number[] = USER_CYCLE_THRESHOLDS
): number {
  if (currentCycleNum === 0 || userTrades.length === 0) return 0;

  const prevCycleWindow = oracleWindows.find(
    (w) => w.cycleNum === currentCycleNum - 1
  );
  if (!prevCycleWindow?.oracleEnd) return 0;

  // Trades de l'utilisateur dans le cycle précédent
  const prevCycleStart = currentCycleNum === 1 ? 1 : userCycleThresholds[currentCycleNum - 2] + 1;
  const prevCycleEnd   = userCycleThresholds[currentCycleNum - 1];

  const prevCycleTrades = userTrades.filter(
    (t) => t.trade_number >= prevCycleStart && t.trade_number <= prevCycleEnd
  );
  if (prevCycleTrades.length === 0) return 0;

  const lastUserDate = prevCycleTrades
    .map((t) => t.exit_date || t.trade_date)
    .sort()
    .at(-1)!;

  return Math.round(
    (new Date(lastUserDate).getTime() -
      new Date(prevCycleWindow.oracleEnd).getTime()) /
      86_400_000
  );
}

/**
 * R4 — Calcule la fenêtre recommandée pour le cycle courant,
 * en appliquant l'offset personnel sur la fenêtre Oracle.
 */
export function getRecommendedWindow(
  cycleNum: number,
  oracleWindows: OracleCycleWindow[],
  userOffsetDays: number
): RecommendedWindow | null {
  const window = oracleWindows.find((w) => w.cycleNum === cycleNum);
  if (!window?.oracleStart || !window?.oracleEnd) return null;

  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  const toleranceDays = Math.max(7, Math.round(window.durationDays * 0.3));

  return {
    start: addDays(window.oracleStart, userOffsetDays),
    end:   addDays(window.oracleEnd,   userOffsetDays),
    toleranceDays,
    offsetDays: userOffsetDays,
  };
}

/**
 * R4 — Détermine si une date est dans la fenêtre recommandée.
 */
export function checkDateInWindow(
  date: string,
  rw: RecommendedWindow
): WindowStatus {
  if (!date || !rw.start || !rw.end) return "unknown";

  const t = new Date(date).getTime();
  const inner = {
    start: new Date(rw.start).getTime() - rw.toleranceDays * 86_400_000,
    end:   new Date(rw.end).getTime()   + rw.toleranceDays * 86_400_000,
  };
  const outer = {
    start: new Date(rw.start).getTime() - rw.toleranceDays * 2 * 86_400_000,
    end:   new Date(rw.end).getTime()   + rw.toleranceDays * 2 * 86_400_000,
  };

  if (t >= inner.start && t <= inner.end) return "in_window";
  if (t >= outer.start && t <= outer.end) return "warning";
  return "outside";
}

/** Formate une date ISO en "MMM YYYY" (ex: "Jan 2019") */
export function formatDateShort(isoDate: string): string {
  if (!isoDate) return "—";
  return new Date(isoDate).toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTATION DES RÈGLES (pour affichage admin + utilisateur)
// ─────────────────────────────────────────────────────────────────────────────

export const TRADE_ENTRY_RULE_DOCS = [
  {
    id: "R1",
    title: "Accès Oracle limité au cycle précédent",
    description:
      "Un utilisateur en cours de Cycle N ne peut voir les trades Oracle que jusqu'au Cycle N-1 inclus. Les trades Oracle du Cycle N sont masqués jusqu'à la validation complète du Cycle N côté utilisateur.",
    type: "hard" as const,
    enforcement: "Filtrage automatique dans l'onglet Oracle Vérif",
  },
  {
    id: "R2",
    title: "Ordre chronologique strict (intra-cycle)",
    description:
      "Chaque trade saisi doit avoir une date d'entrée (et de sortie) supérieure ou égale à celle du trade précédent. Il est impossible de saisir un trade antérieur au dernier trade saisi.",
    type: "hard" as const,
    enforcement: "Validation au moment de l'enregistrement + date minimale dans le calendrier",
  },
  {
    id: "R3",
    title: "Continuité inter-cycles",
    description:
      "Le premier trade d'un nouveau cycle doit être postérieur au dernier trade du cycle précédent. Le changement de cycle ne remet pas la chronologie à zéro — l'ordre temporel est continu sur toute la trajectoire.",
    type: "hard" as const,
    enforcement: "Corolaire de R2 — même mécanisme de date minimale",
  },
  {
    id: "R4",
    title: "Fenêtre temporelle Oracle (guidage doux)",
    description:
      "Chaque cycle Oracle couvre une période réelle du marché (2018–2021, cycles de quelques mois). L'utilisateur est guidé pour reporter ses trades dans une fenêtre équivalente, décalée de son offset personnel (= écart accumulé entre ses dates et celles d'Oracle cycle après cycle). Tolérance : ±30 % de la durée du cycle. Au-delà, un avertissement est affiché. Ce n'est pas un blocage.",
    type: "soft" as const,
    enforcement: "Bandeau informatif + warning orange dans le formulaire de saisie",
    tolerancePercent: 30,
  },
] as const;
