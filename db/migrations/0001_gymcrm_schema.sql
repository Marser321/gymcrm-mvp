-- GymCRM foundation schema (Bloque 0)
-- Market defaults: Uruguay / UYU

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS gymcrm;

-- ===== Utility functions =====
CREATE OR REPLACE FUNCTION gymcrm.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.uid()::text, '');
$$;

CREATE OR REPLACE FUNCTION gymcrm.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION gymcrm.user_has_role(p_gimnasio_id uuid, p_roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = gymcrm, public
AS $$
DECLARE
  v_user_id text;
BEGIN
  v_user_id := gymcrm.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM gymcrm.usuarios_roles ur
    WHERE ur.gimnasio_id = p_gimnasio_id
      AND ur.user_id = v_user_id
      AND ur.activo = true
      AND (p_roles IS NULL OR ur.rol = ANY(p_roles))
  );
END;
$$;

CREATE OR REPLACE FUNCTION gymcrm.user_is_cliente_propio(p_cliente_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = gymcrm, public
AS $$
DECLARE
  v_user_id text;
BEGIN
  v_user_id := gymcrm.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM gymcrm.clientes c
    WHERE c.id = p_cliente_id
      AND c.auth_user_id = v_user_id
      AND c.estado <> 'inactivo'
  );
END;
$$;

-- ===== Core tables =====
CREATE TABLE IF NOT EXISTS gymcrm.gimnasios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  moneda text NOT NULL DEFAULT 'UYU',
  pais text NOT NULL DEFAULT 'UY',
  zona_horaria text NOT NULL DEFAULT 'America/Montevideo',
  activo boolean NOT NULL DEFAULT true,
  created_by text NOT NULL DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gymcrm.sedes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  direccion text,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gymcrm.usuarios_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  sede_id uuid REFERENCES gymcrm.sedes(id) ON DELETE SET NULL,
  user_id text NOT NULL,
  email text,
  rol text NOT NULL CHECK (rol IN ('admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista')),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gimnasio_id, user_id, rol)
);

CREATE TABLE IF NOT EXISTS gymcrm.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  sede_id uuid REFERENCES gymcrm.sedes(id) ON DELETE SET NULL,
  auth_user_id text UNIQUE,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  email text,
  telefono text,
  fecha_nacimiento date,
  objetivo text,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
  codigo_qr text NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gimnasio_id, codigo_qr),
  UNIQUE (gimnasio_id, email)
);

CREATE TABLE IF NOT EXISTS gymcrm.planes_membresia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  precio numeric(12,2) NOT NULL CHECK (precio >= 0),
  moneda text NOT NULL DEFAULT 'UYU',
  duracion_dias integer NOT NULL CHECK (duracion_dias > 0),
  incluye_reservas boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gimnasio_id, nombre)
);

CREATE TABLE IF NOT EXISTS gymcrm.membresias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES gymcrm.planes_membresia(id) ON DELETE RESTRICT,
  estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'vencida', 'suspendida', 'cancelada')),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  renovacion_automatica boolean NOT NULL DEFAULT false,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS gymcrm.pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  membresia_id uuid REFERENCES gymcrm.membresias(id) ON DELETE SET NULL,
  monto numeric(12,2) NOT NULL CHECK (monto >= 0),
  moneda text NOT NULL DEFAULT 'UYU',
  estado text NOT NULL DEFAULT 'registrado' CHECK (estado IN ('pendiente', 'registrado', 'anulado')),
  metodo text NOT NULL DEFAULT 'manual',
  referencia text,
  fecha_pago timestamptz NOT NULL DEFAULT now(),
  registrado_por text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gymcrm.clases_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  sede_id uuid REFERENCES gymcrm.sedes(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  descripcion text,
  cupo_total integer NOT NULL CHECK (cupo_total > 0),
  duracion_min integer NOT NULL CHECK (duracion_min > 0),
  instructor_nombre text,
  nivel text,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gymcrm.clases_horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  sede_id uuid REFERENCES gymcrm.sedes(id) ON DELETE SET NULL,
  clase_base_id uuid NOT NULL REFERENCES gymcrm.clases_base(id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL,
  fin timestamptz NOT NULL,
  cupo_total integer NOT NULL CHECK (cupo_total > 0),
  estado text NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada', 'cancelada', 'finalizada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fin > inicio)
);

