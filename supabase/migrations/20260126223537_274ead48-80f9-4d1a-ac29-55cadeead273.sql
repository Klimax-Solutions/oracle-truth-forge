-- Create enum for cycle status
CREATE TYPE public.cycle_status AS ENUM ('locked', 'in_progress', 'pending_review', 'validated', 'rejected');

-- Create cycles reference table
CREATE TABLE public.cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_number INT NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  trade_start INT NOT NULL,
  trade_end INT NOT NULL,
  total_trades INT NOT NULL,
  phase INT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert the 8 cycles + ébauche (cycle 0)
INSERT INTO public.cycles (cycle_number, name, trade_start, trade_end, total_trades, phase, description) VALUES
  (0, 'Ébauche', 1, 15, 15, 0, 'Phase initiale de découverte avec vidéos explicatives'),
  (1, 'Cycle 1', 16, 40, 25, 1, 'Premier cycle de la Phase 1'),
  (2, 'Cycle 2', 41, 65, 25, 1, 'Deuxième cycle de la Phase 1'),
  (3, 'Cycle 3', 66, 90, 25, 1, 'Troisième cycle de la Phase 1'),
  (4, 'Cycle 4', 91, 115, 25, 1, 'Quatrième cycle de la Phase 1'),
  (5, 'Cycle 5', 116, 165, 50, 2, 'Premier cycle de la Phase 2'),
  (6, 'Cycle 6', 166, 215, 50, 2, 'Deuxième cycle de la Phase 2'),
  (7, 'Cycle 7', 216, 265, 50, 2, 'Troisième cycle de la Phase 2'),
  (8, 'Cycle 8', 266, 314, 49, 2, 'Dernier cycle de la Phase 2');

-- Enable RLS on cycles (public read)
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cycles are viewable by everyone" 
ON public.cycles 
FOR SELECT 
USING (true);

-- Create user_cycles table to track user progress per cycle
CREATE TABLE public.user_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cycle_id UUID REFERENCES public.cycles(id) ON DELETE CASCADE NOT NULL,
  status cycle_status DEFAULT 'locked',
  completed_trades INT DEFAULT 0,
  total_rr DECIMAL(10,2) DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  admin_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, cycle_id)
);

-- Enable RLS on user_cycles
ALTER TABLE public.user_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cycles" 
ON public.user_cycles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own cycles" 
ON public.user_cycles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cycles" 
ON public.user_cycles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admin policy: Admins (identified by email) can view and update all user_cycles
CREATE POLICY "Admins can view all user_cycles" 
ON public.user_cycles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'jules.philipon@gmail.com'
  )
);

CREATE POLICY "Admins can update all user_cycles" 
ON public.user_cycles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'jules.philipon@gmail.com'
  )
);

-- Create verification_requests table
CREATE TABLE public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cycle_id UUID REFERENCES public.cycles(id) ON DELETE CASCADE NOT NULL,
  user_cycle_id UUID REFERENCES public.user_cycles(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  admin_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on verification_requests
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification requests" 
ON public.verification_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own verification requests" 
ON public.verification_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all verification requests" 
ON public.verification_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'jules.philipon@gmail.com'
  )
);

CREATE POLICY "Admins can update verification requests" 
ON public.verification_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'jules.philipon@gmail.com'
  )
);

-- Create trigger to update updated_at on user_cycles
CREATE OR REPLACE FUNCTION public.update_user_cycles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_cycles_updated_at
BEFORE UPDATE ON public.user_cycles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_cycles_updated_at();

-- Function to initialize user cycles when they first access the system
CREATE OR REPLACE FUNCTION public.initialize_user_cycles(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cycle_record RECORD;
BEGIN
  -- Check if user already has cycles initialized
  IF EXISTS (SELECT 1 FROM user_cycles WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;
  
  -- Initialize all cycles for the user
  FOR cycle_record IN SELECT id, cycle_number FROM cycles ORDER BY cycle_number LOOP
    INSERT INTO user_cycles (user_id, cycle_id, status)
    VALUES (
      p_user_id, 
      cycle_record.id, 
      CASE 
        WHEN cycle_record.cycle_number = 0 THEN 'in_progress'::cycle_status
        ELSE 'locked'::cycle_status
      END
    );
  END LOOP;
END;
$$;