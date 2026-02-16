-- Add result_type column to results table for categorizing results
ALTER TABLE public.results ADD COLUMN result_type text DEFAULT 'trade';

-- Create an index for filtering by type
CREATE INDEX idx_results_result_type ON public.results(result_type);
