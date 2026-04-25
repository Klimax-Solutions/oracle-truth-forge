-- Migration: backfill expires_at for existing early_access roles
-- Règle décision : le timer EA part de l'approbation (J+7), pas de la 1ère connexion.
-- Tous les rôles early_access avec expires_at IS NULL (timer jamais déclenché)
-- reçoivent expires_at = created_at + 7 jours.
-- Impact : leads qui n'ont pas encore ouvert l'app restent valides jusqu'à J7 depuis approbation.
-- Si created_at + 7j < now() → ils sont déjà expirés, c'est correct.

UPDATE user_roles
SET expires_at = created_at + interval '7 days'
WHERE role = 'early_access'
  AND expires_at IS NULL;

-- Vérification post-migration (à exécuter manuellement pour confirmer) :
-- SELECT user_id, created_at, expires_at FROM user_roles WHERE role = 'early_access';
