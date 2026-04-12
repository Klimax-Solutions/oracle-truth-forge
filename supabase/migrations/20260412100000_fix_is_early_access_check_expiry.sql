-- ============================================
-- Fix: is_early_access() must check expires_at
-- ============================================
--
-- PROBLEM:
-- The current is_early_access() calls has_role() which only checks if a row
-- exists in user_roles with role='early_access'. It does NOT check expires_at.
-- This means a user whose EA timer expired 3 weeks ago still has full EA access
-- to all RLS-protected data (trades, executions, featured_trade, etc.).
--
-- FIX:
-- Replace is_early_access() with a direct query that checks:
-- 1. The role exists (row in user_roles with role='early_access')
-- 2. AND either:
--    a. expires_at IS NULL (timer not activated yet — user hasn't opened the app)
--    b. OR expires_at > now() (timer still running)
--
-- IMPORTANT: This does NOT delete the user_roles row when EA expires.
-- The user keeps their account, can still log in, sees the dashboard,
-- but content behind is_early_access() RLS policies becomes invisible.
-- The frontend shows CTAs to book a call / upgrade when EA is expired.
--
-- AFFECTED RLS POLICIES (no changes needed — they all call is_early_access()):
-- - "EA users can view featured trade" on ea_featured_trade
-- - "Users can view trades based on execution progress" on trades
-- - "Early access users can view first 50 trades" on trades
-- - "Early access can view all executions" on user_executions
--
-- ROLLBACK: Re-run the original function from migration 20260214165712
--   CREATE OR REPLACE FUNCTION public.is_early_access()
--   ... SELECT public.has_role(auth.uid(), 'early_access') ...
-- ============================================

CREATE OR REPLACE FUNCTION public.is_early_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'early_access'
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- ============================================
-- DATA MODEL REFERENCE (for future developers)
-- ============================================
--
-- profiles.status (enum user_status) — ACCOUNT STATUS (exclusive, exactly 1)
--   active   = can log in, use the app normally
--   pending  = signed up, awaiting admin approval
--   frozen   = temporarily blocked (can be unfrozen by admin)
--   banned   = permanently blocked (can be unbanned by admin)
--
-- user_roles.role (enum app_role) — CUMULATIVE, a user has 1..N roles
--
--   TEAM ROLES (internal staff, assigned by super_admin):
--     super_admin  = full access, can manage everything
--     admin        = can manage users, verify cycles, access CRM
--     setter       = can see CRM pipeline filtered to their leads
--
--   ACCESS PHASE (temporary, client-facing):
--     early_access = trial period with timer
--       - expires_at: NULL = timer not started, future date = active, past date = expired
--       - early_access_type: 'precall' or 'postcall'
--       - ea_timer_duration_minutes: configured duration
--       - Timer starts when user first opens the app (activate_ea_timer RPC)
--       - When expired: row stays, but is_early_access() returns false
--       - User can still log in, sees upgrade CTAs
--
--   TAGS (permanent, cumulative):
--     institute  = client from an institute/school (permanent tag)
--     member     = base role, auto-assigned on signup, never removed
--
--   profiles.is_client (boolean) = has paid, permanent access
--
-- COMBINATIONS (valid examples):
--   member                                    = basic user, no special access
--   member + early_access                     = trial user
--   member + early_access + institute         = institute trial user
--   member + early_access (expired)           = trial ended, needs to upgrade
--   member + admin                            = internal admin
--   member + setter                           = internal setter
--   member + is_client=true                   = paid client, permanent access
--   member + is_client=true + institute       = paid institute client
--
-- WHAT CANNOT HAPPEN:
--   active + frozen  (impossible — status is exclusive enum)
--   admin + setter on same user (technically possible but makes no sense)
-- ============================================
