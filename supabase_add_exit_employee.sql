-- Add exit_employee_id column to visits table
ALTER TABLE public.visits 
ADD COLUMN exit_employee_id BIGINT REFERENCES public.employees(id);

-- Add foreign key constraint with a specific name for clarity (optional but good for PostgREST)
-- Although the references clause above creates one, we might want to ensure the name is predictable
-- However, standard naming is typically visits_exit_employee_id_fkey which is what Postgres usually generates.
-- Let's just rely on the column being added.

-- If you need to backfill existing data (e.g. set exit_employee_id = employee_id for already exited visits)
-- UPDATE public.visits SET exit_employee_id = employee_id WHERE exit_time IS NOT NULL AND exit_employee_id IS NULL;
