-- ============================================
-- Funnel system tables for CRM funnel editor
-- Branch: crm-integration
-- Safe to apply on dev DB (mkogljvoqqcnqrgcnfau)
-- DO NOT apply on Lovable Cloud (pggkwyhtplxyarctuoze)
-- ============================================

CREATE TABLE IF NOT EXISTS public.funnels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.funnel_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id uuid REFERENCES public.funnels(id) ON DELETE CASCADE,
  -- Landing
  landing_headline text DEFAULT '',
  landing_headline_accent text DEFAULT '',
  landing_subtitle text DEFAULT '',
  landing_cta_text text DEFAULT 'Commencer',
  landing_cta_subtext text DEFAULT '',
  landing_footer_text text DEFAULT '',
  -- Apply
  apply_headline text DEFAULT '',
  apply_social_proof_enabled boolean DEFAULT false,
  apply_social_proof_text text DEFAULT '',
  apply_form_questions jsonb DEFAULT '[]'::jsonb,
  apply_form_name_label text DEFAULT '',
  apply_form_phone_label text DEFAULT '',
  apply_form_email_label text DEFAULT '',
  -- Discovery
  discovery_badge_text text DEFAULT 'Candidature acceptée',
  discovery_headline text DEFAULT '',
  discovery_headline_personalized text DEFAULT '',
  discovery_subtitle text DEFAULT '',
  discovery_cta_title text DEFAULT '',
  discovery_cta_subtitle text DEFAULT '',
  discovery_cta_button text DEFAULT '',
  discovery_cal_link text DEFAULT '',
  -- Final
  final_badge_text text DEFAULT 'Confirmé',
  final_headline_personalized text DEFAULT '',
  final_headline_confirmation text DEFAULT '',
  final_headline_accent text DEFAULT '',
  final_step1_title text DEFAULT '',
  final_step1_congrats text DEFAULT '',
  final_step1_instructions text DEFAULT '',
  final_step1_details text DEFAULT '',
  final_step1_warning_title text DEFAULT '',
  final_step1_warning_text text DEFAULT '',
  final_step1_warning_consequence text DEFAULT '',
  final_step2_title text DEFAULT '',
  final_step2_placeholder text DEFAULT '',
  final_step2_subtext text DEFAULT '',
  -- Blocks
  landing_blocks jsonb DEFAULT '[]'::jsonb,
  apply_blocks jsonb DEFAULT '[]'::jsonb,
  discovery_blocks jsonb DEFAULT '[]'::jsonb,
  final_blocks jsonb DEFAULT '[]'::jsonb,
  -- VSL
  vsl_enabled boolean DEFAULT false,
  vsl_provider text DEFAULT 'vidalytics',
  vsl_embed_code text DEFAULT '',
  vsl_page text DEFAULT 'discovery',
  -- Branding
  brand_name text DEFAULT 'Oracle',
  brand_footer_text text DEFAULT '© {year} Oracle. Tous droits réservés.',
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_funnels_slug ON public.funnels(slug);
CREATE INDEX IF NOT EXISTS idx_funnel_config_funnel_id ON public.funnel_config(funnel_id);

-- RLS
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_config ENABLE ROW LEVEL SECURITY;

-- Public read for active funnels (needed for funnel pages)
CREATE POLICY "Anyone can read active funnels" ON public.funnels
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can read funnel config" ON public.funnel_config
  FOR SELECT USING (true);

-- Admin write
CREATE POLICY "Admins can manage funnels" ON public.funnels
  FOR ALL USING (public.is_admin() OR public.is_super_admin());

CREATE POLICY "Admins can manage funnel config" ON public.funnel_config
  FOR ALL USING (public.is_admin() OR public.is_super_admin());

-- Seed default funnel
INSERT INTO public.funnels (name, slug, is_active) VALUES ('Oracle VIP', 'vip', true);

INSERT INTO public.funnel_config (funnel_id, brand_name, brand_footer_text, apply_headline, apply_form_questions)
SELECT id, 'Oracle', '© {year} Oracle. Tous droits réservés.',
  'Dépose ta candidature pour accéder au protocole.',
  '[
    {"id":"main_objective","title":"Quel est ton objectif principal avec le trading actuellement ?","options":[{"label":"Obtenir mon premier paiement de Prop Firm","disqualifying":false},{"label":"Devenir rentable de manière constante","disqualifying":false},{"label":"Atteindre les 6 chiffres grâce au trading","disqualifying":false}]},
    {"id":"time_commitment","title":"Sur une échelle de 1 à 10, à quel point es-tu prêt à consacrer du temps au trading ?","options":[{"label":"1-3 (Je ne peux pas t aider)","disqualifying":true},{"label":"3-5","disqualifying":false},{"label":"5-7","disqualifying":false},{"label":"7-9","disqualifying":false},{"label":"10 (Tu as besoin que ça marche immédiatement)","disqualifying":false}]},
    {"id":"experience_level","title":"Quel est ton niveau d expérience actuel en trading ?","options":[{"label":"Débutant complet (0-3 mois)","disqualifying":false},{"label":"Débutant (3-12 mois)","disqualifying":false},{"label":"Intermédiaire (1-2 ans et +)","disqualifying":false}]},
    {"id":"is_profitable","title":"Es-tu actuellement rentable ?","options":[{"label":"Oui, je suis rentable","disqualifying":false},{"label":"À l équilibre (Break-even)","disqualifying":false},{"label":"Non, je perds de l argent","disqualifying":false}]},
    {"id":"main_difficulty","title":"Quelle est ta PLUS GRANDE difficulté en trading actuellement ?","options":[{"label":"Trouver une stratégie qui fonctionne","disqualifying":false},{"label":"Psychologie et discipline","disqualifying":false},{"label":"Gestion du risque (Risk Management)","disqualifying":false}]},
    {"id":"ultimate_goal","title":"Quel est ton but ultime avec le trading ?","options":[{"label":"Arrêter les études","disqualifying":false},{"label":"Quitter mon job","disqualifying":false},{"label":"Liberté financière, temporelle et géographique","disqualifying":false},{"label":"J ai déjà tout cela","disqualifying":false}]},
    {"id":"work_status","title":"Quelle est ta situation actuelle ?","options":[{"label":"Salarié","disqualifying":false},{"label":"Indépendant","disqualifying":false},{"label":"Étudiant","disqualifying":false},{"label":"Trader à temps plein","disqualifying":false}]},
    {"id":"investment_amount","title":"Quel montant as-tu de côté pour investir ?","options":[{"label":"< 1 000 € (Je ne peux pas t aider)","disqualifying":true},{"label":"1 000 € - 3 000 €","disqualifying":false},{"label":"3 000 € - 5 000 €","disqualifying":false},{"label":"5 000 € - 10 000 €","disqualifying":false}]}
  ]'::jsonb
FROM public.funnels WHERE slug = 'vip';
