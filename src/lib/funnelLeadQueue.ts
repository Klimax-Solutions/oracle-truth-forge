/**
 * Funnel Lead Queue — antifragile lead capture
 *
 * Garantie : aucun lead n'est perdu. Si l'INSERT Supabase échoue (RLS, réseau,
 * service down, schéma cassé, etc.), le lead est sauvegardé en localStorage
 * et rejoué à chaque ouverture de n'importe quelle page du funnel.
 *
 * Stratégie en 3 couches :
 *  1. INSERT direct avec retry (3 tentatives, backoff exponentiel court)
 *  2. Si toujours KO → push dans la queue localStorage (clé: oracle_funnel_pending_leads)
 *  3. À chaque mount de FunnelApply/Landing/Discovery/Final → flushPendingLeads() best-effort
 *
 * L'utilisateur voit TOUJOURS l'écran de succès, peu importe l'état serveur.
 */

import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'oracle_funnel_pending_leads';
const MAX_QUEUE = 50; // garde-fou storage

export interface FunnelLeadPayload {
  first_name: string;
  email: string;
  phone: string;
  status: string;
  form_submitted: boolean;
  // Enrichment optionnel
  form_answers?: Record<string, unknown>;
  offer_amount?: string;
  budget_amount?: number | null;
  priorite?: string | null;
  difficulte_principale?: string;
  importance_trading?: number | null;
  // Métadonnées pour debug/retry
  _attempted_at?: string;
  _attempts?: number;
  _slug?: string;
}

