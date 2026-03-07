-- GymCRM profundizacion (B3 primero, luego B2)
-- Extiende bloque base con runtime dinamico, gamificacion, nutricion avanzada y cola de notificaciones.

SET search_path = gymcrm, public;

-- ===== Builder runtime =====
CREATE TABLE IF NOT EXISTS gymcrm.builder_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  sede_id uuid REFERENCES gymcrm.sedes(id) ON DELETE SET NULL,
  servicio_id uuid NOT NULL REFERENCES gymcrm.builder_servicios(id) ON DELETE CASCADE,
  version_id uuid REFERENCES gymcrm.builder_servicio_versiones(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descripcion text,
  inicio timestamptz NOT NULL,
  fin timestamptz NOT NULL,
  cupo_total integer NOT NULL CHECK (cupo_total > 0),
  estado text NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada', 'cancelada', 'finalizada')),
  reglas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fin > inicio)
);

CREATE TABLE IF NOT EXISTS gymcrm.builder_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  sesion_id uuid NOT NULL REFERENCES gymcrm.builder_sesiones(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES gymcrm.builder_servicios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada', 'espera', 'cancelada', 'asistio', 'ausente')),
  prioridad_espera integer NOT NULL DEFAULT 0,
  cancelada_en timestamptz,
  registrado_por text DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sesion_id, cliente_id)
);

-- ===== Comunidad y canjes =====
ALTER TABLE gymcrm.comunidad_puntos_movimientos
  ADD COLUMN IF NOT EXISTS origen_tipo text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS origen_ref uuid,
  ADD COLUMN IF NOT EXISTS aprobado_por text,
  ADD COLUMN IF NOT EXISTS anulacion_de uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comunidad_puntos_origen_tipo_check'
      AND conrelid = 'gymcrm.comunidad_puntos_movimientos'::regclass
  ) THEN
    ALTER TABLE gymcrm.comunidad_puntos_movimientos
      ADD CONSTRAINT comunidad_puntos_origen_tipo_check
      CHECK (origen_tipo IN ('manual', 'reto', 'reserva', 'evento', 'canje_ajuste'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comunidad_puntos_anulacion_fk'
      AND conrelid = 'gymcrm.comunidad_puntos_movimientos'::regclass
  ) THEN
    ALTER TABLE gymcrm.comunidad_puntos_movimientos
      ADD CONSTRAINT comunidad_puntos_anulacion_fk
      FOREIGN KEY (anulacion_de)
      REFERENCES gymcrm.comunidad_puntos_movimientos(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS gymcrm.comunidad_premios_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  tipo text NOT NULL CHECK (tipo IN ('descuento_pago', 'pase_servicio')),
  costo_puntos integer NOT NULL CHECK (costo_puntos > 0),
  monto_descuento numeric(12,2) CHECK (monto_descuento >= 0),
  moneda text NOT NULL DEFAULT 'UYU',
  servicio_id uuid REFERENCES gymcrm.builder_servicios(id) ON DELETE SET NULL,
  vigencia_desde date,
  vigencia_hasta date,
  stock_total integer CHECK (stock_total > 0),
  stock_disponible integer CHECK (stock_disponible >= 0),
  activa boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vigencia_hasta IS NULL OR vigencia_desde IS NULL OR vigencia_hasta >= vigencia_desde)
);

CREATE TABLE IF NOT EXISTS gymcrm.comunidad_canjes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  premio_id uuid NOT NULL REFERENCES gymcrm.comunidad_premios_catalogo(id) ON DELETE RESTRICT,
  estado text NOT NULL DEFAULT 'solicitado' CHECK (estado IN ('solicitado', 'aprobado', 'rechazado', 'entregado', 'anulado')),
  puntos integer NOT NULL CHECK (puntos > 0),
  credito_monto numeric(12,2) CHECK (credito_monto >= 0),
  credito_moneda text NOT NULL DEFAULT 'UYU',
  cupon_codigo text,
  motivo_rechazo text,
  aprobado_por text,
  resuelto_por text,
  solicitado_en timestamptz NOT NULL DEFAULT now(),
  aprobado_en timestamptz,
  entregado_en timestamptz,
  anulado_en timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Nutricion avanzada =====
