-- Migration : Option B — 3 tables vidéo séparées
-- Remplace la table bonus_videos (avec discriminant category) par deux tables dédiées :
--   mercure_videos  → anciens bonus_videos WHERE category = 'formation'
--   live_videos     → anciens bonus_videos WHERE category = 'live'
--
-- Phase 1 : créer + copier. bonus_videos est conservée (Phase 3 = DROP après 48h de vérif).
-- Idempotent : CREATE TABLE IF NOT EXISTS, INSERT ... ON CONFLICT DO NOTHING.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. mercure_videos
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mercure_videos (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text        NOT NULL,
  description      text,
  embed_code       text        NOT NULL,
  sort_order       integer     NOT NULL DEFAULT 0,
  accessible_roles text[]      DEFAULT ARRAY['member','early_access','admin','super_admin'],
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. live_videos
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_videos (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text        NOT NULL,
  description      text,
  embed_code       text        NOT NULL,
  sort_order       integer     NOT NULL DEFAULT 0,
  accessible_roles text[]      DEFAULT ARRAY['member','early_access','admin','super_admin'],
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Copie des données depuis bonus_videos (idempotent via ON CONFLICT DO NOTHING)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.mercure_videos
  (id, title, description, embed_code, sort_order, accessible_roles, created_at, updated_at, created_by)
SELECT
  id, title, description, embed_code, sort_order, accessible_roles, created_at, updated_at, created_by
FROM public.bonus_videos
WHERE (category = 'formation' OR category IS NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.live_videos
  (id, title, description, embed_code, sort_order, accessible_roles, created_at, updated_at, created_by)
SELECT
  id, title, description, embed_code, sort_order, accessible_roles, created_at, updated_at, created_by
FROM public.bonus_videos
WHERE category = 'live'
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS — mercure_videos
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.mercure_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mercure_videos_select" ON public.mercure_videos;
CREATE POLICY "mercure_videos_select"
  ON public.mercure_videos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mercure_videos_admin_write" ON public.mercure_videos;
CREATE POLICY "mercure_videos_admin_write"
  ON public.mercure_videos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — live_videos
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.live_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_videos_select" ON public.live_videos;
CREATE POLICY "live_videos_select"
  ON public.live_videos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "live_videos_admin_write" ON public.live_videos;
CREATE POLICY "live_videos_admin_write"
  ON public.live_videos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- bonus_videos conservée intentionnellement (Phase 3 = DROP après 48h vérif prod)
-- ─────────────────────────────────────────────────────────────────────────────

COMMIT;
