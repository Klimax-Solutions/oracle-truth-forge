// ============================================
// CRM Lead — Source de verite unique
// Utilise par: CRMDashboard, AgendaTab, LeadDetailModal
// ============================================

/**
 * Champs de base de early_access_requests.
 * Tous les composants CRM importent ce type.
 */
export interface CRMLead {
  // Identite
  id: string;
  first_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  user_id: string | null;

  // Pipeline
  contacted: boolean;
  contacted_at: string | null;   // premier contact setter (WA/email) — MIG 20260423000000
  contact_method: string | null; // 'whatsapp' | 'email' | 'opt_in_call'
  form_submitted: boolean;
  call_booked: boolean;
  call_done: boolean;
  call_done_at: string | null;   // timestamp quand closer toggle call_done=true — MIG 20260423100000

  // Equipe
  setter_name: string | null;
  closer_name: string | null;

  // Call scheduling (Cal.com webhook)
  call_scheduled_at: string | null;
  call_scheduled_duration: number | null;
  call_meeting_url: string | null;
  call_rescheduled_at: string | null;

  // Call outcome — valeurs canoniques sauvées par LeadDetailModal:
  // 'vendu' | 'contracte_en_attente' | 'pas_vendu' | 'rappel'
  call_outcome: string | null;
  call_debrief: string | null;
  call_no_show: boolean;

  // Closing
  offer_amount: string | null;
  checkout_unlocked: boolean;
  paid_amount: number | null;
  paid_at: string | null;

  // Spec CRM: form-derived fields
  budget_amount: number | null;
  priorite: string | null;           // 'P1' | 'P2' | 'P3'
  importance_trading: number | null; // 1-10
  difficulte_principale: string | null;
  form_answers: Record<string, string>;

  // Spec CRM: checklist 6 étapes (auto-computed depuis enrichissement)
  videos_en_cours: boolean;
  videos_terminees: boolean;
  recolte_demarree: boolean;
  recolte_terminee: boolean;
  trade_execute: boolean;
  quick_win: boolean;

  // Spec CRM: setting daily
  contacte_aujourdhui: boolean;
  derniere_interaction: string | null;
  brief_closer: string | null;
  date_activation_trial: string | null;

  // Spec CRM: post-call / post-trial
  raison_perdu: string | null;
  // 'actif' = trial en cours | 'expire' = J>7 | 'non_applicable' = pas encore approuvé
  statut_trial: 'actif' | 'expire' | 'non_applicable';
  raison_non_closing: string | null;
  rappel_date: string | null;
  rappel_note: string | null;

  // Archive (soft-hide du pipeline) — MIG 20260426100000
  archived_at?: string | null;
  archived_by?: string | null;
  archive_reason?: string | null;

  /** Lead antérieur à la relance funnel du 26/04/2026 21h30 — calculé client-side depuis created_at */
  is_pre_relaunch?: boolean;

  // Enrichissement (optionnel, rempli en background apres le 1er rendu)
  is_online?: boolean;
  session_count?: number;
  execution_count?: number;
  video_view_count?: number;
  expires_at?: string | null;
  early_access_type?: string | null;
  /** true si user_roles contient role='member' — couvre les anciens membres antérieurs à closed_won */
  is_member?: boolean;
  /** Dernière connexion réelle (profiles.last_login_at, mis à jour à chaque SIGNED_IN) */
  last_login_at?: string | null;
}

/**
 * Stages du pipeline CRM.
 */
export type StageFilter = 'all' | 'pending' | 'approved' | 'contacted' | 'call_booked' | 'call_done' | 'paid' | 'archived' | 'a_contacter' | 'expirent' | 'expires';

/**
 * Determine le stage d'un lead.
 * Ordre de priorité: paid > call_done > call_booked > contacted > approved > pending
 */
export function getStage(l: CRMLead): StageFilter {
  if (l.paid_at) return 'paid';
  if (l.call_done) return 'call_done';
  if (l.call_booked) return 'call_booked';
  if (l.contacted) return 'contacted';
  if (l.status === 'approuvée') return 'approved';
  return 'pending';
}

/**
 * Map une row Supabase (any) vers CRMLead.
 * Centralise les defaults pour eviter les divergences entre composants.
 * Appelé par CRMDashboard, AgendaTab, et tout composant qui charge des leads.
 */
