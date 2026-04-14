import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FunnelConfig {
  id: string;
  tenant_id: string;
  // Landing
  landing_headline: string;
  landing_headline_accent: string;
  landing_subtitle: string;
  landing_cta_text: string;
  landing_cta_subtext: string;
  landing_footer_text: string;
  // Apply
  apply_headline: string;
  apply_subtitle: string;
  apply_social_proof_enabled: boolean;
  apply_social_proof_text: string;
  apply_form_questions: any[];
  apply_form_name_label: string;
  apply_form_phone_label: string;
  apply_form_email_label: string;
  // Discovery
  discovery_badge_text: string;
  discovery_headline: string;
  discovery_headline_personalized: string;
  discovery_subtitle: string;
  discovery_cta_title: string;
  discovery_cta_subtitle: string;
  discovery_cta_button: string;
  discovery_cal_link: string;
  // Final
  final_badge_text: string;
  final_headline_personalized: string;
  final_headline_confirmation: string;
  final_headline_accent: string;
  final_step1_title: string;
  final_step1_congrats: string;
  final_step1_instructions: string;
  final_step1_details: string;
  final_step1_warning_title: string;
  final_step1_warning_text: string;
  final_step1_warning_consequence: string;
  final_step2_title: string;
  final_step2_placeholder: string;
  final_step2_subtext: string;
  // Blocks
  landing_blocks: any[];
  apply_blocks: any[];
  discovery_blocks: any[];
  final_blocks: any[];
  // VSL
  vsl_enabled: boolean;
  vsl_provider: string;
  vsl_embed_code: string;
  vsl_page: string;
  vsl_cta_delay_seconds: number;
  // Branding
  brand_name: string;
  brand_footer_text: string;
}

const DEFAULT_CONFIG: Omit<FunnelConfig, 'id' | 'tenant_id'> = {
  landing_headline: 'Titre principal',
  landing_headline_accent: 'Accroche',
  landing_subtitle: 'Sous-titre descriptif de votre offre',
  landing_cta_text: 'Commencer',
  landing_cta_subtext: 'Sous-texte CTA',
  landing_footer_text: 'Description footer',
  apply_headline: 'Dépose ta candidature pour accéder au protocole.',
  apply_subtitle: '',
  apply_social_proof_enabled: false,
  apply_social_proof_text: '',
  apply_form_questions: [
    {
      id: "main_objective",
      title: "Quel est ton objectif principal avec le trading actuellement ?",
      options: [
        { label: "Obtenir mon premier paiement de Prop Firm", disqualifying: false },
        { label: "Devenir rentable de manière constante", disqualifying: false },
        { label: "Atteindre les 6 chiffres grâce au trading", disqualifying: false }
      ]
    },
    {
      id: "time_commitment",
      title: "Sur une échelle de 1 à 10, à quel point es-tu prêt à consacrer du temps au trading ?",
      options: [
        { label: "1-3 (Je ne peux pas t'aider)", disqualifying: true },
        { label: "3-5", disqualifying: false },
        { label: "5-7 (Ce n'est pas ta priorité absolue)", disqualifying: false },
        { label: "7-9", disqualifying: false },
        { label: "10 (Tu as besoin que ça marche immédiatement)", disqualifying: false }
      ]
    },
    {
      id: "experience_level",
      title: "Quel est ton niveau d'expérience actuel en trading ?",
      options: [
        { label: "Débutant complet (0-3 mois)", disqualifying: false },
        { label: "Débutant (3-12 mois)", disqualifying: false },
        { label: "Intermédiaire (1-2 ans et +)", disqualifying: false }
      ]
    },
    {
      id: "is_profitable",
      title: "Es-tu actuellement rentable ?",
      options: [
        { label: "Oui, je suis rentable", disqualifying: false },
        { label: "À l'équilibre (Break-even)", disqualifying: false },
        { label: "Non, je perds de l'argent", disqualifying: false }
      ]
    },
    {
      id: "main_difficulty",
      title: "Quelle est ta PLUS GRANDE difficulté en trading actuellement ?",
      options: [
        { label: "Trouver une stratégie qui fonctionne", disqualifying: false },
        { label: "Psychologie et discipline", disqualifying: false },
        { label: "Gestion du risque (Risk Management)", disqualifying: false }
      ]
    },
    {
      id: "ultimate_goal",
      title: "Quel est ton but ultime avec le trading ?",
      options: [
        { label: "Arrêter les études", disqualifying: false },
        { label: "Quitter mon job", disqualifying: false },
        { label: "Liberté financière, temporelle et géographique", disqualifying: false },
        { label: "J'ai déjà tout cela (je souhaite juste en apprendre davantage)", disqualifying: false }
      ]
    },
    {
      id: "work_status",
      title: "Quelle est ta situation actuelle ?",
      options: [
        { label: "Salarié", disqualifying: false },
        { label: "Indépendant", disqualifying: false },
        { label: "Étudiant", disqualifying: false },
        { label: "Trader à temps plein", disqualifying: false }
      ]
    },
    {
      id: "investment_amount",
      title: "Quel montant as-tu de côté pour investir afin de devenir rentable ?",
      options: [
        { label: "< 1 000 € (Je ne peux pas t'aider)", disqualifying: true },
        { label: "1 000 € - 3 000 €", disqualifying: false },
        { label: "3 000 € - 5 000 €", disqualifying: false },
        { label: "5 000 € - 10 000 €", disqualifying: false }
      ]
    }
  ],
  apply_form_name_label: "Comment tu t'appelles ?",
  apply_form_phone_label: 'Sur quel numéro te joindre ?',
  apply_form_email_label: 'Quelle est ton adresse email ?',
  discovery_badge_text: 'Candidature acceptée',
  discovery_headline: 'Titre de la page discovery',
  discovery_headline_personalized: 'Bienvenue',
  discovery_subtitle: "Sous-titre encourageant la réservation d'appel",
  discovery_cta_title: 'Choisis ton créneau',
  discovery_cta_subtitle: 'Appel stratégique de 30 min',
  discovery_cta_button: 'Réserver mon appel',
  discovery_cal_link: '',
  final_badge_text: 'Confirmé',
  final_headline_personalized: 'Bravo',
  final_headline_confirmation: 'ton appel est',
  final_headline_accent: 'réservé',
  final_step1_title: 'Confirme ta présence',
  final_step1_congrats: 'Félicitations !',
  final_step1_instructions: 'Tu recevras un email de confirmation avec les détails.',
  final_step1_details: "Assure-toi d'être disponible à l'heure prévue.",
  final_step1_warning_title: 'Important',
  final_step1_warning_text: 'Merci de prévenir 24h à l\'avance si tu ne peux pas être présent.',
  final_step1_warning_consequence: 'En cas de non-présentation, ton accès sera annulé.',
  final_step2_title: "Une question avant l'appel ?",
  final_step2_placeholder: 'Écris ta question ici...',
  final_step2_subtext: 'Tu recevras une réponse avant ton appel.',
  landing_blocks: [],
  apply_blocks: [],
  discovery_blocks: [],
  final_blocks: [],
  vsl_enabled: false,
  vsl_provider: 'vidalytics',
  vsl_embed_code: '',
  vsl_page: 'discovery',
  brand_name: 'Oracle',
  brand_footer_text: '© {year} Oracle. Tous droits réservés.',
};

