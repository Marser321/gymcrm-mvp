-- GymCRM UI experience persistence (demo premium UX)
-- Adds backend persistence for theme/haptics/reduced-motion + onboarding state.

SET search_path = gymcrm, public;

CREATE TABLE IF NOT EXISTS gymcrm.ui_preferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista')),
  theme_id text NOT NULL DEFAULT 'default' CHECK (theme_id IN ('default', 'graphite', 'ocean', 'sand')),
  haptics_enabled boolean NOT NULL DEFAULT false,
  reduced_motion boolean NOT NULL DEFAULT false,
  analytics_consent text NOT NULL DEFAULT 'pending' CHECK (analytics_consent IN ('pending', 'granted', 'denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gimnasio_id, user_id, rol)
);

CREATE TABLE IF NOT EXISTS gymcrm.ui_onboarding_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gimnasio_id, user_id, rol)
);

CREATE INDEX IF NOT EXISTS idx_ui_pref_lookup ON gymcrm.ui_preferencias(gimnasio_id, user_id, rol);
CREATE INDEX IF NOT EXISTS idx_ui_onboarding_lookup ON gymcrm.ui_onboarding_estado(gimnasio_id, user_id, rol);

DROP TRIGGER IF EXISTS trg_ui_preferencias_touch_updated_at ON gymcrm.ui_preferencias;
CREATE TRIGGER trg_ui_preferencias_touch_updated_at
BEFORE UPDATE ON gymcrm.ui_preferencias
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_ui_onboarding_touch_updated_at ON gymcrm.ui_onboarding_estado;
CREATE TRIGGER trg_ui_onboarding_touch_updated_at
BEFORE UPDATE ON gymcrm.ui_onboarding_estado
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_audit_ui_preferencias ON gymcrm.ui_preferencias;
CREATE TRIGGER trg_audit_ui_preferencias
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.ui_preferencias
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

DROP TRIGGER IF EXISTS trg_audit_ui_onboarding ON gymcrm.ui_onboarding_estado;
CREATE TRIGGER trg_audit_ui_onboarding
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.ui_onboarding_estado
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

ALTER TABLE gymcrm.ui_preferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.ui_onboarding_estado ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'gymcrm'
      AND tablename IN ('ui_preferencias', 'ui_onboarding_estado')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END;
$$;

CREATE POLICY project_admin_all_ui_preferencias ON gymcrm.ui_preferencias
  FOR ALL TO project_admin
  USING (true) WITH CHECK (true);

CREATE POLICY project_admin_all_ui_onboarding ON gymcrm.ui_onboarding_estado
  FOR ALL TO project_admin
  USING (true) WITH CHECK (true);

-- Open demo mode: allow anon to persist UX preferences without auth friction.
CREATE POLICY anon_all_ui_preferencias ON gymcrm.ui_preferencias
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY anon_all_ui_onboarding ON gymcrm.ui_onboarding_estado
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY ui_preferencias_read ON gymcrm.ui_preferencias
  FOR SELECT TO authenticated
  USING (user_id = gymcrm.current_user_id() OR gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

CREATE POLICY ui_preferencias_write ON gymcrm.ui_preferencias
  FOR ALL TO authenticated
  USING (user_id = gymcrm.current_user_id() OR gymcrm.user_has_role(gimnasio_id, ARRAY['admin']))
  WITH CHECK (user_id = gymcrm.current_user_id() OR gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

CREATE POLICY ui_onboarding_read ON gymcrm.ui_onboarding_estado
  FOR SELECT TO authenticated
  USING (user_id = gymcrm.current_user_id() OR gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

CREATE POLICY ui_onboarding_write ON gymcrm.ui_onboarding_estado
  FOR ALL TO authenticated
  USING (user_id = gymcrm.current_user_id() OR gymcrm.user_has_role(gimnasio_id, ARRAY['admin']))
  WITH CHECK (user_id = gymcrm.current_user_id() OR gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

CREATE OR REPLACE VIEW public.gymcrm_ui_preferencias WITH (security_invoker = true) AS
SELECT * FROM gymcrm.ui_preferencias;

CREATE OR REPLACE VIEW public.gymcrm_ui_onboarding_estado WITH (security_invoker = true) AS
SELECT * FROM gymcrm.ui_onboarding_estado;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_ui_preferencias TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_ui_onboarding_estado TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
