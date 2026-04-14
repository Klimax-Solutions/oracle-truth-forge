-- ============================================
-- Seed Test Environment
-- Projet: mkogljvoqqcnqrgcnfau
-- But: reproduire un env réaliste pour tester le CRM
-- JAMAIS appliquer sur la prod
-- ============================================

-- ============================================
-- 1. VIDÉOS (miroir prod — 5 vidéos Setup Oracle)
-- ============================================
-- On supprime les anciennes vidéos de test et on recrée les 5 exactes
DELETE FROM videos;

INSERT INTO videos (title, description, embed_url, sort_order, accessible_roles) VALUES
  ('Vidéo 1 : Présentation du Setup', 'Introduction au Setup Oracle', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 1, ARRAY['early_access', 'admin', 'super_admin', 'member']),
  ('Vidéo 2 : Les 3 modèles d''entrée en position', 'Approfondissement du Setup Oracle', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 2, ARRAY['early_access', 'admin', 'super_admin', 'member']),
  ('Vidéo 3 : Exemple d''un Trade de retracement', 'Mise en pratique', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 3, ARRAY['early_access', 'admin', 'super_admin', 'member']),
  ('Vidéo 4 : Configurations A - B - C', 'Les 3 configurations du Setup Oracle', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 4, ARRAY['early_access', 'admin', 'super_admin', 'member']),
  ('Vidéo Finale : Démonstration complète', 'Conclusion et synthèse complète', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 5, ARRAY['early_access', 'admin', 'super_admin', 'member']);

-- ============================================
-- 2. LEADS DE TEST (pipeline réaliste)
-- Couvre tous les stades du trial J1→J7+expiré
-- ============================================
DELETE FROM lead_events;
DELETE FROM lead_comments;
DELETE FROM ea_lead_notes;
DELETE FROM early_access_requests WHERE email LIKE '%@test-oracle.com';

-- Lead 1: J1, vient de s'inscrire, pas encore contacté
INSERT INTO early_access_requests (
  first_name, email, phone, status, form_submitted, created_at,
  form_answers, budget_amount, priorite, importance_trading, difficulte_principale, offer_amount,
  date_activation_trial, statut_trial
) VALUES (
  'Lucas', 'lucas@test-oracle.com', '+33 6 12 34 56 78', 'approuvée', true, now() - interval '1 day',
  '{"investment_amount": "5 000 € - 10 000 €", "main_difficulty": "Gestion du risque (Risk Management)", "time_commitment": "7-9", "experience_level": "Intermédiaire (1-2 ans et +)", "main_objective": "Devenir rentable de manière constante"}'::jsonb,
  5000, 'P1', 7, 'Gestion du risque (Risk Management)', '5 000 € - 10 000 €',
  now() - interval '1 day', 'actif'
);

-- Lead 2: J3, contacté WhatsApp, a commencé les vidéos
INSERT INTO early_access_requests (
  first_name, email, phone, status, form_submitted, created_at, reviewed_at,
  contacted, contact_method, contacted_at, setter_name,
  form_answers, budget_amount, priorite, importance_trading, difficulte_principale, offer_amount,
  date_activation_trial, statut_trial, derniere_interaction
) VALUES (
  'Emma', 'emma@test-oracle.com', '+33 7 98 76 54 32', 'approuvée', true, now() - interval '3 days', now() - interval '3 days',
  true, 'whatsapp', now() - interval '2 days', 'Mimi',
  '{"investment_amount": "3 000 € - 5 000 €", "main_difficulty": "Psychologie et discipline", "time_commitment": "5-7", "experience_level": "Débutant (3-12 mois)"}'::jsonb,
  3000, 'P2', 5, 'Psychologie et discipline', '3 000 € - 5 000 €',
  now() - interval '3 days', 'actif', now() - interval '6 hours'
);

-- Lead 3: J5, en retard — contacté mais pas avancé dans les vidéos
INSERT INTO early_access_requests (
  first_name, email, phone, status, form_submitted, created_at, reviewed_at,
  contacted, contact_method, contacted_at, setter_name,
  form_answers, budget_amount, priorite, importance_trading, difficulte_principale, offer_amount,
  date_activation_trial, statut_trial, derniere_interaction
) VALUES (
  'Thomas', 'thomas@test-oracle.com', '+33 6 11 22 33 44', 'approuvée', true, now() - interval '5 days', now() - interval '5 days',
  true, 'whatsapp', now() - interval '4 days', 'Mimi',
  '{"investment_amount": "1 000 € - 3 000 €", "main_difficulty": "Trouver une stratégie qui fonctionne", "time_commitment": "3-5", "experience_level": "Débutant complet (0-3 mois)"}'::jsonb,
  1000, 'P3', 3, 'Trouver une stratégie qui fonctionne', '1 000 € - 3 000 €',
  now() - interval '5 days', 'actif', now() - interval '26 hours'
);

