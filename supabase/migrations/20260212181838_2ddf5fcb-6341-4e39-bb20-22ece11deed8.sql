
-- Table for admin per-trade notes during verification
CREATE TABLE public.admin_trade_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verification_request_id uuid NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL REFERENCES user_executions(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  note text,
  is_valid boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(verification_request_id, execution_id)
);

ALTER TABLE public.admin_trade_notes ENABLE ROW LEVEL SECURITY;

-- Only admins can manage trade notes
CREATE POLICY "Admins can view all trade notes"
  ON public.admin_trade_notes FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert trade notes"
  ON public.admin_trade_notes FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update trade notes"
  ON public.admin_trade_notes FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete trade notes"
  ON public.admin_trade_notes FOR DELETE
  USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_admin_trade_notes_updated_at
  BEFORE UPDATE ON public.admin_trade_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