CREATE TABLE IF NOT EXISTS gymcrm.reservas_clases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  horario_id uuid NOT NULL REFERENCES gymcrm.clases_horarios(id) ON DELETE CASCADE,
  clase_base_id uuid NOT NULL REFERENCES gymcrm.clases_base(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada', 'espera', 'cancelada', 'asistio', 'ausente')),
  prioridad_espera integer NOT NULL DEFAULT 0,
  cancelada_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (horario_id, cliente_id)
);

CREATE TABLE IF NOT EXISTS gymcrm.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  sede_id uuid REFERENCES gymcrm.sedes(id) ON DELETE SET NULL,
  horario_id uuid REFERENCES gymcrm.clases_horarios(id) ON DELETE SET NULL,
  metodo text NOT NULL CHECK (metodo IN ('qr', 'manual')),
  registrado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gymcrm.auditoria_critica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid,
  entidad text NOT NULL,
  entidad_id uuid,
  accion text NOT NULL,
  actor_user_id text,
  actor_rol text,
  antes jsonb,
  despues jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Bloque 2 tables (nutrition) =====
CREATE TABLE IF NOT EXISTS gymcrm.nutricion_fichas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  nutricionista_user_id text,
  objetivos text,
  recomendaciones text,
  evolucion jsonb,
  estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cerrada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gimnasio_id, cliente_id)
);

CREATE TABLE IF NOT EXISTS gymcrm.nutricion_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  nutricionista_user_id text,
  asunto text NOT NULL,
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'seguimiento', 'cerrada')),
  created_by text NOT NULL DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gymcrm.nutricion_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id uuid NOT NULL REFERENCES gymcrm.nutricion_consultas(id) ON DELETE CASCADE,
  autor_user_id text NOT NULL DEFAULT gymcrm.current_user_id(),
  mensaje text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Bloque 3 tables (builder + community) =====
CREATE TABLE IF NOT EXISTS gymcrm.builder_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  slug text NOT NULL,
  nombre text NOT NULL,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado', 'pausado')),
  modulo_base text,
  activo boolean NOT NULL DEFAULT true,
  created_by text NOT NULL DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gimnasio_id, slug)
);

CREATE TABLE IF NOT EXISTS gymcrm.builder_servicio_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id uuid NOT NULL REFERENCES gymcrm.builder_servicios(id) ON DELETE CASCADE,
  version integer NOT NULL,
  definicion jsonb NOT NULL,
  publicado boolean NOT NULL DEFAULT false,
  created_by text NOT NULL DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (servicio_id, version)
);

CREATE TABLE IF NOT EXISTS gymcrm.comunidad_retos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text,
  puntos_recompensa integer NOT NULL DEFAULT 0 CHECK (puntos_recompensa >= 0),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  estado text NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado', 'activo', 'cerrado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS gymcrm.comunidad_puntos_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES gymcrm.clientes(id) ON DELETE CASCADE,
  reto_id uuid REFERENCES gymcrm.comunidad_retos(id) ON DELETE SET NULL,
  puntos integer NOT NULL,
  motivo text NOT NULL,
  created_by text NOT NULL DEFAULT gymcrm.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Bloque 4 table (events) =====
