-- Add is_system_exit column to visits table to track system auto-exits
ALTER TABLE public.visits 
ADD COLUMN IF NOT EXISTS is_system_exit boolean DEFAULT false;

-- Policy update is not needed as 'public update access' already exists and covers new columns usually.