-- ==============================================================================
-- PRODUCTION MIGRATION
-- ------------------------------------------------------------------------------
-- Based on codebase requirements (src/app/admin/employees/page.tsx) and existing SQL.
--
-- Goals:
-- 1. Align Schema with Code: Rename 'pin_hash' -> 'password'.
-- 2. Clean up: Remove 'has_pin' (since code uses 'password' IS NOT NULL check).
-- 3. Security: Enable RLS, set Policies.
-- 4. Functions: Update authentication and management functions.
-- ==============================================================================

BEGIN;

-- ==========================================
-- 1. EXTENSIONS
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 2. SCHEMA MIGRATION
-- ==========================================

-- A. Rename 'pin_hash' to 'password' if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'pin_hash'
  ) THEN
    ALTER TABLE employees RENAME COLUMN pin_hash TO "password";
  END IF;
END $$;

-- B. Clean up 'has_pin' if it exists (Code uses 'password' column directly)
DROP TRIGGER IF EXISTS tr_sync_has_pin ON employees;
DROP FUNCTION IF EXISTS sync_has_pin();
ALTER TABLE employees DROP COLUMN IF EXISTS has_pin;
DROP FUNCTION IF EXISTS has_pin(employees);

-- ==========================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE IF EXISTS employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS visit_purposes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. POLICIES
-- ==========================================

-- --- DEPARTMENTS ---
DROP POLICY IF EXISTS "Enable read access for all users" ON departments;
DROP POLICY IF EXISTS "Enable all access for all users" ON departments;

CREATE POLICY "Enable all access for all users" ON departments
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- --- VISIT PURPOSES ---
DROP POLICY IF EXISTS "Enable read access for all users" ON visit_purposes;
DROP POLICY IF EXISTS "Enable all access for all users" ON visit_purposes;

CREATE POLICY "Enable all access for all users" ON visit_purposes
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- --- BADGES ---
DROP POLICY IF EXISTS "Enable read access for all users" ON badges;
DROP POLICY IF EXISTS "Enable all access for all users" ON badges;

CREATE POLICY "Enable all access for all users" ON badges
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- --- VISITS ---
DROP POLICY IF EXISTS "Enable read access for all users" ON visits;
DROP POLICY IF EXISTS "Enable insert for all users" ON visits;
DROP POLICY IF EXISTS "Enable update for all users" ON visits;
DROP POLICY IF EXISTS "Enable all access for all users" ON visits;

CREATE POLICY "Enable all access for all users" ON visits
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- --- USER LOGS ---
DROP POLICY IF EXISTS "Enable insert for all users" ON user_logs;
CREATE POLICY "Enable insert for all users" ON user_logs
FOR INSERT TO anon, authenticated WITH CHECK (true);

-- --- EMPLOYEES ---
DROP POLICY IF EXISTS "Enable read access for all users" ON employees;
DROP POLICY IF EXISTS "Enable insert/update for management API" ON employees;
DROP POLICY IF EXISTS "Enable write access for all users" ON employees;

-- Read: Public (needed for lists)
CREATE POLICY "Enable read access for all users" ON employees
FOR SELECT TO anon, authenticated USING (true);

-- Write (Insert/Update/Delete): Allowed for anon (Management API & Admin Panel)
CREATE POLICY "Enable write access for all users" ON employees
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ==========================================
-- 5. PERMISSIONS & COLUMN SECURITY
-- ==========================================

-- Revoke default SELECT to reset/enforce granular control
REVOKE SELECT ON employees FROM anon, authenticated;

-- Grant SELECT on columns required by the application.
-- Code expects 'password' to be readable to check existence (IS NOT NULL).
GRANT SELECT (id, name, department_id, role, "password") ON employees TO anon, authenticated;


-- ==========================================
-- 6. FUNCTIONS
-- ==========================================

-- Function: verify_employee_pin
-- Updated to use 'password' column
CREATE OR REPLACE FUNCTION verify_employee_pin(p_pin text)
RETURNS TABLE (
  id bigint,
  name text,
  role text,
  department_name text
)
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_emp record;
BEGIN
  FOR v_emp IN 
    SELECT e.id, e.name, e.role, e.password, d.name as department_name
    FROM employees e 
    LEFT JOIN departments d ON e.department_id = d.id 
  LOOP
    BEGIN
      -- Check password match
      IF v_emp.password IS NOT NULL AND v_emp.password = crypt(p_pin, v_emp.password) THEN
        id := v_emp.id;
        name := v_emp.name;
        role := v_emp.role;
        department_name := v_emp.department_name;
        RETURN NEXT;
        RETURN; -- Exit after finding match
      END IF;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function: update_employee_password
-- Replaces update_employee_pin_hash
CREATE OR REPLACE FUNCTION update_employee_password(p_employee_id bigint, p_pin text)
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE employees
  SET "password" = crypt(p_pin, gen_salt('bf'))
  WHERE id = p_employee_id;
END;
$$ LANGUAGE plpgsql;

-- Drop old function if exists
DROP FUNCTION IF EXISTS update_employee_pin_hash(bigint, text);


-- ==========================================
-- 7. FOREIGN KEYS (Cascade Delete Fix)
-- ==========================================

DO $$
BEGIN
    -- Drop existing constraint if it exists to ensure we can recreate it with CASCADE
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'visits_employee_id_fkey' 
        AND table_name = 'visits'
    ) THEN
        ALTER TABLE visits DROP CONSTRAINT visits_employee_id_fkey;
    END IF;
END $$;

-- Add constraint with ON DELETE CASCADE
ALTER TABLE visits
ADD CONSTRAINT visits_employee_id_fkey
FOREIGN KEY (employee_id)
REFERENCES employees(id)
ON DELETE CASCADE;

COMMIT;