-- Lead 4: J5, on track — vidéos terminées, récolte en cours, call booké
INSERT INTO early_access_requests (
  first_name, email, phone, status, form_submitted, created_at, reviewed_at,
  contacted, contact_method, contacted_at, setter_name,
  call_booked, call_scheduled_at, closer_name,
  form_answers, budget_amount, priorite, importance_trading, difficulte_principale, offer_amount,
  date_activation_trial, statut_trial, derniere_interaction,
  brief_closer, contacte_aujourdhui
) VALUES (
  'Sarah', 'sarah@test-oracle.com', '+33 7 55 66 77 88', 'approuvée', true, now() - interval '5 days', now() - interval '5 days',
  true, 'whatsapp', now() - interval '4 days', 'Saram',
  true, now() + interval '1 day', 'Enzo',
  '{"investment_amount": "5 000 € - 10 000 €", "main_difficulty": "Psychologie et discipline", "time_commitment": "10 (Tu as besoin que ça marche immédiatement)", "experience_level": "Intermédiaire (1-2 ans et +)"}'::jsonb,
  5000, 'P1', 10, 'Psychologie et discipline', '5 000 € - 10 000 €',
  now() - interval '5 days', 'actif', now() - interval '3 hours',
  'Très motivée, budget OK, a fini les vidéos en 3 jours. Difficultée principale: discipline. A déjà perdu 2K en trading sans structure.', true
);

-- Lead 5: J7, call fait, contracté, payé
INSERT INTO early_access_requests (
  first_name, email, phone, status, form_submitted, created_at, reviewed_at,
  contacted, contact_method, contacted_at, setter_name,
  call_booked, call_scheduled_at, call_done, closer_name,
  call_outcome, call_debrief, offer_amount, paid_amount, paid_at, checkout_unlocked,
  form_answers, budget_amount, priorite, importance_trading, difficulte_principale,
  date_activation_trial, statut_trial, derniere_interaction, brief_closer
) VALUES (
  'Julien', 'julien@test-oracle.com', '+33 6 99 88 77 66', 'approuvée', true, now() - interval '7 days', now() - interval '7 days',
  true, 'whatsapp', now() - interval '6 days', 'Mimi',
  true, now() - interval '2 days', true, 'Enzo',
  'contracted', 'Call de 45min. Très convaincu par la méthode. A vu les résultats en récolte. Budget validé.', '4 997€', 4997, now() - interval '1 day', true,
  '{"investment_amount": "5 000 € - 10 000 €", "main_difficulty": "Gestion du risque (Risk Management)", "time_commitment": "10 (Tu as besoin que ça marche immédiatement)", "experience_level": "Intermédiaire (1-2 ans et +)"}'::jsonb,
  5000, 'P1', 10, 'Gestion du risque (Risk Management)',
  now() - interval '7 days', 'actif', now() - interval '1 day',
  'Trader intermédiaire, 2 ans exp. A testé Hugo FX avant. Budget 5K+. Très motivé, disponible full time.'
);

-- Lead 6: J7+, expiré, pas closé — ghost
INSERT INTO early_access_requests (
  first_name, email, phone, status, form_submitted, created_at, reviewed_at,
  contacted, contact_method, contacted_at, setter_name,
  form_answers, budget_amount, priorite, importance_trading, difficulte_principale, offer_amount,
  date_activation_trial, statut_trial, derniere_interaction, raison_non_closing
) VALUES (
  'Antoine', 'antoine@test-oracle.com', '+33 7 11 22 33 44', 'approuvée', true, now() - interval '10 days', now() - interval '10 days',
  true, 'whatsapp', now() - interval '9 days', 'Saram',
  '{"investment_amount": "1 000 € - 3 000 €", "main_difficulty": "Trouver une stratégie qui fonctionne", "time_commitment": "3-5"}'::jsonb,
  1000, 'P3', 3, 'Trouver une stratégie qui fonctionne', '1 000 € - 3 000 €',
  now() - interval '10 days', 'expire', now() - interval '5 days', 'Ghost'
);

-- Lead 7: J4, call booké mais pas encore fait
INSERT INTO early_access_requests (
  first_name, email, phone, status, form_submitted, created_at, reviewed_at,
  contacted, contact_method, contacted_at, setter_name,
  call_booked, call_scheduled_at, closer_name,
  form_answers, budget_amount, priorite, importance_trading, difficulte_principale, offer_amount,
  date_activation_trial, statut_trial, derniere_interaction, brief_closer
) VALUES (
  'Marie', 'marie@test-oracle.com', '+33 6 44 55 66 77', 'approuvée', true, now() - interval '4 days', now() - interval '4 days',
  true, 'email', now() - interval '3 days', 'Mimi',
  true, now() + interval '2 days', 'Enzo',
  '{"investment_amount": "3 000 € - 5 000 €", "main_difficulty": "Gestion du risque (Risk Management)", "time_commitment": "7-9", "experience_level": "Débutant (3-12 mois)"}'::jsonb,
  3000, 'P2', 7, 'Gestion du risque (Risk Management)', '3 000 € - 5 000 €',
  now() - interval '4 days', 'actif', now() - interval '12 hours',
  'Étudiante motivée, budget 3-5K. Contactée par email car pas WhatsApp. A bien avancé dans les vidéos.'
);

-- Lead 8: Nouveau, en_attente (pas encore approuvé)
INSERT INTO early_access_requests (
  first_name, email, phone, status, form_submitted, created_at,
  form_answers, budget_amount, priorite, importance_trading, difficulte_principale, offer_amount
) VALUES (
  'Hugo', 'hugo@test-oracle.com', '+33 7 22 33 44 55', 'en_attente', true, now() - interval '2 hours',
  '{"investment_amount": "3 000 € - 5 000 €", "main_difficulty": "Psychologie et discipline", "time_commitment": "7-9", "experience_level": "Débutant complet (0-3 mois)"}'::jsonb,
  3000, 'P2', 7, 'Psychologie et discipline', '3 000 € - 5 000 €'
);