export function mapRowToCRMLead(r: any, enrich?: {
  activityMap?: Record<string, any>;
  sessionMap?: Record<string, number>;
  execMap?: Record<string, number>;
  rolesMap?: Record<string, any>;
  videoViewMap?: Record<string, number>;
  memberSet?: Set<string>;
  lastLoginMap?: Record<string, string | null>;
}): CRMLead {
  const videoViews = enrich?.videoViewMap?.[r.user_id] || 0;
  const execCount = enrich?.execMap?.[r.user_id] || 0;

  return {
    id: r.id,
    first_name: r.first_name || '',
    email: r.email || '',
    phone: r.phone || '',
    status: r.status || 'en_attente',
    created_at: r.created_at,
    reviewed_at: r.reviewed_at || null,
    user_id: r.user_id || null,
    contacted: r.contacted || false,
    contacted_at: r.contacted_at || null,
    contact_method: r.contact_method || null,
    form_submitted: r.form_submitted || false,
    call_booked: r.call_booked || false,
    call_done: r.call_done || false,
    call_done_at: r.call_done_at || null,
    setter_name: r.setter_name || null,
    closer_name: r.closer_name || null,
    call_scheduled_at: r.call_scheduled_at || null,
    call_scheduled_duration: r.call_scheduled_duration ?? 30,
    call_meeting_url: r.call_meeting_url || null,
    call_rescheduled_at: r.call_rescheduled_at || null,
    call_outcome: r.call_outcome || null,
    call_debrief: r.call_debrief || null,
    call_no_show: r.call_no_show || false,
    offer_amount: r.offer_amount || null,
    checkout_unlocked: r.checkout_unlocked || false,
    paid_amount: r.paid_amount || null,
    paid_at: r.paid_at || null,
    budget_amount: r.budget_amount || null,
    priorite: r.priorite || null,
    importance_trading: r.importance_trading || null,
    difficulte_principale: r.difficulte_principale || null,
    form_answers: r.form_answers || {},
    // Checklist: auto-computed depuis l'enrichissement, fallback aux champs DB
    videos_en_cours: r.videos_en_cours || videoViews > 0,
    videos_terminees: r.videos_terminees || videoViews >= 5,
    recolte_demarree: r.recolte_demarree || execCount > 0,
    recolte_terminee: r.recolte_terminee || execCount >= 10,
    trade_execute: r.trade_execute || execCount > 0,
    quick_win: r.quick_win || false,
    contacte_aujourdhui: r.contacte_aujourdhui || false,
    derniere_interaction: r.derniere_interaction || null,
    brief_closer: r.brief_closer || null,
    // date_activation_trial: fallback sur reviewed_at si non renseigné
    date_activation_trial: r.date_activation_trial || r.reviewed_at || null,
    raison_perdu: r.raison_perdu || null,
    // statut_trial recalculé client-side (jamais mis à jour en DB par Supabase).
    // 'non_applicable' pour les leads pas encore approuvés — évite qu'ils
    // apparaissent dans les filtres trial (à_contacter, expirent, expirés).
    statut_trial: (() => {
      if (r.status !== 'approuvée') return 'non_applicable';
      const ref = r.date_activation_trial || r.reviewed_at;
      if (!ref) return 'actif';
      const dayElapsed = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000) + 1;
      return dayElapsed > 7 ? 'expire' : 'actif';
    })(),
    raison_non_closing: r.raison_non_closing || null,
    rappel_date: r.rappel_date || null,
    rappel_note: r.rappel_note || null,
    archived_at: r.archived_at || null,
    archived_by: r.archived_by || null,
    archive_reason: r.archive_reason || null,
    is_pre_relaunch: r.created_at ? new Date(r.created_at) < new Date("2026-04-26T21:30:00") : false,
    is_online: enrich?.activityMap?.[r.user_id]?.is_active || false,
    session_count: enrich?.sessionMap?.[r.user_id] || 0,
    execution_count: execCount,
    video_view_count: videoViews,
    expires_at: enrich?.rolesMap?.[r.user_id]?.expires_at || null,
    early_access_type: enrich?.rolesMap?.[r.user_id]?.early_access_type || null,
    is_member: enrich?.memberSet?.has(r.user_id) || r.status === 'closed_won' || !!r.paid_at,
    last_login_at: enrich?.lastLoginMap?.[r.user_id] ?? null,
  };
}

/**
 * Styles visuels des outcomes de call.
 * Valeurs canoniques — alignées avec ce que LeadDetailModal sauvegarde en DB.
 */
export const CALL_OUTCOME_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  vendu:                { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Vendu' },
  contracte_en_attente: { bg: 'bg-violet-500/15',  text: 'text-violet-400',  border: 'border-violet-500/30',  label: 'Contracté' },
  pas_vendu:            { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'Pas vendu' },
  rappel:               { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',   label: 'Rappel' },
};
