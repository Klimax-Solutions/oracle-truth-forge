-- Spec Oracle CRM: champs Setting + Pipeline + Call
-- Safe: IF NOT EXISTS partout, pas de DROP

-- Champs extraits du form (lecture seule dans le CRM)
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS budget_amount integer;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS importance_trading integer;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS difficulte_principale text;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS priorite text; -- P1, P2, P3

-- Checklist 6 étapes (auto-calculées depuis les tables produit)
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS videos_en_cours boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS videos_terminees boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS recolte_demarree boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS recolte_terminee boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS trade_execute boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS quick_win boolean DEFAULT false;

-- Setting daily
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS contacte_aujourdhui boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS derniere_interaction timestamptz;

-- Brief closer (séparé du call_debrief)
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS brief_closer text;

-- Call: raison si pas vendu
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS raison_perdu text;

-- Post-J7
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS statut_trial text DEFAULT 'actif'; -- actif, expire
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS raison_non_closing text;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS rappel_date timestamptz;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS rappel_note text;

-- Date d'activation trial (distincte de reviewed_at pour être explicite)
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS date_activation_trial timestamptz;