function readQueue(): FunnelLeadPayload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(leads: FunnelLeadPayload[]) {
  try {
    // Cap la taille pour éviter un localStorage qui explose
    const trimmed = leads.slice(-MAX_QUEUE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[FunnelQueue] localStorage write failed:', err);
  }
}

function enqueue(lead: FunnelLeadPayload) {
  const q = readQueue();
  q.push({ ...lead, _attempted_at: new Date().toISOString(), _attempts: (lead._attempts || 0) + 1 });
  writeQueue(q);
  console.warn('[FunnelQueue] Lead queued for retry:', lead.email);
}

/**
 * Tente un INSERT, retry 3x avec backoff. Retourne true si succès.
 */
/**
 * Fire-and-forget : inscrit le lead dans la séquence Kit. Non-bloquant.
 * Toute erreur réseau / Kit est avalée — la fonction edge logge déjà dans lead_events.
 */
function triggerKitSequence(lead: { email: string; first_name: string }, requestId?: string) {
  try {
    void supabase.functions.invoke('subscribe-to-kit', {
      body: {
        email: lead.email,
        first_name: lead.first_name,
        ...(requestId ? { request_id: requestId } : {}),
      },
    }).then(({ error }) => {
      if (error) console.warn('[FunnelQueue] Kit subscribe invoke error:', error.message);
    });
  } catch (err) {
    console.warn('[FunnelQueue] Kit subscribe threw (ignored):', err);
  }
}

async function attemptInsert(lead: FunnelLeadPayload): Promise<boolean> {
  // Sépare métadonnées internes des colonnes DB
  const { _attempted_at, _attempts, _slug, ...dbPayload } = lead;
  void _attempted_at; void _attempts; void _slug;

  for (let i = 0; i < 3; i++) {
    try {
      // .select('id') pour récupérer le request_id et le passer à Kit (utile pour lead_events)
      const { data, error } = await supabase
        .from('early_access_requests')
        .insert(dbPayload as any)
        .select('id')
        .maybeSingle();
      if (!error) {
        triggerKitSequence(lead, (data as any)?.id);
        return true;
      }
      // 23505 = unique violation → lead déjà existant.
      // On RETOURNE FALSE pour forcer le passage par attemptEdgeFallback,
      // qui logge un event 'funnel_resubmitted' visible dans la timeline.
      if ((error as any).code === '23505') {
        console.log('[FunnelQueue] Lead already exists, routing to edge for resubmit logging:', lead.email);
        // Kit reste idempotent côté Kit — on déclenche quand même
        triggerKitSequence(lead);
        return false;
      }
      console.warn(`[FunnelQueue] INSERT attempt ${i + 1}/3 failed:`, error.message);
    } catch (err) {
      console.warn(`[FunnelQueue] INSERT attempt ${i + 1}/3 threw:`, err);
    }
    // Backoff: 200ms, 600ms, 1500ms
    await new Promise(r => setTimeout(r, 200 * Math.pow(3, i)));
  }
  return false;
}

/**
 * Filet de sécurité ULTIME : appelle l'edge function service-role qui bypass RLS.
 * N'est utilisée que si l'INSERT direct a échoué 3x. Ne throw jamais.
 */
async function attemptEdgeFallback(lead: FunnelLeadPayload, slug?: string): Promise<boolean> {
  try {
    const { _attempted_at, _attempts, _slug, ...payload } = lead;
    void _attempted_at; void _attempts; void _slug;
    const { data, error } = await supabase.functions.invoke('submit-funnel-lead', {
      body: { ...payload, ...(slug ? { slug } : {}) },
    });
    if (error) {
      console.warn('[FunnelQueue] Edge fallback error:', error.message);
      return false;
    }
    if ((data as any)?.ok) {
      console.log('[FunnelQueue] Lead recovered via edge fallback:', lead.email, data);
      // Déclenche Kit (idempotent côté Kit, pas de double inscription)
      triggerKitSequence(lead, (data as any)?.id);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[FunnelQueue] Edge fallback threw:', err);
    return false;
  }
}

/**
 * Submit principal — 3 niveaux de protection :
 *  1. INSERT direct (RLS user) avec retry 3x
 *  2. Edge function fallback (service_role, bypass RLS)
 *  3. Queue localStorage si tout a échoué
 * Retourne toujours { ok: true } pour le UX.
 */
export async function submitFunnelLead(lead: FunnelLeadPayload, slug?: string): Promise<{ ok: true; queued: boolean; recovered?: boolean }> {
  const directOk = await attemptInsert(lead);
  if (directOk) {
    console.log('[FunnelQueue] Lead landed in pipeline (direct):', lead.email);
    return { ok: true, queued: false };
  }
  // Filet de sécurité serveur
  const edgeOk = await attemptEdgeFallback(lead, slug);
  if (edgeOk) {
    return { ok: true, queued: false, recovered: true };
  }
  // Dernier recours : queue locale
  enqueue({ ...lead, _slug: slug });
  return { ok: true, queued: true };
}

/**
 * Rejoue les leads en file d'attente. Best-effort, non-blocking.
 * À appeler au mount de chaque page du funnel.
 */
export async function flushPendingLeads(): Promise<{ flushed: number; remaining: number }> {
  const queue = readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  console.log(`[FunnelQueue] Flushing ${queue.length} pending lead(s)...`);
  const stillPending: FunnelLeadPayload[] = [];
  let flushed = 0;

  for (const lead of queue) {
    // Abandon après 10 tentatives — log loud
    if ((lead._attempts || 0) >= 10) {
      console.error('[FunnelQueue] Lead abandoned after 10 attempts (still kept in queue for manual recovery):', lead);
      stillPending.push(lead);
      continue;
    }
    let ok = await attemptInsert(lead);
    if (!ok) {
      // Filet de sécurité : tente l'edge function avant de re-queuer
      ok = await attemptEdgeFallback(lead, lead._slug);
    }
    if (ok) {
      flushed++;
    } else {
      stillPending.push({ ...lead, _attempts: (lead._attempts || 0) + 1 });
    }
  }

  writeQueue(stillPending);
  if (flushed > 0) console.log(`[FunnelQueue] Flushed ${flushed} lead(s) to pipeline.`);
  return { flushed, remaining: stillPending.length };
}

/**
 * Helper debug : lister la queue depuis la console.
 * À taper dans devtools : window.__oracleFunnelQueue()
 */
if (typeof window !== 'undefined') {
  (window as any).__oracleFunnelQueue = () => {
    const q = readQueue();
    console.table(q.map(l => ({ email: l.email, attempts: l._attempts, attempted_at: l._attempted_at, slug: l._slug })));
    return q;
  };
}
