// ============================================
// Trial Status — Pure functions for CRM spec
// No UI dependencies. Used by Setting, Pipeline, etc.
// ============================================

import { CRMLead } from './types';

// ── Configurable thresholds (spec section 3) ──

const THRESHOLDS = {
  red: {
    ghostHours: 48,
    rules: [
      { minDay: 5, maxStep: 1, reason: (d: number) => `J${d} + pas avancé` },
      { minDay: 6, maxStep: 3, reason: (d: number) => `J${d} + pas de récolte` },
      { minDay: 7, maxStep: 4, reason: () => 'J7 + pas de trade' },
    ],
  },
  orange: {
    ghostHours: 24,
    rules: [
      { minDay: 3, maxStep: 1, reason: (d: number) => `J${d} + vidéos` },
      { minDay: 4, maxStep: 2, reason: (d: number) => `J${d} + pas de récolte` },
      { minDay: 5, maxStep: 3, reason: (d: number) => `J${d} + récolte pas finie` },
    ],
  },
};

// ── Types ──

export interface TrialDay {
  day: number;       // 1-based (J1 = premier jour)
  remaining: number; // jours restants (0 si expiré)
  expired: boolean;  // jour > 7
}

export interface TrialColor {
  color: 'red' | 'orange' | 'green';
  label: string;     // "En retard", "Ghost +48h", "On track"
  reason: string;    // Détail court
}

// ── getTrialDay ──

export function getTrialDay(lead: CRMLead): TrialDay {
  const ref = lead.date_activation_trial || lead.reviewed_at || lead.created_at;
  if (!ref) return { day: 0, remaining: 7, expired: false };

  const ms = Date.now() - new Date(ref).getTime();
  const day = Math.max(1, Math.floor(ms / 86400000) + 1);
  const remaining = Math.max(0, 7 - day);
  return { day, remaining, expired: day > 7 };
}

// ── getChecklistStep ──
// Linéaire: s'arrête au premier false

const CHECKLIST_FIELDS: (keyof CRMLead)[] = [
  'videos_en_cours',
  'videos_terminees',
  'recolte_demarree',
  'recolte_terminee',
  'trade_execute',
  'quick_win',
];

export const CHECKLIST_LABELS = [
  'Vidéos en cours',
  'Vidéos terminées',
  'Récolte démarrée',
  'Récolte terminée',
  'Trade exécuté',
  'Quick win',
];

export function getChecklistStep(lead: CRMLead): number {
  let step = 0;
  for (const field of CHECKLIST_FIELDS) {
    if (lead[field]) step++;
    else break; // linéaire: stop au premier false
  }
  return step;
}

// ── getTrialColor ──
// Spec section 3: ROUGE d'abord, puis ORANGE, sinon VERT

export function getTrialColor(lead: CRMLead): TrialColor {
  const { day } = getTrialDay(lead);
  const step = getChecklistStep(lead);

  // Heures depuis dernière interaction
  let hoursSinceInteraction = Infinity;
  if (lead.derniere_interaction) {
    hoursSinceInteraction = (Date.now() - new Date(lead.derniere_interaction).getTime()) / 3600000;
  }

  // Lead pas encore en trial (en_attente) → neutre
  if (lead.status !== 'approuvée' || day === 0) {
    return { color: 'green', label: 'En attente', reason: 'Pas encore en trial' };
  }

  // ── ROUGE (critique) ──
  if (hoursSinceInteraction > THRESHOLDS.red.ghostHours) {
    return { color: 'red', label: 'Ghost +48h', reason: `Pas de réponse depuis ${Math.floor(hoursSinceInteraction)}h` };
  }
  for (const rule of THRESHOLDS.red.rules) {
    if (day >= rule.minDay && step <= rule.maxStep) {
      return { color: 'red', label: 'Critique', reason: rule.reason(day) };
    }
  }

  // ── ORANGE (en retard) ──
  if (hoursSinceInteraction > THRESHOLDS.orange.ghostHours) {
    return { color: 'orange', label: 'Pas de réponse', reason: `+${Math.floor(hoursSinceInteraction)}h sans réponse` };
  }
  for (const rule of THRESHOLDS.orange.rules) {
    if (day >= rule.minDay && step <= rule.maxStep) {
      return { color: 'orange', label: 'En retard', reason: rule.reason(day) };
    }
  }

  // ── VERT ──
  return { color: 'green', label: 'On track', reason: `J${day} — ${step}/6 étapes` };
}

// ── Helpers ──

export function formatRelativeDate(d: string | null): string {
  if (!d) return '—';
  const ms = Date.now() - new Date(d).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "À l'instant";
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return `Il y a ${days}j`;
}

export { CHECKLIST_FIELDS };