CREATE TABLE IF NOT EXISTS gymcrm.eventos_deportivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gimnasio_id uuid NOT NULL REFERENCES gymcrm.gimnasios(id) ON DELETE CASCADE,
  sede_id uuid REFERENCES gymcrm.sedes(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  tipo text NOT NULL,
  descripcion text,
  cupo integer CHECK (cupo > 0),
  fecha_inicio timestamptz NOT NULL,
  fecha_fin timestamptz NOT NULL,
  estado text NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado', 'abierto', 'cerrado', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_sedes_gimnasio ON gymcrm.sedes(gimnasio_id);
CREATE INDEX IF NOT EXISTS idx_roles_gimnasio_user ON gymcrm.usuarios_roles(gimnasio_id, user_id) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_clientes_gimnasio_estado ON gymcrm.clientes(gimnasio_id, estado);
CREATE INDEX IF NOT EXISTS idx_clientes_auth_user ON gymcrm.clientes(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_membresias_gimnasio_estado ON gymcrm.membresias(gimnasio_id, estado);
CREATE INDEX IF NOT EXISTS idx_membresias_cliente ON gymcrm.membresias(cliente_id, fecha_fin DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_gimnasio_fecha ON gymcrm.pagos(gimnasio_id, fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_horarios_gimnasio_inicio ON gymcrm.clases_horarios(gimnasio_id, inicio);
CREATE INDEX IF NOT EXISTS idx_reservas_horario_estado ON gymcrm.reservas_clases(horario_id, estado);
CREATE INDEX IF NOT EXISTS idx_checkins_cliente_fecha ON gymcrm.checkins(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_gimnasio_fecha ON gymcrm.auditoria_critica(gimnasio_id, created_at DESC);

-- ===== Triggers =====
DROP TRIGGER IF EXISTS trg_gimnasios_touch_updated_at ON gymcrm.gimnasios;
CREATE TRIGGER trg_gimnasios_touch_updated_at
BEFORE UPDATE ON gymcrm.gimnasios
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_sedes_touch_updated_at ON gymcrm.sedes;
CREATE TRIGGER trg_sedes_touch_updated_at
BEFORE UPDATE ON gymcrm.sedes
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_usuarios_roles_touch_updated_at ON gymcrm.usuarios_roles;
CREATE TRIGGER trg_usuarios_roles_touch_updated_at
BEFORE UPDATE ON gymcrm.usuarios_roles
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_clientes_touch_updated_at ON gymcrm.clientes;
CREATE TRIGGER trg_clientes_touch_updated_at
BEFORE UPDATE ON gymcrm.clientes
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_planes_touch_updated_at ON gymcrm.planes_membresia;
CREATE TRIGGER trg_planes_touch_updated_at
BEFORE UPDATE ON gymcrm.planes_membresia
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_membresias_touch_updated_at ON gymcrm.membresias;
CREATE TRIGGER trg_membresias_touch_updated_at
BEFORE UPDATE ON gymcrm.membresias
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_pagos_touch_updated_at ON gymcrm.pagos;
CREATE TRIGGER trg_pagos_touch_updated_at
BEFORE UPDATE ON gymcrm.pagos
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_clases_base_touch_updated_at ON gymcrm.clases_base;
CREATE TRIGGER trg_clases_base_touch_updated_at
BEFORE UPDATE ON gymcrm.clases_base
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_clases_horarios_touch_updated_at ON gymcrm.clases_horarios;
CREATE TRIGGER trg_clases_horarios_touch_updated_at
BEFORE UPDATE ON gymcrm.clases_horarios
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_reservas_touch_updated_at ON gymcrm.reservas_clases;
CREATE TRIGGER trg_reservas_touch_updated_at
BEFORE UPDATE ON gymcrm.reservas_clases
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_nutricion_fichas_touch_updated_at ON gymcrm.nutricion_fichas;
CREATE TRIGGER trg_nutricion_fichas_touch_updated_at
BEFORE UPDATE ON gymcrm.nutricion_fichas
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_nutricion_consultas_touch_updated_at ON gymcrm.nutricion_consultas;
CREATE TRIGGER trg_nutricion_consultas_touch_updated_at
BEFORE UPDATE ON gymcrm.nutricion_consultas
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_builder_servicios_touch_updated_at ON gymcrm.builder_servicios;
CREATE TRIGGER trg_builder_servicios_touch_updated_at
BEFORE UPDATE ON gymcrm.builder_servicios
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_comunidad_retos_touch_updated_at ON gymcrm.comunidad_retos;
CREATE TRIGGER trg_comunidad_retos_touch_updated_at
BEFORE UPDATE ON gymcrm.comunidad_retos
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_eventos_touch_updated_at ON gymcrm.eventos_deportivos;
CREATE TRIGGER trg_eventos_touch_updated_at
BEFORE UPDATE ON gymcrm.eventos_deportivos
FOR EACH ROW EXECUTE FUNCTION gymcrm.touch_updated_at();

-- ===== Waitlist helpers =====
CREATE OR REPLACE FUNCTION gymcrm.asignar_prioridad_espera()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.estado = 'espera' AND NEW.prioridad_espera = 0 THEN
    SELECT COALESCE(MAX(r.prioridad_espera), 0) + 1
    INTO NEW.prioridad_espera
    FROM gymcrm.reservas_clases r
    WHERE r.horario_id = NEW.horario_id
      AND r.estado = 'espera';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservas_prioridad_espera ON gymcrm.reservas_clases;
CREATE TRIGGER trg_reservas_prioridad_espera
BEFORE INSERT ON gymcrm.reservas_clases
FOR EACH ROW EXECUTE FUNCTION gymcrm.asignar_prioridad_espera();

CREATE OR REPLACE FUNCTION gymcrm.promover_lista_espera(p_horario_id uuid)
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
  SELECT h.cupo_total
  INTO v_cupo
  FROM gymcrm.clases_horarios h
  WHERE h.id = p_horario_id
    AND h.estado = 'programada';

  IF v_cupo IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)
  INTO v_ocupados
  FROM gymcrm.reservas_clases r
  WHERE r.horario_id = p_horario_id
    AND r.estado IN ('confirmada', 'asistio');

  v_disponibles := GREATEST(v_cupo - v_ocupados, 0);
  IF v_disponibles = 0 THEN
    RETURN 0;
  END IF;

  WITH candidatos AS (
    SELECT r.id
    FROM gymcrm.reservas_clases r
    WHERE r.horario_id = p_horario_id
      AND r.estado = 'espera'
    ORDER BY r.prioridad_espera ASC, r.created_at ASC
    LIMIT v_disponibles
    FOR UPDATE SKIP LOCKED
  )
  UPDATE gymcrm.reservas_clases r
  SET estado = 'confirmada',
      prioridad_espera = 0,
      updated_at = now()
  WHERE r.id IN (SELECT id FROM candidatos);

  GET DIAGNOSTICS v_promovidos = ROW_COUNT;
  RETURN v_promovidos;
END;
$$;

-- ===== Retention KPI =====
CREATE OR REPLACE FUNCTION gymcrm.retencion_mensual(p_gimnasio_id uuid, p_referencia date DEFAULT CURRENT_DATE)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = gymcrm, public
AS $$
DECLARE
  v_inicio date;
  v_fin date;
  v_activos_inicio integer;
  v_activos_fin integer;
BEGIN
  v_inicio := date_trunc('month', p_referencia)::date;
  v_fin := (date_trunc('month', p_referencia) + INTERVAL '1 month - 1 day')::date;

  SELECT COUNT(*) INTO v_activos_inicio
  FROM gymcrm.membresias m
  WHERE m.gimnasio_id = p_gimnasio_id
    AND m.fecha_inicio <= v_inicio
    AND m.fecha_fin >= v_inicio
    AND m.estado IN ('activa', 'vencida', 'suspendida');

  SELECT COUNT(*) INTO v_activos_fin
  FROM gymcrm.membresias m
  WHERE m.gimnasio_id = p_gimnasio_id
    AND m.fecha_inicio <= v_fin
    AND m.fecha_fin >= v_fin
    AND m.estado IN ('activa', 'vencida', 'suspendida');

  IF v_activos_inicio = 0 THEN
    RETURN 100.0;
  END IF;

  RETURN ROUND((v_activos_fin::numeric / v_activos_inicio::numeric) * 100.0, 2);
END;
$$;

-- ===== Critical audit =====
CREATE OR REPLACE FUNCTION gymcrm.audit_critical_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = gymcrm, public
AS $$
DECLARE
  v_gimnasio_id uuid;
  v_entidad_id uuid;
BEGIN
  v_gimnasio_id := COALESCE((to_jsonb(NEW)->>'gimnasio_id')::uuid, (to_jsonb(OLD)->>'gimnasio_id')::uuid);
  v_entidad_id := COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid);

  INSERT INTO gymcrm.auditoria_critica (
    gimnasio_id,
    entidad,
    entidad_id,
    accion,
    actor_user_id,
    antes,
    despues,
    metadata
  )
  VALUES (
    v_gimnasio_id,
    TG_TABLE_NAME,
    v_entidad_id,
    TG_OP,
    gymcrm.current_user_id(),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    jsonb_build_object('schema', TG_TABLE_SCHEMA)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_membresias ON gymcrm.membresias;
CREATE TRIGGER trg_audit_membresias
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.membresias
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

DROP TRIGGER IF EXISTS trg_audit_pagos ON gymcrm.pagos;
CREATE TRIGGER trg_audit_pagos
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.pagos
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

DROP TRIGGER IF EXISTS trg_audit_roles ON gymcrm.usuarios_roles;
CREATE TRIGGER trg_audit_roles
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.usuarios_roles
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

DROP TRIGGER IF EXISTS trg_audit_reservas ON gymcrm.reservas_clases;
CREATE TRIGGER trg_audit_reservas
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.reservas_clases
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

DROP TRIGGER IF EXISTS trg_audit_checkins ON gymcrm.checkins;
CREATE TRIGGER trg_audit_checkins
AFTER INSERT OR UPDATE OR DELETE ON gymcrm.checkins
FOR EACH ROW EXECUTE FUNCTION gymcrm.audit_critical_changes();

-- ===== RLS =====
ALTER TABLE gymcrm.gimnasios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.usuarios_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.planes_membresia ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.membresias ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.clases_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.clases_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.reservas_clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.auditoria_critica ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.nutricion_fichas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.nutricion_consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.nutricion_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.builder_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.builder_servicio_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.comunidad_retos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.comunidad_puntos_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymcrm.eventos_deportivos ENABLE ROW LEVEL SECURITY;

-- Clear old policies for idempotency
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'gymcrm'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END;
$$;

-- Project admin bypass
CREATE POLICY project_admin_all_gimnasios ON gymcrm.gimnasios FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_sedes ON gymcrm.sedes FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_roles ON gymcrm.usuarios_roles FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_clientes ON gymcrm.clientes FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_planes ON gymcrm.planes_membresia FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_membresias ON gymcrm.membresias FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_pagos ON gymcrm.pagos FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_clases_base ON gymcrm.clases_base FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_clases_horarios ON gymcrm.clases_horarios FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_reservas ON gymcrm.reservas_clases FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_checkins ON gymcrm.checkins FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_auditoria ON gymcrm.auditoria_critica FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_nutricion_fichas ON gymcrm.nutricion_fichas FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_nutricion_consultas ON gymcrm.nutricion_consultas FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_nutricion_mensajes ON gymcrm.nutricion_mensajes FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_builder_servicios ON gymcrm.builder_servicios FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_builder_versions ON gymcrm.builder_servicio_versiones FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_retos ON gymcrm.comunidad_retos FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_puntos ON gymcrm.comunidad_puntos_movimientos FOR ALL TO project_admin USING (true) WITH CHECK (true);
CREATE POLICY project_admin_all_eventos ON gymcrm.eventos_deportivos FOR ALL TO project_admin USING (true) WITH CHECK (true);

-- gimnasios
CREATE POLICY gym_select ON gymcrm.gimnasios
  FOR SELECT TO authenticated
  USING (created_by = gymcrm.current_user_id() OR gymcrm.user_has_role(id, NULL));

CREATE POLICY gym_insert ON gymcrm.gimnasios
  FOR INSERT TO authenticated
  WITH CHECK (created_by = gymcrm.current_user_id());

CREATE POLICY gym_update_delete ON gymcrm.gimnasios
  FOR UPDATE TO authenticated
  USING (gymcrm.user_has_role(id, ARRAY['admin']) OR created_by = gymcrm.current_user_id())
  WITH CHECK (gymcrm.user_has_role(id, ARRAY['admin']) OR created_by = gymcrm.current_user_id());

CREATE POLICY gym_delete ON gymcrm.gimnasios
  FOR DELETE TO authenticated
  USING (gymcrm.user_has_role(id, ARRAY['admin']) OR created_by = gymcrm.current_user_id());

-- sedes
CREATE POLICY sedes_read ON gymcrm.sedes
  FOR SELECT TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador', 'nutricionista', 'cliente']));

CREATE POLICY sedes_write ON gymcrm.sedes
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']));

-- usuarios_roles
CREATE POLICY roles_select ON gymcrm.usuarios_roles
  FOR SELECT TO authenticated
  USING (
    user_id = gymcrm.current_user_id()
    OR gymcrm.user_has_role(gimnasio_id, ARRAY['admin'])
  );

CREATE POLICY roles_insert ON gymcrm.usuarios_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin'])
    OR (
      user_id = gymcrm.current_user_id()
      AND rol = 'admin'
      AND NOT EXISTS (
        SELECT 1
        FROM gymcrm.usuarios_roles ur
        WHERE ur.gimnasio_id = usuarios_roles.gimnasio_id
      )
    )
  );

CREATE POLICY roles_update_delete ON gymcrm.usuarios_roles
  FOR UPDATE TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

CREATE POLICY roles_delete ON gymcrm.usuarios_roles
  FOR DELETE TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

-- clientes
CREATE POLICY clientes_read ON gymcrm.clientes
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador', 'nutricionista'])
    OR auth_user_id = gymcrm.current_user_id()
  );

CREATE POLICY clientes_insert_update ON gymcrm.clientes
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']));

-- planes membresia
CREATE POLICY planes_read ON gymcrm.planes_membresia
  FOR SELECT TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista']));

CREATE POLICY planes_write ON gymcrm.planes_membresia
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']));

-- membresias
CREATE POLICY membresias_read ON gymcrm.membresias
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador', 'nutricionista'])
    OR EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = membresias.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY membresias_write ON gymcrm.membresias
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']));

-- pagos
CREATE POLICY pagos_read ON gymcrm.pagos
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion'])
    OR EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = pagos.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY pagos_write ON gymcrm.pagos
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']));

-- clases
CREATE POLICY clases_base_read ON gymcrm.clases_base
  FOR SELECT TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista']));

CREATE POLICY clases_base_write ON gymcrm.clases_base
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']));

CREATE POLICY horarios_read ON gymcrm.clases_horarios
  FOR SELECT TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista']));

CREATE POLICY horarios_write ON gymcrm.clases_horarios
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']));

-- reservas
CREATE POLICY reservas_read ON gymcrm.reservas_clases
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador'])
    OR EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = reservas_clases.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY reservas_write_staff ON gymcrm.reservas_clases
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']));

CREATE POLICY reservas_insert_cliente ON gymcrm.reservas_clases
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = reservas_clases.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY reservas_update_cliente ON gymcrm.reservas_clases
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = reservas_clases.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = reservas_clases.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

-- checkins
CREATE POLICY checkins_read ON gymcrm.checkins
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador'])
    OR EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = checkins.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY checkins_write ON gymcrm.checkins
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']));

-- auditoria
CREATE POLICY auditoria_read ON gymcrm.auditoria_critica
  FOR SELECT TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

-- nutrition
CREATE POLICY nutricion_fichas_read ON gymcrm.nutricion_fichas
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista'])
    OR EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = nutricion_fichas.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY nutricion_fichas_write ON gymcrm.nutricion_fichas
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista']));

CREATE POLICY nutricion_consultas_read ON gymcrm.nutricion_consultas
  FOR SELECT TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista'])
    OR EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = nutricion_consultas.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY nutricion_consultas_write ON gymcrm.nutricion_consultas
  FOR ALL TO authenticated
  USING (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista'])
    OR EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = nutricion_consultas.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  )
  WITH CHECK (
    gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'nutricionista'])
    OR EXISTS (
      SELECT 1 FROM gymcrm.clientes c
      WHERE c.id = nutricion_consultas.cliente_id
        AND c.auth_user_id = gymcrm.current_user_id()
    )
  );

