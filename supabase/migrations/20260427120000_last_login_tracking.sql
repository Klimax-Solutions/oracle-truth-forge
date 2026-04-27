-- ══════════════════════════════════════════════════════════════
-- Last Login Tracking
-- Ajoute last_login_at sur profiles + table user_login_history
-- pour un historique complet et fiable des connexions.
-- ══════════════════════════════════════════════════════════════

-- 1) Colonne last_login_at sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 2) Table historique des connexions
CREATE TABLE IF NOT EXISTS public.user_login_history (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_in_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_history_user
  ON public.user_login_history (user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user_time
  ON public.user_login_history (user_id, logged_in_at DESC);

ALTER TABLE public.user_login_history ENABLE ROW LEVEL SECURITY;

-- Chaque user peut insérer sa propre entrée
CREATE POLICY "auth users insert own login"
  ON public.user_login_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins/setters/super_admin peuvent lire l'historique
CREATE POLICY "admin read login history"
  ON public.user_login_history FOR SELECT
  USING (is_admin() OR is_super_admin() OR is_setter());

-- 3) RPC record_login()
-- Appelée côté client à chaque SIGNED_IN.
-- Déduplication : on n'insère en historique que si la dernière entrée
-- remonte à plus d'1h — évite le bruit des multi-onglets / refresh.
-- profiles.last_login_at est TOUJOURS mis à jour (précision maximale).
CREATE OR REPLACE FUNCTION public.record_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_entry timestamptz;
BEGIN
  -- Toujours mettre à jour last_login_at sur profiles
  UPDATE public.profiles
    SET last_login_at = now()
    WHERE user_id = auth.uid();

  -- Insérer dans l'historique seulement si > 1h depuis la dernière entrée
  SELECT logged_in_at INTO last_entry
    FROM public.user_login_history
    WHERE user_id = auth.uid()
    ORDER BY logged_in_at DESC
    LIMIT 1;

  IF last_entry IS NULL OR (now() - last_entry) > interval '1 hour' THEN
    INSERT INTO public.user_login_history (user_id, logged_in_at)
      VALUES (auth.uid(), now());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_login() TO authenticated;
