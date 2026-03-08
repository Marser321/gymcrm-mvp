-- GymCRM staff profiles (hybrid staff management without mandatory login)
-- Adds profile persistence for staff entries linked by gimnasio + user_id.

SET search_path = gymcrm, public;

CREATE TABLE IF NOT EXISTS gymcrm.staff_perfiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  telefono text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gimnasio_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_perfiles_lookup ON gymcrm.staff_perfiles(gimnasio_id, user_id);

DROP TRIGGER IF EXISTS trg_staff_perfiles_touch_updated_at ON gymcrm.staff_perfiles;
CREATE TRIGGER trg_staff_perfiles_touch_updated_at
BEFORE UPDATE ON gymcrm.staff_perfiles
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_audit_staff_perfiles ON gymcrm.staff_perfiles;
CREATE TRIGGER trg_audit_staff_perfiles
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.staff_perfiles
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

ALTER TABLE gymcrm.staff_perfiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'gymcrm'
      AND tablename IN ('staff_perfiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END;
$$;

CREATE POLICY project_admin_all_staff_perfiles ON gymcrm.staff_perfiles
  FOR ALL TO project_admin
  USING (true) WITH CHECK (true);

CREATE POLICY staff_perfiles_read ON gymcrm.staff_perfiles
  FOR SELECT TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador', 'nutricionista']));

CREATE POLICY staff_perfiles_write ON gymcrm.staff_perfiles
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

-- Open demo mode: allow anon to operate staff profiles without login friction.
CREATE POLICY anon_all_staff_perfiles ON gymcrm.staff_perfiles
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW public.gymcrm_staff_perfiles WITH (security_invoker = true) AS
SELECT * FROM gymcrm.staff_perfiles;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_staff_perfiles TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