CREATE POLICY nutricion_mensajes_read ON gymcrm.nutricion_mensajes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM gymcrm.nutricion_consultas nc
      WHERE nc.id = nutricion_mensajes.consulta_id
        AND (
          gymcrm.user_has_role(nc.gimnasio_id, ARRAY['admin', 'nutricionista'])
          OR EXISTS (
            SELECT 1 FROM gymcrm.clientes c
            WHERE c.id = nc.cliente_id
              AND c.auth_user_id = gymcrm.current_user_id()
          )
        )
    )
  );

CREATE POLICY nutricion_mensajes_insert ON gymcrm.nutricion_mensajes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM gymcrm.nutricion_consultas nc
      WHERE nc.id = nutricion_mensajes.consulta_id
        AND (
          gymcrm.user_has_role(nc.gimnasio_id, ARRAY['admin', 'nutricionista'])
          OR EXISTS (
            SELECT 1 FROM gymcrm.clientes c
            WHERE c.id = nc.cliente_id
              AND c.auth_user_id = gymcrm.current_user_id()
          )
        )
    )
  );

-- Builder/community/events (admin only in this phase)
CREATE POLICY builder_servicios_rw ON gymcrm.builder_servicios
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

CREATE POLICY builder_versiones_rw ON gymcrm.builder_servicio_versiones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gymcrm.builder_servicios bs
      WHERE bs.id = builder_servicio_versiones.servicio_id
        AND gymcrm.user_has_role(bs.gimnasio_id, ARRAY['admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gymcrm.builder_servicios bs
      WHERE bs.id = builder_servicio_versiones.servicio_id
        AND gymcrm.user_has_role(bs.gimnasio_id, ARRAY['admin'])
    )
  );

