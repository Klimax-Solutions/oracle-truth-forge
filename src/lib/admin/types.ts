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
  contact_method: string | null;
  form_submitted: boolean;
  call_booked: boolean;
  call_done: boolean;

  // Equipe
  setter_name: string | null;
  closer_name: string | null;

  // Call scheduling
  call_scheduled_at: string | null;
  call_scheduled_duration: number | null;
  call_meeting_url: string | null;
  call_rescheduled_at: string | null;

  // Call outcome
  call_outcome: string | null;
  call_debrief: string | null;
  call_no_show: boolean;

  // Closing
  offer_amount: string | null;
  checkout_unlocked: boolean;
  paid_amount: number | null;
  paid_at: string | null;

  // Enrichissement (optionnel, rempli en background)
  is_online?: boolean;
  session_count?: number;
  execution_count?: number;
  expires_at?: string | null;
  early_access_type?: string | null;
}

/**
 * Stages du pipeline CRM.
 */
export type StageFilter = 'all' | 'pending' | 'approved' | 'contacted' | 'call_booked' | 'call_done' | 'paid';

/**
 * Determine le stage d'un lead.
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
 * Centralise les defaults pour eviter les divergences.
 */
export function mapRowToCRMLead(r: any, enrich?: {
  activityMap?: Record<string, any>;
  sessionMap?: Record<string, number>;
  execMap?: Record<string, number>;
  rolesMap?: Record<string, any>;
}): CRMLead {
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
    contact_method: r.contact_method || null,
    form_submitted: r.form_submitted || false,
    call_booked: r.call_booked || false,
    call_done: r.call_done || false,
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
    is_online: enrich?.activityMap?.[r.user_id]?.is_active || false,
    session_count: enrich?.sessionMap?.[r.user_id] || 0,
    execution_count: enrich?.execMap?.[r.user_id] || 0,
    expires_at: enrich?.rolesMap?.[r.user_id]?.expires_at || null,
    early_access_type: enrich?.rolesMap?.[r.user_id]?.early_access_type || null,
  };
}

/**
 * Styles des outcomes de call.
 */
export const CALL_OUTCOME_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  contracted: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30', label: 'Contracte' },
  closing_in_progress: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'En cours' },
  not_closed: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', label: 'Non close' },
};
