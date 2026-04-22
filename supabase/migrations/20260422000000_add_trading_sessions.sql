-- ============================================
-- Trading Sessions — Récolte de données
-- Introduit le concept de "session" (backtesting ou live_trading)
-- Chaque user peut avoir N sessions, chaque session contient ses trades.
-- ============================================
-- Framework Migration (CLAUDE.md règle 5) :
-- 1. Ne supprime rien
-- 2. IF NOT EXISTS partout (idempotent)
-- 3. Colonne session_id nullable (n'impacte pas les queries existantes)
-- 4. Migration data automatique pour chaque user ayant des trades existants
-- 5. Rollback possible : DROP TABLE trading_sessions CASCADE + ALTER TABLE user_personal_trades DROP COLUMN session_id
-- ============================================

-- 1. Table trading_sessions
CREATE TABLE IF NOT EXISTS public.trading_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  asset text,
  type text NOT NULL CHECK (type IN ('backtesting', 'live_trading')),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trading_sessions_user_id ON public.trading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_type ON public.trading_sessions(type);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_archived ON public.trading_sessions(archived);

-- 2. RLS
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own sessions" ON public.trading_sessions;
CREATE POLICY "Users manage own sessions" ON public.trading_sessions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all sessions" ON public.trading_sessions;
CREATE POLICY "Admins can view all sessions" ON public.trading_sessions
  FOR SELECT USING (public.is_admin() OR public.is_super_admin());

-- 3. Colonne session_id sur user_personal_trades (nullable pour rétrocompat)
ALTER TABLE public.user_personal_trades
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.trading_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_personal_trades_session_id ON public.user_personal_trades(session_id);

-- 4. Migration des données existantes
-- Pour chaque user ayant des trades sans session_id, on crée une session "Setup Perso (archivé)"
-- et on rattache tous ses trades dessus.
DO $$
DECLARE
  user_record RECORD;
  new_session_id uuid;
BEGIN
  FOR user_record IN
    SELECT DISTINCT user_id
    FROM public.user_personal_trades
    WHERE session_id IS NULL
  LOOP
    INSERT INTO public.trading_sessions (user_id, name, type, archived)
    VALUES (user_record.user_id, 'Setup Perso (archivé)', 'backtesting', false)
    RETURNING id INTO new_session_id;

    UPDATE public.user_personal_trades
    SET session_id = new_session_id
    WHERE user_id = user_record.user_id AND session_id IS NULL;
  END LOOP;
END $$;

-- 5. Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_trading_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trading_sessions_updated_at ON public.trading_sessions;
CREATE TRIGGER trading_sessions_updated_at
  BEFORE UPDATE ON public.trading_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_trading_sessions_updated_at();