CREATE POLICY retos_rw ON gymcrm.comunidad_retos
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin']));

CREATE POLICY puntos_rw ON gymcrm.comunidad_puntos_movimientos
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion', 'entrenador']));

CREATE POLICY eventos_rw ON gymcrm.eventos_deportivos
  FOR ALL TO authenticated
  USING (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']))
  WITH CHECK (gymcrm.user_has_role(gimnasio_id, ARRAY['admin', 'recepcion']));

-- Function grants
GRANT USAGE ON SCHEMA gymcrm TO authenticated, anon;
GRANT EXECUTE ON FUNCTION gymcrm.current_user_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION gymcrm.user_has_role(uuid, text[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION gymcrm.user_is_cliente_propio(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION gymcrm.promover_lista_espera(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION gymcrm.retencion_mensual(uuid, date) TO authenticated, anon;

-- Public bridge for InsForge PostgREST (public schema only)
CREATE OR REPLACE FUNCTION public.gymcrm_promover_lista_espera(p_horario_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = gymcrm, public
AS $$
  SELECT gymcrm.promover_lista_espera(p_horario_id);
$$;

CREATE OR REPLACE FUNCTION public.gymcrm_retencion_mensual(p_gimnasio_id uuid, p_referencia date DEFAULT CURRENT_DATE)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = gymcrm, public
AS $$
  SELECT gymcrm.retencion_mensual(p_gimnasio_id, p_referencia);
$$;

GRANT EXECUTE ON FUNCTION public.gymcrm_promover_lista_espera(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.gymcrm_retencion_mensual(uuid, date) TO authenticated, anon;

CREATE OR REPLACE VIEW public.gymcrm_gimnasios WITH (security_invoker = true) AS SELECT * FROM gymcrm.gimnasios;
CREATE OR REPLACE VIEW public.gymcrm_sedes WITH (security_invoker = true) AS SELECT * FROM gymcrm.sedes;
CREATE OR REPLACE VIEW public.gymcrm_usuarios_roles WITH (security_invoker = true) AS SELECT * FROM gymcrm.usuarios_roles;
CREATE OR REPLACE VIEW public.gymcrm_clientes WITH (security_invoker = true) AS SELECT * FROM gymcrm.clientes;
CREATE OR REPLACE VIEW public.gymcrm_planes_membresia WITH (security_invoker = true) AS SELECT * FROM gymcrm.planes_membresia;
CREATE OR REPLACE VIEW public.gymcrm_membresias WITH (security_invoker = true) AS SELECT * FROM gymcrm.membresias;
CREATE OR REPLACE VIEW public.gymcrm_pagos WITH (security_invoker = true) AS SELECT * FROM gymcrm.pagos;
CREATE OR REPLACE VIEW public.gymcrm_clases_base WITH (security_invoker = true) AS SELECT * FROM gymcrm.clases_base;
CREATE OR REPLACE VIEW public.gymcrm_clases_horarios WITH (security_invoker = true) AS SELECT * FROM gymcrm.clases_horarios;
CREATE OR REPLACE VIEW public.gymcrm_reservas_clases WITH (security_invoker = true) AS SELECT * FROM gymcrm.reservas_clases;
CREATE OR REPLACE VIEW public.gymcrm_checkins WITH (security_invoker = true) AS SELECT * FROM gymcrm.checkins;
CREATE OR REPLACE VIEW public.gymcrm_auditoria_critica WITH (security_invoker = true) AS SELECT * FROM gymcrm.auditoria_critica;
CREATE OR REPLACE VIEW public.gymcrm_nutricion_fichas WITH (security_invoker = true) AS SELECT * FROM gymcrm.nutricion_fichas;
CREATE OR REPLACE VIEW public.gymcrm_nutricion_consultas WITH (security_invoker = true) AS SELECT * FROM gymcrm.nutricion_consultas;
CREATE OR REPLACE VIEW public.gymcrm_nutricion_mensajes WITH (security_invoker = true) AS SELECT * FROM gymcrm.nutricion_mensajes;
CREATE OR REPLACE VIEW public.gymcrm_builder_servicios WITH (security_invoker = true) AS SELECT * FROM gymcrm.builder_servicios;
CREATE OR REPLACE VIEW public.gymcrm_builder_servicio_versiones WITH (security_invoker = true) AS SELECT * FROM gymcrm.builder_servicio_versiones;
CREATE OR REPLACE VIEW public.gymcrm_comunidad_retos WITH (security_invoker = true) AS SELECT * FROM gymcrm.comunidad_retos;
CREATE OR REPLACE VIEW public.gymcrm_comunidad_puntos_movimientos WITH (security_invoker = true) AS SELECT * FROM gymcrm.comunidad_puntos_movimientos;
CREATE OR REPLACE VIEW public.gymcrm_eventos_deportivos WITH (security_invoker = true) AS SELECT * FROM gymcrm.eventos_deportivos;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_gimnasios TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_sedes TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_usuarios_roles TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_clientes TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_planes_membresia TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_membresias TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_pagos TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_clases_base TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_clases_horarios TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_reservas_clases TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_checkins TO authenticated, anon;
GRANT SELECT ON public.gymcrm_auditoria_critica TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_nutricion_fichas TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_nutricion_consultas TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_nutricion_mensajes TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_builder_servicios TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_builder_servicio_versiones TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_comunidad_retos TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_comunidad_puntos_movimientos TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gymcrm_eventos_deportivos TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
