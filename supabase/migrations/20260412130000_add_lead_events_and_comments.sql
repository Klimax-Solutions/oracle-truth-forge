-- ============================================
-- Lead Events + Comments — Timeline system
-- Mirrors spike-launch architecture
-- ============================================

-- 1. Events table — immutable log of all lead lifecycle events
CREATE TABLE IF NOT EXISTS public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.early_access_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  timestamp timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_events_request_id ON public.lead_events(request_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON public.lead_events(event_type);

-- RLS
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage lead events" ON public.lead_events FOR ALL USING (public.is_admin() OR public.is_super_admin());
CREATE POLICY "Setters can view lead events" ON public.lead_events FOR SELECT USING (public.is_setter());

-- 2. Lead comments table — manual notes from team members
CREATE TABLE IF NOT EXISTS public.lead_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.early_access_requests(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'admin' CHECK (author_role IN ('admin', 'super_admin', 'setter', 'closer')),
  content text NOT NULL,
  comment_type text NOT NULL DEFAULT 'manual' CHECK (comment_type IN ('manual', 'setting_notes', 'closing_debrief', 'system')),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lead_comments_request_id ON public.lead_comments(request_id, created_at DESC);

-- RLS
ALTER TABLE public.lead_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage lead comments" ON public.lead_comments FOR ALL USING (public.is_admin() OR public.is_super_admin());
CREATE POLICY "Setters can manage own comments" ON public.lead_comments FOR ALL USING (public.is_setter() AND author_id = auth.uid());
CREATE POLICY "Setters can view all comments" ON public.lead_comments FOR SELECT USING (public.is_setter());

-- ============================================
-- Event types reference:
--
-- FORM:
--   form_submitted          — Lead submitted the apply form
--
-- SETTING (pre-call contact):
--   setting_contacted_whatsapp  — Setter contacted via WhatsApp
--   setting_contacted_email     — Setter contacted via Email
--   setting_contact_reset       — Contact status reset
--   setting_debrief_saved       — Setting debrief/notes saved
--
-- CALL:
--   call_booked             — Call booked (Cal.com or manual)
--   call_rescheduled        — Call rescheduled
--   call_cancelled          — Call cancelled
--   call_done               — Call marked as done
--   call_no_show            — Lead didn't show up
--
-- OUTCOME:
--   outcome_contracted      — Lead contracted
--   outcome_closing_in_progress — Closing in progress
--   outcome_not_closed      — Lead not closed
--   outcome_changed         — Outcome changed (metadata: previous, new)
--
-- PAYMENT:
--   payment_received        — Payment received (metadata: amount)
--
-- ADMIN:
--   ea_approved             — Early access approved
--   ea_timer_extended       — EA timer extended
--   lead_assigned_setter    — Setter assigned (metadata: setter_name)
--   lead_assigned_closer    — Closer assigned (metadata: closer_name)
-- ============================================