CREATE TABLE IF NOT EXISTS gymcrm.nutricion_consentimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  version_texto text NOT NULL,
  medio text NOT NULL CHECK (medio IN ('app', 'staff')),
  aceptado_en timestamptz NOT NULL DEFAULT now(),
  aceptado_por text NOT NULL DEFAULT gymcrm.current_user_id(),
  activo boolean NOT NULL DEFAULT true,
  revocado_en timestamptz,
  revocado_por text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gymcrm.nutricion_planes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  nutricionista_user_id text NOT NULL DEFAULT gymcrm.current_user_id(),
  consentimiento_id uuid REFERENCES gymcrm.nutricion_consentimientos(id) ON DELETE RESTRICT,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'activo', 'sustituido', 'cerrado')),
  objetivo_general text,
  notas text,
  activo_desde date,
  activo_hasta date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (activo_hasta IS NULL OR activo_desde IS NULL OR activo_hasta >= activo_desde)
);

CREATE TABLE IF NOT EXISTS gymcrm.nutricion_plan_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES gymcrm.nutricion_planes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  contenido jsonb NOT NULL,
  publicado boolean NOT NULL DEFAULT false,
  notas text,
  created_by text NOT NULL DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version)
);

CREATE TABLE IF NOT EXISTS gymcrm.nutricion_mediciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES gymcrm.nutricion_planes(id) ON DELETE SET NULL,
  peso_kg numeric(5,2) CHECK (peso_kg > 0),
  grasa_pct numeric(5,2) CHECK (grasa_pct >= 0 AND grasa_pct <= 100),
  perimetros jsonb,
  adherencia_pct numeric(5,2) CHECK (adherencia_pct >= 0 AND adherencia_pct <= 100),
  notas text,
  fecha_medicion date NOT NULL DEFAULT CURRENT_DATE,
  registrado_por text NOT NULL DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Cola de WhatsApp =====
CREATE TABLE IF NOT EXISTS gymcrm.notificaciones_whatsapp_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  to_phone text NOT NULL,
  template text,
  message text NOT NULL,
  context jsonb,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'fallido', 'cancelado')),
  intentos integer NOT NULL DEFAULT 0,
  max_intentos integer NOT NULL DEFAULT 3,
  ultimo_error text,
  provider_ref text,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_builder_sesiones_gimnasio_inicio ON gymcrm.builder_sesiones(gimnasio_id, inicio);