/**
 * Hook for funnel pages to load config by slug.
 * Resolves slug → funnel_id → funnel_config.
 * Falls back to first available config if no slug provided.
 */
export function useFunnelConfig(slug?: string) {
  const [config, setConfig] = useState<FunnelConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (slug) {
          // Resolve slug → funnel → config
          const { data: funnel } = await supabase
            .from('funnels')
            .select('id')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();

          if (funnel) {
            const { data, error } = await supabase
              .from('funnel_config')
              .select('*')
              .eq('funnel_id', funnel.id)
              .maybeSingle();

            if (!error && data) {
              setConfig(data as unknown as FunnelConfig);
              setLoading(false);
              return;
            }
          }
        }

        // Fallback: load first available config
        const { data, error } = await supabase
          .from('funnel_config')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setConfig(data as unknown as FunnelConfig);
        }
      } catch (err) {
        console.error('[FunnelConfig] Load error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  return { config, loading, defaults: DEFAULT_CONFIG };
}

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

/**
 * Hook for admin to load + save config with auto-save debounce.
 * Supports loading by funnelId (preferred) or tenantId (fallback).
 */
export function useAdminFunnelConfig(tenantId: string | null, funnelId?: string) {
  const [config, setConfig] = useState<Partial<FunnelConfig>>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [hasConfig, setHasConfig] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef(config);
  const initialLoadDone = useRef(false);

  // Keep ref in sync
  useEffect(() => { configRef.current = config; }, [config]);

  useEffect(() => {
    if (!funnelId && !tenantId) {
      // No ID provided — load defaults and stop loading
      setConfig({ ...DEFAULT_CONFIG });
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        let query = supabase.from('funnel_config').select('*');

        if (funnelId) {
          query = query.eq('funnel_id', funnelId);
        } else if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query.maybeSingle();

        if (error) console.warn('[FunnelConfig] Load error:', error);

        if (data) {
          setConfig(data as unknown as Partial<FunnelConfig>);
          setHasConfig(true);
        } else {
          setConfig({ ...DEFAULT_CONFIG });
          setHasConfig(false);
        }
      } catch (err) {
        console.warn('[FunnelConfig] Unexpected error:', err);
        setConfig({ ...DEFAULT_CONFIG });
      } finally {
        setLoading(false);
        setTimeout(() => { initialLoadDone.current = true; }, 100);
      }
    };

    load();
  }, [tenantId, funnelId]);

  const persistSave = useCallback(async (updates: Partial<FunnelConfig>) => {
    if (!funnelId && !tenantId) return;
    setSaving(true);
    setSaveStatus('saving');

    try {
      if (hasConfig) {
        let query = supabase.from('funnel_config').update({ ...updates, updated_at: new Date().toISOString() });
        if (funnelId) query = query.eq('funnel_id', funnelId);
        else query = query.eq('tenant_id', tenantId);
        const { error } = await query;
        if (error) throw error;
      } else {
        const insertData: any = { ...updates };
        if (funnelId) insertData.funnel_id = funnelId;
        if (tenantId) insertData.tenant_id = tenantId;
        const { error } = await supabase.from('funnel_config').insert(insertData);
        if (error) throw error;
        setHasConfig(true);
      }
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [tenantId, funnelId, hasConfig]);

  // Auto-save with 1.5s debounce
  const setConfigWithAutoSave = useCallback((updater: any) => {
    setConfig(updater);
    if (!initialLoadDone.current) return;
    setSaveStatus('unsaved');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistSave(configRef.current);
    }, 1500);
  }, [persistSave]);

  // Manual save (immediate)
  const save = useCallback(async (updates: Partial<FunnelConfig>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await persistSave(updates);
  }, [persistSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { config, loading, saving, saveStatus, save, setConfig: setConfigWithAutoSave };
}