CREATE INDEX IF NOT EXISTS idx_builder_sesiones_servicio ON gymcrm.builder_sesiones(servicio_id, inicio);
CREATE INDEX IF NOT EXISTS idx_builder_reservas_sesion_estado ON gymcrm.builder_reservas(sesion_id, estado);
CREATE INDEX IF NOT EXISTS idx_builder_reservas_cliente ON gymcrm.builder_reservas(cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comunidad_puntos_cliente_fecha ON gymcrm.comunidad_puntos_movimientos(cliente_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comunidad_puntos_unique_canje_motivo
ON gymcrm.comunidad_puntos_movimientos(origen_ref, motivo)
WHERE origen_tipo = 'canje_ajuste';
CREATE INDEX IF NOT EXISTS idx_comunidad_premios_gym_activa ON gymcrm.comunidad_premios_catalogo(gimnasio_id, activa);
CREATE INDEX IF NOT EXISTS idx_comunidad_canjes_gym_estado ON gymcrm.comunidad_canjes(gimnasio_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comunidad_canjes_cliente ON gymcrm.comunidad_canjes(cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutri_consentimientos_cliente ON gymcrm.nutricion_consentimientos(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nutri_planes_cliente_estado ON gymcrm.nutricion_planes(cliente_id, estado);
CREATE INDEX IF NOT EXISTS idx_nutri_versiones_plan ON gymcrm.nutricion_plan_versiones(plan_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_nutri_mediciones_cliente_fecha ON gymcrm.nutricion_mediciones(cliente_id, fecha_medicion DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_estado_retry ON gymcrm.notificaciones_whatsapp_queue(estado, next_retry_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nutri_plan_activo_por_cliente
ON gymcrm.nutricion_planes(gimnasio_id, cliente_id)
WHERE estado = 'activo';

-- ===== Triggers =====
DROP TRIGGER IF EXISTS trg_builder_sesiones_touch_updated_at ON gymcrm.builder_sesiones;
CREATE TRIGGER trg_builder_sesiones_touch_updated_at
BEFORE UPDATE ON gymcrm.builder_sesiones
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_builder_reservas_touch_updated_at ON gymcrm.builder_reservas;
CREATE TRIGGER trg_builder_reservas_touch_updated_at
BEFORE UPDATE ON gymcrm.builder_reservas
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_comunidad_puntos_touch_updated_at ON gymcrm.comunidad_puntos_movimientos;
CREATE TRIGGER trg_comunidad_puntos_touch_updated_at
BEFORE UPDATE ON gymcrm.comunidad_puntos_movimientos
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_comunidad_premios_touch_updated_at ON gymcrm.comunidad_premios_catalogo;
CREATE TRIGGER trg_comunidad_premios_touch_updated_at
BEFORE UPDATE ON gymcrm.comunidad_premios_catalogo
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_comunidad_canjes_touch_updated_at ON gymcrm.comunidad_canjes;
CREATE TRIGGER trg_comunidad_canjes_touch_updated_at
BEFORE UPDATE ON gymcrm.comunidad_canjes
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_nutri_consent_touch_updated_at ON gymcrm.nutricion_consentimientos;
CREATE TRIGGER trg_nutri_consent_touch_updated_at
BEFORE UPDATE ON gymcrm.nutricion_consentimientos
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_nutri_planes_touch_updated_at ON gymcrm.nutricion_planes;
CREATE TRIGGER trg_nutri_planes_touch_updated_at
BEFORE UPDATE ON gymcrm.nutricion_planes
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_queue_touch_updated_at ON gymcrm.notificaciones_whatsapp_queue;
CREATE TRIGGER trg_whatsapp_queue_touch_updated_at
BEFORE UPDATE ON gymcrm.notificaciones_whatsapp_queue
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

-- ===== Builder waitlist helpers =====
CREATE OR REPLACE FUNCTION gymcrm.builder_asignar_prioridad_espera()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.estado = 'espera' AND NEW.prioridad_espera = 0 THEN
    SELECT COALESCE(MAX(r.prioridad_espera), 0) + 1
    INTO NEW.prioridad_espera
    FROM gymcrm.builder_reservas r
    WHERE r.sesion_id = NEW.sesion_id
      AND r.estado = 'espera';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_builder_reservas_prioridad_espera ON gymcrm.builder_reservas;
CREATE TRIGGER trg_builder_reservas_prioridad_espera
BEFORE INSERT ON gymcrm.builder_reservas
FOR EACH ROW EXECUTE FUNCTION gymcrm.builder_asignar_prioridad_espera();

CREATE OR REPLACE FUNCTION gymcrm.promover_lista_espera_builder(p_sesion_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = gymcrm, public
AS $$
DECLARE
  v_cupo integer;
  v_ocupados integer;
  v_disponibles integer;
  v_promovidos integer := 0;
BEGIN
  SELECT s.cupo_total
  INTO v_cupo
  FROM gymcrm.builder_sesiones s
  WHERE s.id = p_sesion_id
    AND s.estado = 'programada';

  IF v_cupo IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)
  INTO v_ocupados
  FROM gymcrm.builder_reservas r
  WHERE r.sesion_id = p_sesion_id
    AND r.estado IN ('confirmada', 'asistio');

  v_disponibles := GREATEST(v_cupo - v_ocupados, 0);
  IF v_disponibles = 0 THEN
    RETURN 0;
  END IF;

  WITH candidatos AS (
    SELECT r.id
    FROM gymcrm.builder_reservas r
    WHERE r.sesion_id = p_sesion_id
      AND r.estado = 'espera'
    ORDER BY r.prioridad_espera ASC, r.created_at ASC
    LIMIT v_disponibles
    FOR UPDATE SKIP LOCKED
  )
  UPDATE gymcrm.builder_reservas r
  SET estado = 'confirmada',
      prioridad_espera = 0,
      updated_at = now()
  WHERE r.id IN (SELECT id FROM candidatos);

  GET DIAGNOSTICS v_promovidos = ROW_COUNT;
  RETURN v_promovidos;
END;
$$;

-- ===== Comunidad helpers =====
CREATE OR REPLACE FUNCTION gymcrm.comunidad_saldo_cliente(p_gimnasio_id uuid, p_cliente_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = gymcrm, public
AS $$
  SELECT COALESCE(SUM(m.puntos), 0)::integer
  FROM gymcrm.comunidad_puntos_movimientos m
  WHERE m.gimnasio_id = p_gimnasio_id
    AND m.cliente_id = p_cliente_id;
$$;

-- ===== Nutricion: consentimiento obligatorio para activar plan =====
CREATE OR REPLACE FUNCTION gymcrm.validar_consentimiento_plan_nutricion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_valido boolean;
BEGIN
  IF NEW.estado <> 'activo' THEN
    RETURN NEW;
  END IF;

  IF NEW.consentimiento_id IS NULL THEN
    RAISE EXCEPTION 'No se puede activar un plan sin consentimiento.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM gymcrm.nutricion_consentimientos nc
    WHERE nc.id = NEW.consentimiento_id
      AND nc.gimnasio_id = NEW.gimnasio_id
      AND nc.cliente_id = NEW.cliente_id
      AND nc.activo = true
      AND nc.revocado_en IS NULL
  )
  INTO v_valido;

  IF NOT v_valido THEN
    RAISE EXCEPTION 'El consentimiento seleccionado no esta vigente para este cliente.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_consentimiento_plan_nutricion ON gymcrm.nutricion_planes;
CREATE TRIGGER trg_validar_consentimiento_plan_nutricion
BEFORE INSERT OR UPDATE ON gymcrm.nutricion_planes
FOR EACH ROW EXECUTE FUNCTION gymcrm.validar_consentimiento_plan_nutricion();

-- ===== Auditoria critica =====
DROP TRIGGER IF EXISTS trg_audit_builder_sesiones ON gymcrm.builder_sesiones;
CREATE TRIGGER trg_audit_builder_sesiones
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.builder_sesiones
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

DROP TRIGGER IF EXISTS trg_audit_builder_reservas ON gymcrm.builder_reservas;
CREATE TRIGGER trg_audit_builder_reservas
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.builder_reservas
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

DROP TRIGGER IF EXISTS trg_audit_comunidad_puntos ON gymcrm.comunidad_puntos_movimientos;
CREATE TRIGGER trg_audit_comunidad_puntos
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.comunidad_puntos_movimientos
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

DROP TRIGGER IF EXISTS trg_audit_comunidad_canjes ON gymcrm.comunidad_canjes;
CREATE TRIGGER trg_audit_comunidad_canjes
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.comunidad_canjes
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

DROP TRIGGER IF EXISTS trg_audit_nutricion_consent ON gymcrm.nutricion_consentimientos;
CREATE TRIGGER trg_audit_nutricion_consent
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.nutricion_consentimientos
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

DROP TRIGGER IF EXISTS trg_audit_nutricion_planes ON gymcrm.nutricion_planes;
CREATE TRIGGER trg_audit_nutricion_planes
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.nutricion_planes
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

-- ===== RLS new tables =====
ALTER TABLE gymcrm.builder_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.builder_reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.comunidad_premios_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.comunidad_canjes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.nutricion_consentimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.nutricion_planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.nutricion_plan_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.nutricion_mediciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.notificaciones_whatsapp_queue ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'gymcrm'
      AND tablename IN (
        'builder_servicios',
        'builder_servicio_versiones',
        'builder_sesiones',
        'builder_reservas',
        'comunidad_retos',
        'comunidad_puntos_movimientos',
        'comunidad_premios_catalogo',
        'comunidad_canjes',
        'nutricion_consentimientos',
        'nutricion_planes',
        'nutricion_plan_versiones',
        'nutricion_mediciones',
        'notificaciones_whatsapp_queue'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END;
$$;

-- Replace coarse policies from B0/B1 where needed
DROP POLICY IF EXISTS builder_servicios_rw ON gymcrm.builder_servicios;
DROP POLICY IF EXISTS builder_versiones_rw ON gymcrm.builder_servicio_versiones;
DROP POLICY IF EXISTS retos_rw ON gymcrm.comunidad_retos;
DROP POLICY IF EXISTS puntos_rw ON gymcrm.comunidad_puntos_movimientos;

-- Project admin bypass (new tables)
CREATE POLICY project_admin_all_builder_sesiones ON gymcrm.builder_sesiones FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_builder_reservas ON gymcrm.builder_reservas FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_premios ON gymcrm.comunidad_premios_catalogo FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_canjes ON gymcrm.comunidad_canjes FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_nutri_consent ON gymcrm.nutricion_consentimientos FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_nutri_planes ON gymcrm.nutricion_planes FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_nutri_planes_v ON gymcrm.nutricion_plan_versiones FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_nutri_mediciones ON gymcrm.nutricion_mediciones FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_whatsapp_queue ON gymcrm.notificaciones_whatsapp_queue FOR ALL TO project_admin USING (true) WITH CHECK (true);

-- Builder service definitions: read published for clients, full access for staff
CREATE POLICY builder_servicios_read ON gymcrm.builder_servicios
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador'])
    OR (
      gymcrm.user_has_role(gimnasio_id, ARRAY['cliente', 'nutricionista'])
      AND estado = 'publicado'
      AND activo = true
    )
  );

CREATE POLICY builder_servicios_write ON gymcrm.builder_servicios
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

CREATE POLICY builder_versiones_read ON gymcrm.builder_servicio_versiones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM gymcrm.builder_servicios bs
      WHERE bs.id = builder_servicio_versiones.servicio_id
        AND (
          gymcrm.user_has_role(bs.gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador'])
          OR (
            gymcrm.user_has_role(bs.gimnasio_id, ARRAY['cliente', 'nutricionista'])
            AND bs.estado = 'publicado'
            AND builder_servicio_versiones.publicado = true
          )
        )
    )
  );

CREATE POLICY builder_versiones_write ON gymcrm.builder_servicio_versiones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM gymcrm.builder_servicios bs
      WHERE bs.id = builder_servicio_versiones.servicio_id
        AND gymcrm.user_has_role(bs.gimnasio_id, ARRAY['admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM gymcrm.builder_servicios bs
      WHERE bs.id = builder_servicio_versiones.servicio_id
        AND gymcrm.user_has_role(bs.gimnasio_id, ARRAY['admin'])
    )
  );

CREATE POLICY builder_sesiones_read ON gymcrm.builder_sesiones
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador'])
    OR (
      gymcrm.user_has_role(gimnasio_id, ARRAY['cliente', 'nutricionista'])
      AND estado = 'programada'
    )
  );

CREATE POLICY builder_sesiones_write ON gymcrm.builder_sesiones
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']));

CREATE POLICY builder_reservas_read ON gymcrm.builder_reservas
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador'])
    OR EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = builder_reservas.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY builder_reservas_write_staff ON gymcrm.builder_reservas
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']));

CREATE POLICY builder_reservas_insert_cliente ON gymcrm.builder_reservas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = builder_reservas.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY builder_reservas_update_cliente ON gymcrm.builder_reservas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = builder_reservas.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = builder_reservas.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

-- Comunidad: retos/puntos/premios/canjes
CREATE POLICY retos_read ON gymcrm.comunidad_retos
  FOR SELECT TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista']));

CREATE POLICY retos_write ON gymcrm.comunidad_retos
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']));

CREATE POLICY puntos_read ON gymcrm.comunidad_puntos_movimientos
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador'])
    OR EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = comunidad_puntos_movimientos.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY puntos_write ON gymcrm.comunidad_puntos_movimientos
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']));

CREATE POLICY premios_read ON gymcrm.comunidad_premios_catalogo
  FOR SELECT TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista']));

CREATE POLICY premios_write ON gymcrm.comunidad_premios_catalogo
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']));

CREATE POLICY canjes_read ON gymcrm.comunidad_canjes
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador'])
    OR EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = comunidad_canjes.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY canjes_write_staff ON gymcrm.comunidad_canjes
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']));

CREATE POLICY canjes_insert_cliente ON gymcrm.comunidad_canjes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = comunidad_canjes.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

-- Nutricion: consentimiento, planes, versiones, mediciones
CREATE POLICY nutri_consent_read ON gymcrm.nutricion_consentimientos
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista'])
    OR EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = nutricion_consentimientos.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY nutri_consent_insert ON gymcrm.nutricion_consentimientos
  FOR INSERT TO authenticated
  WITH CHECK (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista'])
    OR EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = nutricion_consentimientos.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY nutri_consent_update ON gymcrm.nutricion_consentimientos
  FOR UPDATE TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista']));

CREATE POLICY nutri_planes_read ON gymcrm.nutricion_planes
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista'])
    OR EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = nutricion_planes.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY nutri_planes_write ON gymcrm.nutricion_planes
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista']));

CREATE POLICY nutri_plan_v_read ON gymcrm.nutricion_plan_versiones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM gymcrm.nutricion_planes np
      WHERE np.id = nutricion_plan_versiones.plan_id
        AND (
          gymcrm.user_has_role(np.gimnasio_id, ARRAY['admin', 'nutricionista'])
          OR EXISTS (
            SELECT 1
            FROM gymcrm.clientes c
            WHERE c.id = np.cliente_id
              AND c.auth_user_id = gymcrm.current_user_id()
          )
        )
    )
  );

CREATE POLICY nutri_plan_v_write ON gymcrm.nutricion_plan_versiones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM gymcrm.nutricion_planes np
      WHERE np.id = nutricion_plan_versiones.plan_id
        AND gymcrm.user_has_role(np.gimnasio_id, ARRAY['admin', 'nutricionista'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM gymcrm.nutricion_planes np
      WHERE np.id = nutricion_plan_versiones.plan_id
        AND gymcrm.user_has_role(np.gimnasio_id, ARRAY['admin', 'nutricionista'])
    )
  );

CREATE POLICY nutri_mediciones_read ON gymcrm.nutricion_mediciones
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista'])
    OR EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = nutricion_mediciones.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY nutri_mediciones_write_staff ON gymcrm.nutricion_mediciones
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista']));

CREATE POLICY nutri_mediciones_insert_cliente ON gymcrm.nutricion_mediciones
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM gymcrm.clientes c
      WHERE c.id = nutricion_mediciones.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

-- Cola de notificaciones
CREATE POLICY whatsapp_queue_rw ON gymcrm.notificaciones_whatsapp_queue
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']));

-- ===== Function grants =====
GRANT EXECUTE ON FUNCTION gymcrm.promover_lista_espera_builder(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION gymcrm.comunidad_saldo_cliente(uuid, uuid) TO authenticated, anon;

-- ===== Public bridge for PostgREST =====
CREATE OR REPLACE FUNCTION public.gymcrm_promover_lista_espera_builder(p_sesion_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = gymcrm, public
AS $$
  SELECT gymcrm.promover_lista_espera_builder(p_sesion_id);
$$;

CREATE OR REPLACE FUNCTION public.gymcrm_comunidad_saldo_cliente(p_gimnasio_id uuid, p_cliente_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = gymcrm, public
AS $$
  SELECT gymcrm.comunidad_saldo_cliente(p_gimnasio_id, p_cliente_id);
$$;

GRANT EXECUTE ON FUNCTION public.gymcrm_promover_lista_espera_builder(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.gymcrm_comunidad_saldo_cliente(uuid, uuid) TO authenticated, anon;

CREATE OR REPLACE VIEW public.gymcrm_builder_sesiones WITH (security_invoker = true) AS SELECT * FROM gymcrm.builder_sesiones;
CREATE OR REPLACE VIEW public.gymcrm_builder_reservas WITH (security_invoker = true) AS SELECT * FROM gymcrm.builder_reservas;
CREATE OR REPLACE VIEW public.gymcrm_comunidad_premios_catalogo WITH (security_invoker = true) AS SELECT * FROM gymcrm.comunidad_premios_catalogo;
CREATE OR REPLACE VIEW public.gymcrm_comunidad_canjes WITH (security_invoker = true) AS SELECT * FROM gymcrm.comunidad_canjes;
CREATE OR REPLACE VIEW public.gymcrm_nutricion_consentimientos WITH (security_invoker = true) AS SELECT * FROM gymcrm.nutricion_consentimientos;
CREATE OR REPLACE VIEW public.gymcrm_nutricion_planes WITH (security_invoker = true) AS SELECT * FROM gymcrm.nutricion_planes;
CREATE OR REPLACE VIEW public.gymcrm_nutricion_plan_versiones WITH (security_invoker = true) AS SELECT * FROM gymcrm.nutricion_plan_versiones;
CREATE OR REPLACE VIEW public.gymcrm_nutricion_mediciones WITH (security_invoker = true) AS SELECT * FROM gymcrm.nutricion_mediciones;
CREATE OR REPLACE VIEW public.gymcrm_notificaciones_whatsapp_queue WITH (security_invoker = true) AS SELECT * FROM gymcrm.notificaciones_whatsapp_queue;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_builder_sesiones TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_builder_reservas TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_comunidad_premios_catalogo TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_comunidad_canjes TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_nutricion_consentimientos TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_nutricion_planes TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_nutricion_plan_versiones TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_nutricion_mediciones TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_notificaciones_whatsapp_queue TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
