import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fail, ok, okList, parseJsonBody } from '@/lib/gymcrm/api';
import { isBuilderTemplateKey, listBuilderTemplates, normalizeBuilderDefinition } from '@/lib/gymcrm/builder';
import {
  calculatePointsBalance,
  calculateRetentionRate,
  canCancelReservation,
  canRedeemPoints,
  resolveReservationStateByCapacity,
} from '@/lib/gymcrm/domain';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getGymcrmDataMode, readOpenRoleFromRequest, type OpenRole } from '@/lib/gymcrm/open-session';
import {
  isCanjeState,
  isConsentimientoMedio,
  isPlanNutricionState,
  isPremioTipo,
  type CanjeState,
  type GymRole,
  type PaymentState,
  type PremioTipo,
  type ReservationState,
} from '@/lib/gymcrm/types';

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

type DemoCliente = {
  id: string;
  gimnasio_id: string;
  sede_id: string | null;
  auth_user_id: string | null;
  nombres: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  objetivo: string | null;
  estado: 'activo' | 'inactivo' | 'suspendido';
  codigo_qr: string;
  created_at: string;
  updated_at: string;
};

type DemoPlan = {
  id: string;
  gimnasio_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: string;
  duracion_dias: number;
  incluye_reservas: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

type DemoMembresia = {
  id: string;
  gimnasio_id: string;
  cliente_id: string;
  plan_id: string;
  estado: 'activa' | 'vencida' | 'suspendida' | 'cancelada';
  fecha_inicio: string;
  fecha_fin: string;
  renovacion_automatica: boolean;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
};

type DemoPago = {
  id: string;
  gimnasio_id: string;
  cliente_id: string;
  membresia_id: string | null;
  monto: number;
  moneda: string;
  estado: PaymentState;
  metodo: string;
  referencia: string | null;
  fecha_pago: string;
  registrado_por: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

type DemoClase = {
  id: string;
  gimnasio_id: string;
  sede_id: string | null;
  nombre: string;
  descripcion: string | null;
  cupo_total: number;
  duracion_min: number;
  instructor_nombre: string | null;
  nivel: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
};

type DemoHorario = {
  id: string;
  gimnasio_id: string;
  sede_id: string | null;
  clase_base_id: string;
  inicio: string;
  fin: string;
  cupo_total: number;
  estado: 'programada' | 'cancelada' | 'finalizada';
  created_at: string;
  updated_at: string;
};

type DemoReservaClase = {
  id: string;
  gimnasio_id: string;
  horario_id: string;
  clase_base_id: string;
  cliente_id: string;
  estado: ReservationState;
  prioridad_espera: number;
  cancelada_en: string | null;
  created_at: string;
  updated_at: string;
};

type DemoBuilderService = {
  id: string;
  gimnasio_id: string;
  slug: string;
  nombre: string;
  modulo_base: string;
  estado: 'borrador' | 'publicado' | 'pausado';
  activo: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type DemoBuilderVersion = {
  id: string;
  servicio_id: string;
  version: number;
  definicion: unknown;
  publicado: boolean;
  created_by: string;
  created_at: string;
};

type DemoBuilderSession = {
  id: string;
  gimnasio_id: string;
  sede_id: string | null;
  servicio_id: string;
  version_id: string | null;
  titulo: string;
  descripcion: string | null;
  inicio: string;
  fin: string;
  cupo_total: number;
  reglas: Record<string, unknown>;
  estado: 'programada' | 'cancelada' | 'finalizada';
  created_by: string;
  created_at: string;
  updated_at: string;
};

type DemoBuilderReserva = {
  id: string;
  gimnasio_id: string;
  sesion_id: string;
  servicio_id: string;
  cliente_id: string;
  estado: ReservationState;
  prioridad_espera: number;
  cancelada_en: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string;
};

type DemoPointMovement = {
  id: string;
  gimnasio_id: string;
  cliente_id: string;
  reto_id: string | null;
  puntos: number;
  motivo: string;
  origen_tipo: 'manual' | 'reto' | 'reserva' | 'evento' | 'canje_ajuste';
  origen_ref: string | null;
  aprobado_por: string | null;
  created_by: string | null;
  anulacion_de: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type DemoPremio = {
  id: string;
  gimnasio_id: string;
  nombre: string;
  descripcion: string | null;
  tipo: PremioTipo;
  costo_puntos: number;
  monto_descuento: number | null;
  moneda: string;
  servicio_id: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  stock_total: number | null;
  stock_disponible: number | null;
  activa: boolean;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type DemoCanje = {
  id: string;
  gimnasio_id: string;
  cliente_id: string;
  premio_id: string;
  estado: CanjeState;
  puntos: number;
  credito_monto: number | null;
  credito_moneda: string | null;
  motivo_rechazo: string | null;
  cupon_codigo: string | null;
  aprobado_por: string | null;
  aprobado_en: string | null;
  resuelto_por: string | null;
  entregado_en: string | null;
  anulado_en: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type DemoConsent = {
  id: string;
  gimnasio_id: string;
  cliente_id: string;
  version_texto: string;
  medio: 'app' | 'staff';
  aceptado_por: string;
  activo: boolean;
  aceptado_en: string;
  revocado_en: string | null;
  revocado_por: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type DemoNutritionPlan = {
  id: string;
  gimnasio_id: string;
  cliente_id: string;
  nutricionista_user_id: string;
  consentimiento_id: string | null;
  estado: 'borrador' | 'activo' | 'sustituido' | 'cerrado';
  objetivo_general: string | null;
  notas: string | null;
  activo_desde: string | null;
  activo_hasta: string | null;
  created_at: string;
  updated_at: string;
};

type DemoNutritionPlanVersion = {
  id: string;
  plan_id: string;
  version: number;
  contenido: Record<string, unknown>;
  publicado: boolean;
  notas: string | null;
  created_by: string;
  created_at: string;
};

type DemoMedicion = {
  id: string;
  gimnasio_id: string;
  cliente_id: string;
  plan_id: string | null;
  peso_kg: number | null;
  grasa_pct: number | null;
  perimetros: Record<string, number> | null;
  adherencia_pct: number | null;
  notas: string | null;
  fecha_medicion: string;
  registrado_por: string;
  created_at: string;
};

type DemoWhatsappQueue = {
  id: string;
  gimnasio_id: string;
  to_phone: string;
  template: string | null;
  message: string;
  context: Record<string, unknown>;
  estado: 'pendiente' | 'enviado' | 'fallido';
  intentos: number;
  max_intentos: number;
  next_retry_at: string;
  ultimo_error: string | null;
  provider_ref: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type DemoReto = {
  id: string;
  gimnasio_id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  created_at: string;
};

type DemoState = {
  gymId: string;
  sedeId: string;
  users: Record<OpenRole, string>;
  seq: Record<string, number>;
  clientes: DemoCliente[];
  planes: DemoPlan[];
  membresias: DemoMembresia[];
  pagos: DemoPago[];
  clases: DemoClase[];
  horarios: DemoHorario[];
  reservas: DemoReservaClase[];
  builderServicios: DemoBuilderService[];
  builderVersiones: DemoBuilderVersion[];
  builderSesiones: DemoBuilderSession[];
  builderReservas: DemoBuilderReserva[];
  puntosMovimientos: DemoPointMovement[];
  premios: DemoPremio[];
  canjes: DemoCanje[];
  consentimientos: DemoConsent[];
  planesNutricion: DemoNutritionPlan[];
  planVersiones: DemoNutritionPlanVersion[];
  mediciones: DemoMedicion[];
  whatsappQueue: DemoWhatsappQueue[];
  retos: DemoReto[];
};

const OPEN_USERS: Record<OpenRole, string> = {
  admin: 'open-admin',
  recepcion: 'open-recepcion',
  entrenador: 'open-entrenador',
  cliente: 'open-cliente',
  nutricionista: 'open-nutricionista',
};

const DEMO_GYM_ID = 'demo-gym-001';
const DEMO_SEDE_ID = 'demo-sede-001';
const DEMO_STATE_FILE = resolve(process.cwd(), '.playwright-artifacts', 'gymcrm-demo-state.json');

const nowIso = (): string => new Date().toISOString();
const todayDate = (): string => nowIso().slice(0, 10);

const addDaysDate = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const addHoursIso = (hours: number): string => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

const parsePagination = (searchParams: URLSearchParams) => {
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 300 ? Math.floor(pageSize) : 20;

  const from = (safePage - 1) * safeSize;
  const to = from + safeSize;

  return { from, to };
};

const paginate = <T>(items: T[], searchParams: URLSearchParams): { data: T[]; count: number } => {
  const { from, to } = parsePagination(searchParams);
  return {
    data: items.slice(from, to),
    count: items.length,
  };
};

const createInitialState = (): DemoState => {
  const seq: Record<string, number> = {};
  const nextId = (prefix: string): string => {
    seq[prefix] = (seq[prefix] ?? 0) + 1;
    return `${prefix}-${String(seq[prefix]).padStart(4, '0')}`;
  };

  const createdAt = nowIso();

  const clientes: DemoCliente[] = [
    {
      id: nextId('cli'),
      gimnasio_id: DEMO_GYM_ID,
      sede_id: DEMO_SEDE_ID,
      auth_user_id: OPEN_USERS.cliente,
      nombres: 'Lucia',
      apellidos: 'Pereira',
      email: 'lucia@gymcrm.demo',
      telefono: '099111111',
      fecha_nacimiento: '1994-08-12',
      objetivo: 'Bajar grasa y mejorar resistencia',
      estado: 'activo',
      codigo_qr: 'QR-LUCIA-001',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: nextId('cli'),
      gimnasio_id: DEMO_GYM_ID,
      sede_id: DEMO_SEDE_ID,
      auth_user_id: null,
      nombres: 'Martin',
      apellidos: 'Gonzalez',
      email: 'martin@gymcrm.demo',
      telefono: '099222222',
      fecha_nacimiento: '1991-02-01',
      objetivo: 'Fuerza y masa muscular',
      estado: 'activo',
      codigo_qr: 'QR-MARTIN-002',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: nextId('cli'),
      gimnasio_id: DEMO_GYM_ID,
      sede_id: DEMO_SEDE_ID,
      auth_user_id: null,
      nombres: 'Sofia',
      apellidos: 'Mendez',
      email: 'sofia@gymcrm.demo',
      telefono: '099333333',
      fecha_nacimiento: '1997-11-22',
      objetivo: 'Preparar carrera 10K',
      estado: 'activo',
      codigo_qr: 'QR-SOFIA-003',
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const planMensual: DemoPlan = {
    id: nextId('plan'),
    gimnasio_id: DEMO_GYM_ID,
    nombre: 'Mensual Premium',
    descripcion: 'Acceso libre a clases base y servicios dinámicos.',
    precio: 2200,
    moneda: 'UYU',
    duracion_dias: 30,
    incluye_reservas: true,
    activo: true,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const membresias: DemoMembresia[] = clientes.map((cliente) => ({
    id: nextId('mem'),
    gimnasio_id: DEMO_GYM_ID,
    cliente_id: cliente.id,
    plan_id: planMensual.id,
    estado: 'activa',
    fecha_inicio: addDaysDate(-5),
    fecha_fin: addDaysDate(25),
    renovacion_automatica: false,
    observaciones: null,
    created_at: createdAt,
    updated_at: createdAt,
  }));

  const clases: DemoClase[] = [
    {
      id: nextId('class'),
      gimnasio_id: DEMO_GYM_ID,
      sede_id: DEMO_SEDE_ID,
      nombre: 'HIIT Nitro',
      descripcion: 'Intervalos de alta intensidad',
      cupo_total: 16,
      duracion_min: 45,
      instructor_nombre: 'Coach Andres',
      nivel: 'intermedio',
      activa: true,
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: nextId('class'),
      gimnasio_id: DEMO_GYM_ID,
      sede_id: DEMO_SEDE_ID,
      nombre: 'Yoga Flow',
      descripcion: 'Movilidad y respiración',
      cupo_total: 20,
      duracion_min: 60,
      instructor_nombre: 'Coach Elena',
      nivel: 'todos',
      activa: true,
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const horarios: DemoHorario[] = [
    {
      id: nextId('hor'),
      gimnasio_id: DEMO_GYM_ID,
      sede_id: DEMO_SEDE_ID,
      clase_base_id: clases[0].id,
      inicio: addHoursIso(24),
      fin: addHoursIso(25),
      cupo_total: 16,
      estado: 'programada',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: nextId('hor'),
      gimnasio_id: DEMO_GYM_ID,
      sede_id: DEMO_SEDE_ID,
      clase_base_id: clases[1].id,
      inicio: addHoursIso(30),
      fin: addHoursIso(31),
      cupo_total: 20,
      estado: 'programada',
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const builderServicio: DemoBuilderService = {
    id: nextId('svc'),
    gimnasio_id: DEMO_GYM_ID,
    slug: 'spinning-pro',
    nombre: 'Spinning Pro',
    modulo_base: 'clase_grupal',
    estado: 'publicado',
    activo: true,
    created_by: OPEN_USERS.admin,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const builderVersion: DemoBuilderVersion = {
    id: nextId('svv'),
    servicio_id: builderServicio.id,
    version: 1,
    definicion: normalizeBuilderDefinition('clase_grupal'),
    publicado: true,
    created_by: OPEN_USERS.admin,
    created_at: createdAt,
  };

  const builderSesion: DemoBuilderSession = {
    id: nextId('ses'),
    gimnasio_id: DEMO_GYM_ID,
    sede_id: DEMO_SEDE_ID,
    servicio_id: builderServicio.id,
    version_id: builderVersion.id,
    titulo: 'Spinning de Resistencia',
    descripcion: 'Sesión premium',
    inicio: addHoursIso(20),
    fin: addHoursIso(21),
    cupo_total: 2,
    reglas: {
      cancelacionMinutosAntes: 30,
      permiteEspera: true,
    },
    estado: 'programada',
    created_by: OPEN_USERS.admin,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const premioDescuento: DemoPremio = {
    id: nextId('prm'),
    gimnasio_id: DEMO_GYM_ID,
    nombre: 'Descuento 100 UYU',
    descripcion: 'Crédito para próximo pago manual.',
    tipo: 'descuento_pago',
    costo_puntos: 100,
    monto_descuento: 100,
    moneda: 'UYU',
    servicio_id: null,
    vigencia_desde: null,
    vigencia_hasta: null,
    stock_total: 500,
    stock_disponible: 500,
    activa: true,
    metadata: {},
    created_by: OPEN_USERS.admin,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const puntoSeed: DemoPointMovement = {
    id: nextId('pts'),
    gimnasio_id: DEMO_GYM_ID,
    cliente_id: clientes[0].id,
    reto_id: null,
    puntos: 180,
    motivo: 'Seed inicial demo',
    origen_tipo: 'manual',
    origen_ref: null,
    aprobado_por: OPEN_USERS.admin,
    created_by: OPEN_USERS.admin,
    anulacion_de: null,
    metadata: {},
    created_at: createdAt,
  };

  const consentimiento: DemoConsent = {
    id: nextId('con'),
    gimnasio_id: DEMO_GYM_ID,
    cliente_id: clientes[0].id,
    version_texto: 'Acepto seguimiento nutricional no clínico del centro.',
    medio: 'staff',
    aceptado_por: OPEN_USERS.nutricionista,
    activo: true,
    aceptado_en: createdAt,
    revocado_en: null,
    revocado_por: null,
    metadata: {},
    created_at: createdAt,
    updated_at: createdAt,
  };

  const planNutricion: DemoNutritionPlan = {
    id: nextId('npl'),
    gimnasio_id: DEMO_GYM_ID,
    cliente_id: clientes[0].id,
    nutricionista_user_id: OPEN_USERS.nutricionista,
    consentimiento_id: consentimiento.id,
    estado: 'activo',
    objetivo_general: 'Mejorar adherencia semanal',
    notas: 'Plan demo activo',
    activo_desde: addDaysDate(-7),
    activo_hasta: null,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const planVersion: DemoNutritionPlanVersion = {
    id: nextId('npv'),
    plan_id: planNutricion.id,
    version: 1,
    contenido: {
      comidas: [],
      recomendaciones: ['Hidratación diaria', 'Cumplir horarios'],
      habitos: [],
    },
    publicado: true,
    notas: 'Versión inicial',
    created_by: OPEN_USERS.nutricionista,
    created_at: createdAt,
  };

  const medicion: DemoMedicion = {
    id: nextId('med'),
    gimnasio_id: DEMO_GYM_ID,
    cliente_id: clientes[0].id,
    plan_id: planNutricion.id,
    peso_kg: 66.2,
    grasa_pct: null,
    perimetros: null,
    adherencia_pct: 78,
    notas: 'Buen avance semanal',
    fecha_medicion: todayDate(),
    registrado_por: OPEN_USERS.nutricionista,
    created_at: createdAt,
  };

  const pago: DemoPago = {
    id: nextId('pay'),
    gimnasio_id: DEMO_GYM_ID,
    cliente_id: clientes[0].id,
    membresia_id: membresias[0].id,
    monto: 2200,
    moneda: 'UYU',
    estado: 'registrado',
    metodo: 'manual',
    referencia: null,
    fecha_pago: createdAt,
    registrado_por: OPEN_USERS.recepcion,
    notas: 'Pago inicial demo',
    created_at: createdAt,
    updated_at: createdAt,
  };

  const reservaClase: DemoReservaClase = {
    id: nextId('res'),
    gimnasio_id: DEMO_GYM_ID,
    horario_id: horarios[0].id,
    clase_base_id: horarios[0].clase_base_id,
    cliente_id: clientes[0].id,
    estado: 'confirmada',
    prioridad_espera: 0,
    cancelada_en: null,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const reto: DemoReto = {
    id: nextId('ret'),
    gimnasio_id: DEMO_GYM_ID,
    nombre: 'Reto 10K Marzo',
    descripcion: 'Suma km durante el mes y gana premios.',
    activo: true,
    created_at: createdAt,
  };

  return {
    gymId: DEMO_GYM_ID,
    sedeId: DEMO_SEDE_ID,
    users: OPEN_USERS,
    seq,
    clientes,
    planes: [planMensual],
    membresias,
    pagos: [pago],
    clases,
    horarios,
    reservas: [reservaClase],
    builderServicios: [builderServicio],
    builderVersiones: [builderVersion],
    builderSesiones: [builderSesion],
    builderReservas: [],
    puntosMovimientos: [puntoSeed],
    premios: [premioDescuento],
    canjes: [],
    consentimientos: [consentimiento],
    planesNutricion: [planNutricion],
    planVersiones: [planVersion],
    mediciones: [medicion],
    whatsappQueue: [],
    retos: [reto],
  };
};

const loadDemoState = (): DemoState => {
  if (!existsSync(DEMO_STATE_FILE)) {
    const initial = createInitialState();
    mkdirSync(dirname(DEMO_STATE_FILE), { recursive: true });
    writeFileSync(DEMO_STATE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    const raw = readFileSync(DEMO_STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed?.gymId || !parsed?.seq) {
      const reset = createInitialState();
      writeFileSync(DEMO_STATE_FILE, JSON.stringify(reset, null, 2), 'utf-8');
      return reset;
    }
    return parsed;
  } catch {
    const reset = createInitialState();
    mkdirSync(dirname(DEMO_STATE_FILE), { recursive: true });
    writeFileSync(DEMO_STATE_FILE, JSON.stringify(reset, null, 2), 'utf-8');
    return reset;
  }
};

let demoState = loadDemoState();

const saveDemoState = () => {
  mkdirSync(dirname(DEMO_STATE_FILE), { recursive: true });
  writeFileSync(DEMO_STATE_FILE, JSON.stringify(demoState, null, 2), 'utf-8');
};

const syncDemoState = () => {
  demoState = loadDemoState();
};

const nextId = (prefix: string): string => {
  demoState.seq[prefix] = (demoState.seq[prefix] ?? 0) + 1;
  return `${prefix}-${String(demoState.seq[prefix]).padStart(4, '0')}`;
};

const roleRecord = (role: OpenRole) => ({
  id: `open-role-${role}`,
  gimnasio_id: demoState.gymId,
  rol: role,
  email: `${role}@gymcrm.demo`,
  activo: true,
  created_at: '2026-01-01T00:00:00.000Z',
});

const resolveCurrentCliente = (role: OpenRole): DemoCliente | null => {
  if (role !== 'cliente') return null;
  return demoState.clientes.find((item) => item.auth_user_id === demoState.users.cliente) ?? null;
};

const requireRole = (role: GymRole, allowed: readonly GymRole[], message: string) => {
  if (!hasRole(role, allowed)) {
    return fail(message, 403, 'forbidden');
  }

  return null;
};

const findClienteByRole = (role: OpenRole): DemoCliente | null => {
  if (role !== 'cliente') return null;
  return resolveCurrentCliente(role);
};

const isMembershipActive = (membresia: DemoMembresia): boolean => {
  const today = todayDate();
  return (
    membresia.estado === 'activa' &&
    membresia.fecha_inicio <= today &&
    membresia.fecha_fin >= today
  );
};

const activeMembershipForClient = (clienteId: string): DemoMembresia | null => {
  return demoState.membresias.find((item) => item.cliente_id === clienteId && isMembershipActive(item)) ?? null;
};

const applyClassWaitlistPromotion = (horarioId: string) => {
  const horario = demoState.horarios.find((item) => item.id === horarioId);
  if (!horario) return;

  const confirmedCount = demoState.reservas.filter(
    (item) =>
      item.horario_id === horarioId &&
      (item.estado === 'confirmada' || item.estado === 'asistio')
  ).length;

  if (confirmedCount >= horario.cupo_total) return;

  const candidate = demoState.reservas
    .filter((item) => item.horario_id === horarioId && item.estado === 'espera')
    .sort((a, b) => a.prioridad_espera - b.prioridad_espera || a.created_at.localeCompare(b.created_at))[0];

  if (!candidate) return;

  candidate.estado = 'confirmada';
  candidate.updated_at = nowIso();
};

const applyBuilderWaitlistPromotion = (sesionId: string) => {
  const sesion = demoState.builderSesiones.find((item) => item.id === sesionId);
  if (!sesion) return;

  const confirmedCount = demoState.builderReservas.filter(
    (item) =>
      item.sesion_id === sesionId &&
      (item.estado === 'confirmada' || item.estado === 'asistio')
  ).length;

  if (confirmedCount >= sesion.cupo_total) return;

  const candidate = demoState.builderReservas
    .filter((item) => item.sesion_id === sesionId && item.estado === 'espera')
    .sort((a, b) => a.prioridad_espera - b.prioridad_espera || a.created_at.localeCompare(b.created_at))[0];

  if (!candidate) return;

  candidate.estado = 'confirmada';
  candidate.updated_at = nowIso();
};

const pointsBalanceForClient = (clienteId: string): number => {
  const movements = demoState.puntosMovimientos.filter((item) => item.cliente_id === clienteId);
  return calculatePointsBalance(movements.map((item) => ({ puntos: item.puntos })));
};

const reservedPointsForClient = (clienteId: string): number => {
  return demoState.canjes
    .filter((item) => item.cliente_id === clienteId && (item.estado === 'solicitado' || item.estado === 'aprobado'))
    .reduce((sum, item) => sum + Number(item.puntos || 0), 0);
};

const createCouponCode = (): string => `GYM-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

const openSession = (request: Request) => {
  const role = readOpenRoleFromRequest(request);
  const userId = demoState.users[role];
  const cliente = findClienteByRole(role);

  return {
    role,
    userId,
    gymId: demoState.gymId,
    cliente,
  };
};

const sortByCreatedDesc = <T extends { created_at: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
};

const sortByUpdatedDesc = <T extends { updated_at: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
};

const toMonthBounds = (monthParam: string | null) => {
  const reference = monthParam ? new Date(`${monthParam}-01T00:00:00.000Z`) : new Date();
  if (Number.isNaN(reference.getTime())) {
    return null;
  }

  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return {
    month: start.toISOString().slice(0, 7),
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

const meResponse = (request: Request) => {
  const session = openSession(request);

  return ok({
    auth: {
      userId: session.userId,
      email: `${session.role}@gymcrm.demo`,
      profile: {
        open: true,
      },
    },
    role: roleRecord(session.role),
    cliente: session.cliente
      ? {
          id: session.cliente.id,
          gimnasio_id: session.cliente.gimnasio_id,
          nombres: session.cliente.nombres,
          apellidos: session.cliente.apellidos,
          email: session.cliente.email,
          codigo_qr: session.cliente.codigo_qr,
          estado: session.cliente.estado,
        }
      : null,
    ready: true,
    sourceMode: 'demo',
  });
};

const bootstrapResponse = (request: Request) => {
  const session = openSession(request);
  return ok({
    ready: true,
    role: roleRecord(session.role),
    bootstrap: 'already_initialized',
  });
};

const healthResponse = () => {
  return ok({
    healthy: true,
    mode: 'demo',
    checks: [
      { key: 'demo:seed', ok: true },
      { key: 'demo:router', ok: true },
    ],
    gymId: demoState.gymId,
  });
};

const dashboardResponse = () => {
  const today = todayDate();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString();

  const totalClientesActivos = demoState.clientes.filter((item) => item.estado === 'activo').length;
  const membresiasActivas = demoState.membresias.filter((item) => isMembershipActive(item)).length;
  const pagosMes = demoState.pagos
    .filter((item) => item.estado === 'registrado' && item.fecha_pago >= start && item.fecha_pago <= end)
    .reduce((sum, item) => sum + Number(item.monto || 0), 0);

  const reservasConfirmadasHoy = demoState.reservas.filter(
    (item) =>
      (item.estado === 'confirmada' || item.estado === 'asistio') &&
      item.created_at.slice(0, 10) === today
  ).length;

  const activeAtStart = demoState.membresias.filter(
    (item) => item.fecha_inicio <= start.slice(0, 10) && item.fecha_fin >= start.slice(0, 10)
  ).length;

  const activeAtEnd = demoState.membresias.filter(
    (item) => item.fecha_inicio <= end.slice(0, 10) && item.fecha_fin >= end.slice(0, 10)
  ).length;

  const retencionMensual = calculateRetentionRate(activeAtStart, activeAtEnd);

  const dynamicParticipants = new Set(
    demoState.builderReservas
      .filter((item) => item.created_at >= start && item.created_at <= end)
      .map((item) => item.cliente_id)
  ).size;

  const adopcionServiciosDinamicos = totalClientesActivos
    ? Number(((dynamicParticipants / totalClientesActivos) * 100).toFixed(2))
    : 0;

  const canjesSolicitados = demoState.canjes.filter(
    (item) => item.created_at >= start && item.created_at <= end && item.estado === 'solicitado'
  ).length;

  const canjesEntregados = demoState.canjes.filter(
    (item) => item.created_at >= start && item.created_at <= end && item.estado === 'entregado'
  ).length;

  const tasaCanje = canjesSolicitados > 0 ? Number(((canjesEntregados / canjesSolicitados) * 100).toFixed(2)) : 0;

  const retosParticipants = new Set(
    demoState.puntosMovimientos
      .filter((item) => item.created_at >= start && item.created_at <= end && (item.reto_id || item.origen_tipo === 'reto'))
      .map((item) => item.cliente_id)
  ).size;

  const participacionRetos = totalClientesActivos
    ? Number(((retosParticipants / totalClientesActivos) * 100).toFixed(2))
    : 0;

  const adherencias = demoState.mediciones
    .filter((item) => item.created_at >= start && item.created_at <= end && Number.isFinite(Number(item.adherencia_pct)))
    .map((item) => Number(item.adherencia_pct));

  const adherenciaNutricional =
    adherencias.length > 0
      ? Number((adherencias.reduce((sum, value) => sum + value, 0) / adherencias.length).toFixed(2))
      : 0;

  return ok({
    kpis: {
      totalClientesActivos,
      membresiasActivas,
      pagosMes: Number(pagosMes.toFixed(2)),
      retencionMensual,
      reservasConfirmadasHoy,
      adopcionServiciosDinamicos,
      tasaCanje,
      participacionRetos,
      adherenciaNutricional,
    },
    recientes: {
      clientes: sortByCreatedDesc(demoState.clientes).slice(0, 5),
      horarios: [...demoState.horarios]
        .filter((item) => item.estado === 'programada' && item.inicio >= nowIso())
        .sort((a, b) => a.inicio.localeCompare(b.inicio))
        .slice(0, 5),
    },
  });
};

const listClientes = (request: Request) => {
  const items = sortByUpdatedDesc(demoState.clientes);
  const { data, count } = paginate(items, new URL(request.url).searchParams);
  return okList(data, count);
};

const createCliente = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.clientes, 'No tienes permisos para crear clientes.');
  if (permissionError) return permissionError;

  const body = await parseJsonBody<Partial<DemoCliente>>(request);
  const nombres = body.nombres?.trim();
  const apellidos = body.apellidos?.trim();
  if (!nombres || !apellidos) {
    return fail('nombres y apellidos son obligatorios.', 400);
  }

  const createdAt = nowIso();
  const cliente: DemoCliente = {
    id: nextId('cli'),
    gimnasio_id: demoState.gymId,
    sede_id: demoState.sedeId,
    auth_user_id: body.auth_user_id ?? null,
    nombres,
    apellidos,
    email: body.email?.trim() || null,
    telefono: body.telefono?.trim() || null,
    fecha_nacimiento: body.fecha_nacimiento ?? null,
    objetivo: body.objetivo?.trim() || null,
    estado: body.estado ?? 'activo',
    codigo_qr: `QR-${randomUUID().slice(0, 8).toUpperCase()}`,
    created_at: createdAt,
    updated_at: createdAt,
  };

  demoState.clientes.unshift(cliente);
  return ok(cliente, { status: 201 });
};

const patchCliente = async (request: Request, id: string) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.clientes, 'No tienes permisos para editar clientes.');
  if (permissionError) return permissionError;

  const cliente = demoState.clientes.find((item) => item.id === id);
  if (!cliente) return fail('Cliente no encontrado.', 404);

  const body = await parseJsonBody<Partial<DemoCliente>>(request);

  if (body.nombres !== undefined) cliente.nombres = body.nombres.trim();
  if (body.apellidos !== undefined) cliente.apellidos = body.apellidos.trim();
  if (body.email !== undefined) cliente.email = body.email ? body.email.trim() : null;
  if (body.telefono !== undefined) cliente.telefono = body.telefono ? body.telefono.trim() : null;
  if (body.estado !== undefined) cliente.estado = body.estado;
  if (body.objetivo !== undefined) cliente.objetivo = body.objetivo ? body.objetivo.trim() : null;
  cliente.updated_at = nowIso();

  return ok(cliente);
};

const deactivateCliente = (request: Request, id: string) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.clientes, 'No tienes permisos para desactivar clientes.');
  if (permissionError) return permissionError;

  const cliente = demoState.clientes.find((item) => item.id === id);
  if (!cliente) return fail('Cliente no encontrado.', 404);
  cliente.estado = 'inactivo';
  cliente.updated_at = nowIso();

  return ok(cliente);
};

const listClases = (request: Request) => {
  const searchParams = new URL(request.url).searchParams;
  const active = searchParams.get('active');
  let classes = sortByCreatedDesc(demoState.clases);
  if (active === 'true') classes = classes.filter((item) => item.activa);
  if (active === 'false') classes = classes.filter((item) => !item.activa);

  const { data, count } = paginate(classes, searchParams);
  return okList(data, count);
};

const createClase = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.clases, 'No tienes permisos para crear clases.');
  if (permissionError) return permissionError;

  const body = await parseJsonBody<Partial<DemoClase>>(request);
  const nombre = body.nombre?.trim();
  const cupo = Number(body.cupo_total ?? 0);
  const duracion = Number(body.duracion_min ?? 0);

  if (!nombre) return fail('nombre es obligatorio.', 400);
  if (!Number.isFinite(cupo) || cupo <= 0) return fail('cupo_total debe ser mayor a 0.', 400);
  if (!Number.isFinite(duracion) || duracion <= 0) return fail('duracion_min debe ser mayor a 0.', 400);

  const stamp = nowIso();
  const clase: DemoClase = {
    id: nextId('class'),
    gimnasio_id: demoState.gymId,
    sede_id: body.sede_id ?? demoState.sedeId,
    nombre,
    descripcion: body.descripcion?.trim() || null,
    cupo_total: Math.floor(cupo),
    duracion_min: Math.floor(duracion),
    instructor_nombre: body.instructor_nombre?.trim() || null,
    nivel: body.nivel?.trim() || null,
    activa: body.activa ?? true,
    created_at: stamp,
    updated_at: stamp,
  };

  demoState.clases.unshift(clase);
  return ok(clase, { status: 201 });
};

const patchClase = async (request: Request, id: string) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.clases, 'No tienes permisos para editar clases.');
  if (permissionError) return permissionError;

  const clase = demoState.clases.find((item) => item.id === id);
  if (!clase) return fail('Clase no encontrada.', 404);

  const body = await parseJsonBody<Partial<DemoClase>>(request);
  if (body.nombre !== undefined) clase.nombre = body.nombre.trim();
  if (body.descripcion !== undefined) clase.descripcion = body.descripcion ? body.descripcion.trim() : null;
  if (body.cupo_total !== undefined) {
    const cupo = Number(body.cupo_total);
    if (!Number.isFinite(cupo) || cupo <= 0) return fail('cupo_total debe ser mayor a 0.', 400);
    clase.cupo_total = Math.floor(cupo);
  }
  if (body.duracion_min !== undefined) {
    const duracion = Number(body.duracion_min);
    if (!Number.isFinite(duracion) || duracion <= 0) return fail('duracion_min debe ser mayor a 0.', 400);
    clase.duracion_min = Math.floor(duracion);
  }
  if (body.instructor_nombre !== undefined) clase.instructor_nombre = body.instructor_nombre ? body.instructor_nombre.trim() : null;
  if (body.nivel !== undefined) clase.nivel = body.nivel ? body.nivel.trim() : null;
  if (body.activa !== undefined) clase.activa = Boolean(body.activa);
  clase.updated_at = nowIso();

  return ok(clase);
};

const pauseClase = (request: Request, id: string) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.clases, 'No tienes permisos para pausar clases.');
  if (permissionError) return permissionError;

  const clase = demoState.clases.find((item) => item.id === id);
  if (!clase) return fail('Clase no encontrada.', 404);

  clase.activa = false;
  clase.updated_at = nowIso();
  return ok(clase);
};

const listHorarios = (request: Request) => {
  const searchParams = new URL(request.url).searchParams;
  const claseBaseId = searchParams.get('claseBaseId');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  let rows = [...demoState.horarios].sort((a, b) => a.inicio.localeCompare(b.inicio));

  if (claseBaseId) rows = rows.filter((item) => item.clase_base_id === claseBaseId);
  if (start) rows = rows.filter((item) => item.inicio >= start);
  if (end) rows = rows.filter((item) => item.inicio <= end);

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createHorario = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.clases, 'No tienes permisos para crear horarios.');
  if (permissionError) return permissionError;

  const body = await parseJsonBody<Partial<DemoHorario>>(request);
  if (!body.clase_base_id || !body.inicio || !body.fin) {
    return fail('clase_base_id, inicio y fin son obligatorios.', 400);
  }

  const clase = demoState.clases.find((item) => item.id === body.clase_base_id);
  if (!clase) return fail('Clase base no encontrada.', 400);

  const cupo = Number(body.cupo_total ?? clase.cupo_total);
  if (!Number.isFinite(cupo) || cupo <= 0) {
    return fail('cupo_total debe ser mayor a 0.', 400);
  }

  const stamp = nowIso();
  const horario: DemoHorario = {
    id: nextId('hor'),
    gimnasio_id: demoState.gymId,
    sede_id: body.sede_id ?? clase.sede_id,
    clase_base_id: body.clase_base_id,
    inicio: new Date(body.inicio).toISOString(),
    fin: new Date(body.fin).toISOString(),
    cupo_total: Math.floor(cupo),
    estado: body.estado ?? 'programada',
    created_at: stamp,
    updated_at: stamp,
  };

  demoState.horarios.push(horario);
  return ok(horario, { status: 201 });
};

const patchHorario = async (request: Request, id: string) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.clases, 'No tienes permisos para editar horarios.');
  if (permissionError) return permissionError;

  const horario = demoState.horarios.find((item) => item.id === id);
  if (!horario) return fail('Horario no encontrado.', 404);

  const body = await parseJsonBody<Partial<DemoHorario>>(request);
  if (body.inicio !== undefined) horario.inicio = new Date(body.inicio).toISOString();
  if (body.fin !== undefined) horario.fin = new Date(body.fin).toISOString();
  if (body.cupo_total !== undefined) {
    const cupo = Number(body.cupo_total);
    if (!Number.isFinite(cupo) || cupo <= 0) return fail('cupo_total debe ser mayor a 0.', 400);
    horario.cupo_total = Math.floor(cupo);
  }
  if (body.estado !== undefined) horario.estado = body.estado;
  horario.updated_at = nowIso();

  return ok(horario);
};

const cancelHorario = (request: Request, id: string) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.clases, 'No tienes permisos para cancelar horarios.');
  if (permissionError) return permissionError;

  const horario = demoState.horarios.find((item) => item.id === id);
  if (!horario) return fail('Horario no encontrado.', 404);

  horario.estado = 'cancelada';
  horario.updated_at = nowIso();
  return ok(horario);
};

const listReservasClase = (request: Request) => {
  const session = openSession(request);
  const searchParams = new URL(request.url).searchParams;
  const horarioId = searchParams.get('horarioId');
  const estado = searchParams.get('estado');

  let rows = sortByCreatedDesc(demoState.reservas);
  if (horarioId) rows = rows.filter((item) => item.horario_id === horarioId);
  if (estado) rows = rows.filter((item) => item.estado === estado);

  if (session.role === 'cliente') {
    if (!session.cliente) return okList([], 0);
    rows = rows.filter((item) => item.cliente_id === session.cliente?.id);
  }

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createReservaClase = async (request: Request) => {
  const session = openSession(request);
  const canStaff = hasRole(session.role, PERMISSIONS.reservasStaff);
  const isClient = session.role === 'cliente';

  if (!canStaff && !isClient) {
    return fail('No tienes permisos para crear reservas.', 403, 'forbidden');
  }

  const body = await parseJsonBody<{ horario_id?: string; cliente_id?: string }>(request);
  if (!body.horario_id) return fail('horario_id es obligatorio.', 400);

  const horario = demoState.horarios.find((item) => item.id === body.horario_id);
  if (!horario) return fail('Horario no encontrado.', 400);
  if (horario.estado !== 'programada') return fail('Solo se pueden reservar horarios programados.', 400);

  const clienteId = isClient ? session.cliente?.id : body.cliente_id ?? session.cliente?.id;
  if (!clienteId) return fail('No se pudo resolver cliente de la reserva.', 400);

  if (!activeMembershipForClient(clienteId)) {
    return fail('El cliente no tiene membresía activa para reservar.', 400);
  }

  const duplicate = demoState.reservas.find(
    (item) => item.horario_id === horario.id && item.cliente_id === clienteId && item.estado !== 'cancelada'
  );
  if (duplicate) {
    return ok(duplicate);
  }

  const confirmedCount = demoState.reservas.filter(
    (item) => item.horario_id === horario.id && (item.estado === 'confirmada' || item.estado === 'asistio')
  ).length;

  const finalState = resolveReservationStateByCapacity('confirmada', confirmedCount, horario.cupo_total);

  const stamp = nowIso();
  const reserva: DemoReservaClase = {
    id: nextId('res'),
    gimnasio_id: demoState.gymId,
    horario_id: horario.id,
    clase_base_id: horario.clase_base_id,
    cliente_id: clienteId,
    estado: finalState,
    prioridad_espera: finalState === 'espera' ? confirmedCount + 1 : 0,
    cancelada_en: null,
    created_at: stamp,
    updated_at: stamp,
  };

  demoState.reservas.unshift(reserva);
  return ok(reserva, { status: 201 });
};

const patchReservaClase = async (request: Request, id: string) => {
  const session = openSession(request);
  const canStaff = hasRole(session.role, PERMISSIONS.reservasStaff);

  const reserva = demoState.reservas.find((item) => item.id === id);
  if (!reserva) return fail('Reserva no encontrada.', 404);

  const body = await parseJsonBody<{ estado?: ReservationState }>(request);
  if (!body.estado) return fail('estado es obligatorio.', 400);

  if (!canStaff) {
    if (session.role !== 'cliente') {
      return fail('No tienes permisos para actualizar reservas.', 403, 'forbidden');
    }
    if (!session.cliente || reserva.cliente_id !== session.cliente.id) {
      return fail('Solo puedes modificar tus propias reservas.', 403, 'forbidden');
    }
    if (body.estado !== 'cancelada') {
      return fail('El cliente solo puede cancelar su reserva.', 403, 'forbidden');
    }

    const horario = demoState.horarios.find((item) => item.id === reserva.horario_id);
    if (!horario) return fail('Horario no encontrado.', 400);

    if (!canCancelReservation(horario.inicio, new Date(), 30)) {
      return fail('La cancelación debe realizarse con al menos 30 minutos de anticipación.', 400);
    }
  }

  const previous = reserva.estado;
  reserva.estado = body.estado;
  reserva.updated_at = nowIso();
  if (body.estado === 'cancelada') reserva.cancelada_en = nowIso();

  if (previous === 'confirmada' && body.estado === 'cancelada') {
    applyClassWaitlistPromotion(reserva.horario_id);
  }

  return ok(reserva);
};

const listBuilderTemplatesRoute = () => {
  return ok({
    templates: listBuilderTemplates(),
  });
};

const listBuilderServices = (request: Request) => {
  const searchParams = new URL(request.url).searchParams;
  const estado = searchParams.get('estado');
  const active = searchParams.get('active');

  let rows = sortByCreatedDesc(demoState.builderServicios);
  if (estado) rows = rows.filter((item) => item.estado === estado);
  if (active === 'true') rows = rows.filter((item) => item.activo);
  if (active === 'false') rows = rows.filter((item) => !item.activo);

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createBuilderService = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(
    session.role,
    PERMISSIONS.builder,
    'No tienes permisos para crear servicios del builder.'
  );
  if (permissionError) return permissionError;

  const body = await parseJsonBody<{ slug?: string; nombre?: string; plantilla?: string; estado?: DemoBuilderService['estado']; definicion?: unknown }>(request);

  const slug = body.slug?.trim().toLowerCase();
  const nombre = body.nombre?.trim();
  const plantilla = body.plantilla?.trim();

  if (!slug || !nombre || !plantilla) {
    return fail('slug, nombre y plantilla son obligatorios.', 400);
  }

  if (!isBuilderTemplateKey(plantilla)) {
    return fail('plantilla inválida.', 400);
  }

  if (demoState.builderServicios.some((item) => item.slug === slug)) {
    return fail('slug ya existe.', 400);
  }

  const stamp = nowIso();
  const servicio: DemoBuilderService = {
    id: nextId('svc'),
    gimnasio_id: demoState.gymId,
    slug,
    nombre,
    modulo_base: plantilla,
    estado: body.estado ?? 'borrador',
    activo: body.estado === 'pausado' ? false : true,
    created_by: session.userId,
    created_at: stamp,
    updated_at: stamp,
  };

  const version: DemoBuilderVersion = {
    id: nextId('svv'),
    servicio_id: servicio.id,
    version: 1,
    definicion: normalizeBuilderDefinition(plantilla, body.definicion),
    publicado: servicio.estado === 'publicado',
    created_by: session.userId,
    created_at: stamp,
  };

  demoState.builderServicios.unshift(servicio);
  demoState.builderVersiones.unshift(version);

  return ok({ servicio, version }, { status: 201 });
};

const patchBuilderService = async (request: Request, id: string) => {
  const session = openSession(request);
  const permissionError = requireRole(
    session.role,
    PERMISSIONS.builder,
    'No tienes permisos para editar servicios del builder.'
  );
  if (permissionError) return permissionError;

  const servicio = demoState.builderServicios.find((item) => item.id === id);
  if (!servicio) return fail('Servicio no encontrado.', 404);

  const body = await parseJsonBody<{
    nombre?: string;
    plantilla?: string;
    estado?: DemoBuilderService['estado'];
    activo?: boolean;
    definicion?: unknown;
    publicarVersion?: boolean;
  }>(request);

  if (body.nombre !== undefined) servicio.nombre = body.nombre.trim();
  if (body.estado !== undefined) servicio.estado = body.estado;
  if (body.activo !== undefined) servicio.activo = Boolean(body.activo);

  let templateKey = servicio.modulo_base;
  if (body.plantilla !== undefined) {
    if (!isBuilderTemplateKey(body.plantilla)) {
      return fail('plantilla inválida.', 400);
    }
    templateKey = body.plantilla;
    servicio.modulo_base = body.plantilla;
  }

  let newVersion: DemoBuilderVersion | null = null;
  if (body.definicion !== undefined) {
    const currentVersion = demoState.builderVersiones
      .filter((item) => item.servicio_id === id)
      .sort((a, b) => b.version - a.version)[0];

    const nextVersion = (currentVersion?.version ?? 0) + 1;
    newVersion = {
      id: nextId('svv'),
      servicio_id: id,
      version: nextVersion,
      definicion: normalizeBuilderDefinition(
        isBuilderTemplateKey(templateKey) ? templateKey : 'clase_grupal',
        body.definicion
      ),
      publicado: Boolean(body.publicarVersion),
      created_by: session.userId,
      created_at: nowIso(),
    };
    demoState.builderVersiones.unshift(newVersion);
  }

  servicio.updated_at = nowIso();

  return ok({
    servicio,
    nuevaVersion: newVersion,
  });
};

const listBuilderSessions = (request: Request) => {
  const searchParams = new URL(request.url).searchParams;
  const servicioId = searchParams.get('servicioId');
  const estado = searchParams.get('estado');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  let rows = [...demoState.builderSesiones].sort((a, b) => a.inicio.localeCompare(b.inicio));

  if (servicioId) rows = rows.filter((item) => item.servicio_id === servicioId);
  if (estado) rows = rows.filter((item) => item.estado === estado);
  if (start) rows = rows.filter((item) => item.inicio >= start);
  if (end) rows = rows.filter((item) => item.inicio <= end);

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createBuilderSession = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(
    session.role,
    PERMISSIONS.builderRuntimeStaff,
    'No tienes permisos para crear sesiones dinámicas.'
  );
  if (permissionError) return permissionError;

  const body = await parseJsonBody<{
    servicio_id?: string;
    version_id?: string | null;
    sede_id?: string | null;
    titulo?: string;
    descripcion?: string | null;
    inicio?: string;
    fin?: string;
    cupo_total?: number;
    reglas?: Record<string, unknown>;
  }>(request);

  if (!body.servicio_id || !body.titulo?.trim() || !body.inicio || !body.fin || !body.cupo_total) {
    return fail('servicio_id, titulo, inicio, fin y cupo_total son obligatorios.', 400);
  }

  const servicio = demoState.builderServicios.find((item) => item.id === body.servicio_id);
  if (!servicio || !servicio.activo) {
    return fail('Servicio inválido o inactivo.', 400);
  }

  const cupo = Number(body.cupo_total);
  if (!Number.isFinite(cupo) || cupo <= 0) {
    return fail('cupo_total debe ser mayor a 0.', 400);
  }

  const inicio = new Date(body.inicio);
  const fin = new Date(body.fin);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin <= inicio) {
    return fail('Rango de fecha inválido.', 400);
  }

  const stamp = nowIso();
  const sesion: DemoBuilderSession = {
    id: nextId('ses'),
    gimnasio_id: demoState.gymId,
    sede_id: body.sede_id ?? demoState.sedeId,
    servicio_id: body.servicio_id,
    version_id: body.version_id ?? null,
    titulo: body.titulo.trim(),
    descripcion: body.descripcion?.trim() || null,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    cupo_total: Math.floor(cupo),
    reglas: body.reglas ?? {},
    estado: 'programada',
    created_by: session.userId,
    created_at: stamp,
    updated_at: stamp,
  };

  demoState.builderSesiones.push(sesion);
  return ok(sesion, { status: 201 });
};

const listBuilderReservations = (request: Request) => {
  const session = openSession(request);
  const searchParams = new URL(request.url).searchParams;
  const sesionId = searchParams.get('sesionId');
  const estado = searchParams.get('estado');

  let rows = sortByCreatedDesc(demoState.builderReservas);
  if (sesionId) rows = rows.filter((item) => item.sesion_id === sesionId);
  if (estado) rows = rows.filter((item) => item.estado === estado);

  if (session.role === 'cliente') {
    if (!session.cliente) return okList([], 0);
    rows = rows.filter((item) => item.cliente_id === session.cliente?.id);
  }

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createBuilderReservation = async (request: Request) => {
  const session = openSession(request);
  const canStaff = hasRole(session.role, PERMISSIONS.builderRuntimeStaff);
  const isCliente = session.role === 'cliente';

  if (!canStaff && !isCliente) {
    return fail('No tienes permisos para crear reservas dinámicas.', 403, 'forbidden');
  }

  const body = await parseJsonBody<{
    sesion_id?: string;
    servicio_id?: string;
    cliente_id?: string;
    estado?: ReservationState;
  }>(request);

  if (!body.sesion_id) return fail('sesion_id es obligatorio.', 400);

  const sesion = demoState.builderSesiones.find((item) => item.id === body.sesion_id);
  if (!sesion || sesion.estado !== 'programada') {
    return fail('Sesión inválida o no programada.', 400);
  }

  const clienteId = isCliente ? session.cliente?.id : body.cliente_id ?? session.cliente?.id;
  if (!clienteId) return fail('No se pudo resolver cliente de la reserva.', 400);

  if (!activeMembershipForClient(clienteId)) {
    return fail('El cliente no tiene membresía activa para reservar.', 400);
  }

  const duplicate = demoState.builderReservas.find(
    (item) => item.sesion_id === sesion.id && item.cliente_id === clienteId && item.estado !== 'cancelada'
  );
  if (duplicate) return ok(duplicate);

  const confirmedCount = demoState.builderReservas.filter(
    (item) => item.sesion_id === sesion.id && (item.estado === 'confirmada' || item.estado === 'asistio')
  ).length;

  const requestedState = body.estado ?? 'confirmada';
  const finalState = resolveReservationStateByCapacity(requestedState, confirmedCount, sesion.cupo_total);

  const waitingCount = demoState.builderReservas.filter(
    (item) => item.sesion_id === sesion.id && item.estado === 'espera'
  ).length;

  const stamp = nowIso();
  const reserva: DemoBuilderReserva = {
    id: nextId('brv'),
    gimnasio_id: demoState.gymId,
    sesion_id: sesion.id,
    servicio_id: body.servicio_id ?? sesion.servicio_id,
    cliente_id: clienteId,
    estado: finalState,
    prioridad_espera: finalState === 'espera' ? waitingCount + 1 : 0,
    cancelada_en: null,
    registrado_por: canStaff ? session.userId : null,
    created_at: stamp,
    updated_at: stamp,
  };

  demoState.builderReservas.unshift(reserva);
  return ok(reserva, { status: 201 });
};

const patchBuilderReservation = async (request: Request, id: string) => {
  const session = openSession(request);
  const canStaff = hasRole(session.role, PERMISSIONS.builderRuntimeStaff);

  const reserva = demoState.builderReservas.find((item) => item.id === id);
  if (!reserva) return fail('Reserva no encontrada.', 404);

  const body = await parseJsonBody<{ estado?: ReservationState }>(request);
  if (!body.estado) return fail('estado es obligatorio.', 400);

  if (!canStaff) {
    if (session.role !== 'cliente') {
      return fail('No tienes permisos para actualizar reservas.', 403, 'forbidden');
    }

    if (!session.cliente || reserva.cliente_id !== session.cliente.id) {
      return fail('Solo puedes modificar tus propias reservas.', 403, 'forbidden');
    }

    if (body.estado !== 'cancelada') {
      return fail('El cliente solo puede cancelar su reserva.', 403, 'forbidden');
    }

    const sesion = demoState.builderSesiones.find((item) => item.id === reserva.sesion_id);
    const minCancel = Number(sesion?.reglas?.cancelacionMinutosAntes ?? 30);
    if (!sesion || !canCancelReservation(sesion.inicio, new Date(), Number.isFinite(minCancel) ? minCancel : 30)) {
      return fail('La cancelación debe realizarse con anticipación suficiente.', 400);
    }
  }

  const previous = reserva.estado;
  reserva.estado = body.estado;
  reserva.updated_at = nowIso();
  if (body.estado === 'cancelada') reserva.cancelada_en = nowIso();

  if (previous === 'confirmada' && body.estado === 'cancelada') {
    applyBuilderWaitlistPromotion(reserva.sesion_id);
  }

  return ok(reserva);
};

const listPuntos = (request: Request) => {
  const session = openSession(request);
  const searchParams = new URL(request.url).searchParams;
  const clienteIdQuery = searchParams.get('clienteId');

  let clienteId = clienteIdQuery;
  if (session.role === 'cliente') {
    clienteId = session.cliente?.id ?? null;
    if (!clienteId) {
      return ok({ data: [], count: 0, balance: 0 });
    }
  }

  let rows = sortByCreatedDesc(demoState.puntosMovimientos);
  if (clienteId) rows = rows.filter((item) => item.cliente_id === clienteId);

  const { data, count } = paginate(rows, searchParams);
  const balance = clienteId
    ? pointsBalanceForClient(clienteId)
    : calculatePointsBalance(data.map((item) => ({ puntos: item.puntos })));

  return ok({ data, count, balance });
};

const createPuntos = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(
    session.role,
    PERMISSIONS.comunidadCanjesStaff,
    'No tienes permisos para registrar puntos.'
  );
  if (permissionError) return permissionError;

  const body = await parseJsonBody<{
    cliente_id?: string;
    puntos?: number;
    motivo?: string;
    reto_id?: string | null;
    origen_tipo?: DemoPointMovement['origen_tipo'];
    origen_ref?: string | null;
    metadata?: Record<string, unknown>;
  }>(request);

  const clienteId = body.cliente_id;
  const puntos = Number(body.puntos);
  const motivo = body.motivo?.trim();

  if (!clienteId || !motivo || !Number.isFinite(puntos) || puntos === 0) {
    return fail('cliente_id, motivo y puntos (distinto de 0) son obligatorios.', 400);
  }

  const movimiento: DemoPointMovement = {
    id: nextId('pts'),
    gimnasio_id: demoState.gymId,
    cliente_id: clienteId,
    reto_id: body.reto_id ?? null,
    puntos: Math.trunc(puntos),
    motivo,
    origen_tipo: body.origen_tipo ?? 'manual',
    origen_ref: body.origen_ref ?? null,
    aprobado_por: session.userId,
    created_by: session.userId,
    anulacion_de: null,
    metadata: body.metadata ?? {},
    created_at: nowIso(),
  };

  demoState.puntosMovimientos.unshift(movimiento);
  return ok(movimiento, { status: 201 });
};

const listPremios = (request: Request) => {
  const searchParams = new URL(request.url).searchParams;
  const activa = searchParams.get('activa');

  let rows = sortByCreatedDesc(demoState.premios);
  if (activa === 'true') rows = rows.filter((item) => item.activa);
  if (activa === 'false') rows = rows.filter((item) => !item.activa);

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createPremio = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.comunidadPremios, 'No tienes permisos para crear premios.');
  if (permissionError) return permissionError;

  const body = await parseJsonBody<{
    nombre?: string;
    descripcion?: string | null;
    tipo?: string;
    costo_puntos?: number;
    monto_descuento?: number | null;
    servicio_id?: string | null;
    vigencia_desde?: string | null;
    vigencia_hasta?: string | null;
    stock_total?: number | null;
    activa?: boolean;
    metadata?: Record<string, unknown>;
  }>(request);

  const nombre = body.nombre?.trim();
  const tipo = body.tipo;
  const costo = Number(body.costo_puntos);
  if (!nombre || !tipo || !Number.isFinite(costo)) {
    return fail('nombre, tipo y costo_puntos son obligatorios.', 400);
  }

  if (!isPremioTipo(tipo)) {
    return fail('tipo inválido.', 400);
  }

  if (costo <= 0) return fail('costo_puntos debe ser mayor a 0.', 400);

  if (tipo === 'descuento_pago' && (!Number.isFinite(Number(body.monto_descuento)) || Number(body.monto_descuento) <= 0)) {
    return fail('monto_descuento debe ser mayor a 0 para descuentos.', 400);
  }

  if (tipo === 'pase_servicio' && !body.servicio_id) {
    return fail('servicio_id es obligatorio para pase_servicio.', 400);
  }

  const stockTotal = body.stock_total === undefined ? null : body.stock_total;

  const premio: DemoPremio = {
    id: nextId('prm'),
    gimnasio_id: demoState.gymId,
    nombre,
    descripcion: body.descripcion?.trim() || null,
    tipo,
    costo_puntos: Math.trunc(costo),
    monto_descuento: tipo === 'descuento_pago' ? Number(body.monto_descuento) : null,
    moneda: 'UYU',
    servicio_id: tipo === 'pase_servicio' ? body.servicio_id ?? null : null,
    vigencia_desde: body.vigencia_desde ?? null,
    vigencia_hasta: body.vigencia_hasta ?? null,
    stock_total: stockTotal,
    stock_disponible: stockTotal,
    activa: body.activa ?? true,
    metadata: body.metadata ?? {},
    created_by: session.userId,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  demoState.premios.unshift(premio);
  return ok(premio, { status: 201 });
};

const listCanjes = (request: Request) => {
  const session = openSession(request);
  const searchParams = new URL(request.url).searchParams;
  const estado = searchParams.get('estado');
  const clienteIdQuery = searchParams.get('clienteId');

  let clienteId = clienteIdQuery;
  if (session.role === 'cliente') {
    clienteId = session.cliente?.id ?? null;
    if (!clienteId) return okList([], 0);
  }

  let rows = sortByCreatedDesc(demoState.canjes);
  if (estado) rows = rows.filter((item) => item.estado === estado);
  if (clienteId) rows = rows.filter((item) => item.cliente_id === clienteId);

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createCanje = async (request: Request) => {
  const session = openSession(request);
  const isStaff = hasRole(session.role, PERMISSIONS.comunidadCanjesStaff);
  const isCliente = session.role === 'cliente';
  if (!isStaff && !isCliente) {
    return fail('No tienes permisos para solicitar canjes.', 403, 'forbidden');
  }

  const body = await parseJsonBody<{ premio_id?: string; cliente_id?: string; metadata?: Record<string, unknown> }>(request);
  if (!body.premio_id) return fail('premio_id es obligatorio.', 400);

  const premio = demoState.premios.find((item) => item.id === body.premio_id && item.activa);
  if (!premio) return fail('Premio inválido o inactivo.', 400);

  const clienteId = isCliente ? session.cliente?.id : body.cliente_id ?? session.cliente?.id;
  if (!clienteId) return fail('No se pudo resolver cliente para el canje.', 400);

  const today = todayDate();
  if (premio.vigencia_desde && premio.vigencia_desde > today) return fail('El premio todavía no está vigente.', 400);
  if (premio.vigencia_hasta && premio.vigencia_hasta < today) return fail('El premio ya no está vigente.', 400);

  if (premio.stock_disponible !== null && premio.stock_disponible <= 0) {
    return fail('No hay stock disponible para este premio.', 400);
  }

  const currentBalance = pointsBalanceForClient(clienteId) - reservedPointsForClient(clienteId);
  if (!canRedeemPoints(currentBalance, premio.costo_puntos)) {
    return fail('Puntos insuficientes para solicitar el canje.', 400);
  }

  const stamp = nowIso();
  const canje: DemoCanje = {
    id: nextId('cnj'),
    gimnasio_id: demoState.gymId,
    cliente_id: clienteId,
    premio_id: premio.id,
    estado: 'solicitado',
    puntos: premio.costo_puntos,
    credito_monto: premio.tipo === 'descuento_pago' ? premio.monto_descuento : null,
    credito_moneda: 'UYU',
    motivo_rechazo: null,
    cupon_codigo: null,
    aprobado_por: null,
    aprobado_en: null,
    resuelto_por: null,
    entregado_en: null,
    anulado_en: null,
    metadata: body.metadata ?? {},
    created_at: stamp,
    updated_at: stamp,
  };

  demoState.canjes.unshift(canje);
  return ok(canje, { status: 201 });
};

const patchCanje = async (request: Request, id: string) => {
  const session = openSession(request);
  const permissionError = requireRole(
    session.role,
    PERMISSIONS.comunidadCanjesStaff,
    'No tienes permisos para actualizar canjes.'
  );
  if (permissionError) return permissionError;

  const canje = demoState.canjes.find((item) => item.id === id);
  if (!canje) return fail('Canje no encontrado.', 404);

  const premio = demoState.premios.find((item) => item.id === canje.premio_id);
  if (!premio) return fail('No se pudo validar premio del canje.', 500);

  const body = await parseJsonBody<{ estado?: string; motivo_rechazo?: string | null }>(request);
  if (!body.estado || !isCanjeState(body.estado)) return fail('estado inválido.', 400);
  if (canje.estado === body.estado) return fail('El canje ya tiene ese estado.', 400);

  const transitions: Record<CanjeState, CanjeState[]> = {
    solicitado: ['aprobado', 'rechazado', 'anulado'],
    aprobado: ['entregado', 'anulado'],
    rechazado: ['anulado'],
    entregado: ['anulado'],
    anulado: [],
  };

  if (!transitions[canje.estado].includes(body.estado)) {
    return fail(`Transición inválida de ${canje.estado} a ${body.estado}.`, 400, 'invalid_transition');
  }

  if (body.estado === 'aprobado') {
    if (premio.stock_disponible !== null && premio.stock_disponible <= 0) {
      return fail('No hay stock disponible para aprobar este canje.', 400);
    }

    demoState.puntosMovimientos.unshift({
      id: nextId('pts'),
      gimnasio_id: demoState.gymId,
      cliente_id: canje.cliente_id,
      reto_id: null,
      puntos: -Math.abs(canje.puntos),
      motivo: `CANJE_DEBITO:${canje.id}`,
      origen_tipo: 'canje_ajuste',
      origen_ref: canje.id,
      aprobado_por: session.userId,
      created_by: session.userId,
      anulacion_de: null,
      metadata: { canje_id: canje.id, movement: 'CANJE_DEBITO' },
      created_at: nowIso(),
    });

    if (premio.stock_disponible !== null) {
      premio.stock_disponible = Math.max(premio.stock_disponible - 1, 0);
    }

    canje.aprobado_por = session.userId;
    canje.aprobado_en = nowIso();
    if (premio.tipo === 'pase_servicio' && !canje.cupon_codigo) {
      canje.cupon_codigo = createCouponCode();
    }
  }

  if (body.estado === 'anulado' && (canje.estado === 'aprobado' || canje.estado === 'entregado')) {
    demoState.puntosMovimientos.unshift({
      id: nextId('pts'),
      gimnasio_id: demoState.gymId,
      cliente_id: canje.cliente_id,
      reto_id: null,
      puntos: Math.abs(canje.puntos),
      motivo: `CANJE_REVERSO:${canje.id}`,
      origen_tipo: 'canje_ajuste',
      origen_ref: canje.id,
      aprobado_por: session.userId,
      created_by: session.userId,
      anulacion_de: null,
      metadata: { canje_id: canje.id, movement: 'CANJE_REVERSO' },
      created_at: nowIso(),
    });
  }

  canje.estado = body.estado;
  canje.motivo_rechazo = body.estado === 'rechazado' ? body.motivo_rechazo?.trim() || null : null;
  canje.resuelto_por = body.estado === 'entregado' || body.estado === 'anulado' ? session.userId : canje.resuelto_por;
  canje.entregado_en = body.estado === 'entregado' ? nowIso() : canje.entregado_en;
  canje.anulado_en = body.estado === 'anulado' ? nowIso() : canje.anulado_en;
  canje.updated_at = nowIso();

  return ok(canje);
};

const rankingResponse = (request: Request) => {
  const searchParams = new URL(request.url).searchParams;
  const bounds = toMonthBounds(searchParams.get('month'));
  if (!bounds) return fail('month inválido. Usa formato YYYY-MM.', 400);

  const limitRaw = Number(searchParams.get('limit') ?? '20');
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 20;

  const scoreByClient = new Map<string, number>();
  for (const movement of demoState.puntosMovimientos) {
    if (movement.created_at < bounds.start || movement.created_at > bounds.end) continue;
    scoreByClient.set(movement.cliente_id, (scoreByClient.get(movement.cliente_id) ?? 0) + movement.puntos);
  }

  const nameByClient = new Map<string, string>();
  for (const client of demoState.clientes) {
    nameByClient.set(client.id, `${client.nombres} ${client.apellidos}`.trim());
  }

  const ranking = [...scoreByClient.entries()]
    .map(([clienteId, puntos]) => ({
      cliente_id: clienteId,
      nombre: nameByClient.get(clienteId) ?? 'Cliente',
      puntos,
    }))
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, limit)
    .map((row, index) => ({
      ...row,
      posicion: index + 1,
    }));

  return ok({
    month: bounds.month,
    ranking,
  });
};

const listConsentimientos = (request: Request) => {
  const session = openSession(request);
  const searchParams = new URL(request.url).searchParams;
  const active = searchParams.get('active');
  const clienteIdQuery = searchParams.get('clienteId');

  let clienteId = clienteIdQuery;
  if (session.role === 'cliente') {
    clienteId = session.cliente?.id ?? null;
    if (!clienteId) return okList([], 0);
  }

  let rows = sortByCreatedDesc(demoState.consentimientos);
  if (clienteId) rows = rows.filter((item) => item.cliente_id === clienteId);
  if (active === 'true') rows = rows.filter((item) => item.activo && item.revocado_en === null);

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createConsentimiento = async (request: Request) => {
  const session = openSession(request);
  const canStaff = hasRole(session.role, PERMISSIONS.nutricion);
  const isClient = session.role === 'cliente';
  if (!canStaff && !isClient) {
    return fail('No tienes permisos para registrar consentimiento.', 403, 'forbidden');
  }

  const body = await parseJsonBody<{
    cliente_id?: string;
    version_texto?: string;
    medio?: string;
    metadata?: Record<string, unknown>;
  }>(request);

  const versionTexto = body.version_texto?.trim();
  if (!versionTexto) return fail('version_texto es obligatorio.', 400);

  const medio = body.medio ?? (isClient ? 'app' : 'staff');
  if (!isConsentimientoMedio(medio)) return fail('medio inválido.', 400);

  const clienteId = isClient ? session.cliente?.id : body.cliente_id ?? session.cliente?.id;
  if (!clienteId) return fail('No se pudo resolver cliente para consentimiento.', 400);

  for (const consent of demoState.consentimientos) {
    if (consent.cliente_id === clienteId && consent.activo && !consent.revocado_en) {
      consent.activo = false;
      consent.revocado_en = nowIso();
      consent.revocado_por = session.userId;
      consent.updated_at = nowIso();
    }
  }

  const stamp = nowIso();
  const consent: DemoConsent = {
    id: nextId('con'),
    gimnasio_id: demoState.gymId,
    cliente_id: clienteId,
    version_texto: versionTexto,
    medio,
    aceptado_por: session.userId,
    activo: true,
    aceptado_en: stamp,
    revocado_en: null,
    revocado_por: null,
    metadata: body.metadata ?? {},
    created_at: stamp,
    updated_at: stamp,
  };

  demoState.consentimientos.unshift(consent);
  return ok(consent, { status: 201 });
};

const listPlanesNutricion = (request: Request) => {
  const session = openSession(request);
  const searchParams = new URL(request.url).searchParams;
  const clienteIdQuery = searchParams.get('clienteId');
  const estado = searchParams.get('estado');

  let clienteId = clienteIdQuery;
  if (session.role === 'cliente') {
    clienteId = session.cliente?.id ?? null;
    if (!clienteId) return okList([], 0);
  }

  let rows = sortByUpdatedDesc(demoState.planesNutricion);
  if (clienteId) rows = rows.filter((item) => item.cliente_id === clienteId);
  if (estado) rows = rows.filter((item) => item.estado === estado);

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createPlanNutricion = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(
    session.role,
    PERMISSIONS.nutricion,
    'No tienes permisos para crear planes nutricionales.'
  );
  if (permissionError) return permissionError;

  const body = await parseJsonBody<{
    cliente_id?: string;
    consentimiento_id?: string | null;
    estado?: string;
    objetivo_general?: string | null;
    notas?: string | null;
    activo_desde?: string | null;
    activo_hasta?: string | null;
    version_inicial?: {
      contenido: Record<string, unknown>;
      notas?: string;
      publicado?: boolean;
    };
  }>(request);

  if (!body.cliente_id) return fail('cliente_id es obligatorio.', 400);

  const estado = body.estado ?? 'borrador';
  if (!isPlanNutricionState(estado)) {
    return fail('estado inválido.', 400);
  }

  let consentimientoId = body.consentimiento_id ?? null;
  if (estado === 'activo' && !consentimientoId) {
    consentimientoId =
      demoState.consentimientos.find(
        (item) => item.cliente_id === body.cliente_id && item.activo && item.revocado_en === null
      )?.id ?? null;
  }

  if (estado === 'activo' && !consentimientoId) {
    return fail('No existe consentimiento vigente para activar plan.', 400, 'consent_required');
  }

  const stamp = nowIso();
  const plan: DemoNutritionPlan = {
    id: nextId('npl'),
    gimnasio_id: demoState.gymId,
    cliente_id: body.cliente_id,
    nutricionista_user_id: session.userId,
    consentimiento_id: consentimientoId,
    estado,
    objetivo_general: body.objetivo_general?.trim() || null,
    notas: body.notas?.trim() || null,
    activo_desde: body.activo_desde ?? null,
    activo_hasta: body.activo_hasta ?? null,
    created_at: stamp,
    updated_at: stamp,
  };

  const version: DemoNutritionPlanVersion = {
    id: nextId('npv'),
    plan_id: plan.id,
    version: 1,
    contenido:
      body.version_inicial?.contenido ?? {
        comidas: [],
        recomendaciones: [],
        habitos: [],
      },
    publicado: body.version_inicial?.publicado ?? estado === 'activo',
    notas: body.version_inicial?.notas?.trim() || null,
    created_by: session.userId,
    created_at: stamp,
  };

  demoState.planesNutricion.unshift(plan);
  demoState.planVersiones.unshift(version);

  return ok(
    {
      plan,
      version,
    },
    { status: 201 }
  );
};

const patchPlanNutricion = async (request: Request, id: string) => {
  const session = openSession(request);
  const permissionError = requireRole(
    session.role,
    PERMISSIONS.nutricion,
    'No tienes permisos para actualizar planes nutricionales.'
  );
  if (permissionError) return permissionError;

  const plan = demoState.planesNutricion.find((item) => item.id === id);
  if (!plan) return fail('Plan no encontrado.', 404);

  const body = await parseJsonBody<{
    consentimiento_id?: string | null;
    estado?: string;
    objetivo_general?: string | null;
    notas?: string | null;
    activo_desde?: string | null;
    activo_hasta?: string | null;
    nueva_version?: {
      contenido: Record<string, unknown>;
      notas?: string;
      publicado?: boolean;
    };
  }>(request);

  if (body.estado !== undefined) {
    if (!isPlanNutricionState(body.estado)) return fail('estado inválido.', 400);

    if (body.estado === 'activo' && !(body.consentimiento_id ?? plan.consentimiento_id)) {
      return fail('No existe consentimiento vigente para activar plan.', 400, 'consent_required');
    }

    plan.estado = body.estado;
  }

  if (body.consentimiento_id !== undefined) plan.consentimiento_id = body.consentimiento_id;
  if (body.objetivo_general !== undefined) plan.objetivo_general = body.objetivo_general?.trim() || null;
  if (body.notas !== undefined) plan.notas = body.notas?.trim() || null;
  if (body.activo_desde !== undefined) plan.activo_desde = body.activo_desde;
  if (body.activo_hasta !== undefined) plan.activo_hasta = body.activo_hasta;
  plan.updated_at = nowIso();

  let nuevaVersion: DemoNutritionPlanVersion | null = null;
  if (body.nueva_version?.contenido) {
    const lastVersion = demoState.planVersiones
      .filter((item) => item.plan_id === id)
      .sort((a, b) => b.version - a.version)[0];

    nuevaVersion = {
      id: nextId('npv'),
      plan_id: id,
      version: (lastVersion?.version ?? 0) + 1,
      contenido: body.nueva_version.contenido,
      publicado: body.nueva_version.publicado ?? false,
      notas: body.nueva_version.notas?.trim() || null,
      created_by: session.userId,
      created_at: nowIso(),
    };

    demoState.planVersiones.unshift(nuevaVersion);
  }

  if (!nuevaVersion &&
      body.consentimiento_id === undefined &&
      body.estado === undefined &&
      body.objetivo_general === undefined &&
      body.notas === undefined &&
      body.activo_desde === undefined &&
      body.activo_hasta === undefined) {
    return fail('No hay cambios para aplicar.', 400);
  }

  return ok({
    plan,
    nuevaVersion,
  });
};

const listMediciones = (request: Request) => {
  const session = openSession(request);
  const searchParams = new URL(request.url).searchParams;
  const clienteIdQuery = searchParams.get('clienteId');

  let clienteId = clienteIdQuery;
  if (session.role === 'cliente') {
    clienteId = session.cliente?.id ?? null;
    if (!clienteId) return okList([], 0);
  }

  let rows = [...demoState.mediciones].sort((a, b) => b.fecha_medicion.localeCompare(a.fecha_medicion));
  if (clienteId) rows = rows.filter((item) => item.cliente_id === clienteId);

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createMedicion = async (request: Request) => {
  const session = openSession(request);
  const canStaff = hasRole(session.role, PERMISSIONS.nutricion);
  const isClient = session.role === 'cliente';
  if (!canStaff && !isClient) {
    return fail('No tienes permisos para registrar mediciones.', 403, 'forbidden');
  }

  const body = await parseJsonBody<{
    cliente_id?: string;
    plan_id?: string | null;
    peso_kg?: number | null;
    grasa_pct?: number | null;
    perimetros?: Record<string, number> | null;
    adherencia_pct?: number | null;
    notas?: string | null;
    fecha_medicion?: string | null;
  }>(request);

  const clienteId = isClient ? session.cliente?.id : body.cliente_id ?? session.cliente?.id;
  if (!clienteId) return fail('No se pudo resolver el cliente para la medición.', 400);

  if (body.adherencia_pct !== undefined && body.adherencia_pct !== null) {
    const adherencia = Number(body.adherencia_pct);
    if (!Number.isFinite(adherencia) || adherencia < 0 || adherencia > 100) {
      return fail('adherencia_pct debe estar entre 0 y 100.', 400);
    }
  }

  const medicion: DemoMedicion = {
    id: nextId('med'),
    gimnasio_id: demoState.gymId,
    cliente_id: clienteId,
    plan_id: body.plan_id ?? null,
    peso_kg: body.peso_kg ?? null,
    grasa_pct: body.grasa_pct ?? null,
    perimetros: body.perimetros ?? null,
    adherencia_pct: body.adherencia_pct ?? null,
    notas: body.notas?.trim() || null,
    fecha_medicion: body.fecha_medicion ?? todayDate(),
    registrado_por: session.userId,
    created_at: nowIso(),
  };

  demoState.mediciones.unshift(medicion);
  return ok(medicion, { status: 201 });
};

const listMembresias = (request: Request) => {
  const session = openSession(request);
  const searchParams = new URL(request.url).searchParams;
  const clienteIdQuery = searchParams.get('clienteId');

  let clienteId = clienteIdQuery;
  if (session.role === 'cliente') {
    clienteId = session.cliente?.id ?? null;
    if (!clienteId) return okList([], 0);
  }

  let rows = sortByCreatedDesc(demoState.membresias);
  if (clienteId) rows = rows.filter((item) => item.cliente_id === clienteId);

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createMembresia = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.membresias, 'No tienes permisos para crear membresías.');
  if (permissionError) return permissionError;

  const body = await parseJsonBody<{
    cliente_id?: string;
    plan_id?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    estado?: DemoMembresia['estado'];
  }>(request);

  if (!body.cliente_id || !body.plan_id || !body.fecha_inicio || !body.fecha_fin) {
    return fail('cliente_id, plan_id, fecha_inicio y fecha_fin son obligatorios.', 400);
  }

  const stamp = nowIso();
  const memb: DemoMembresia = {
    id: nextId('mem'),
    gimnasio_id: demoState.gymId,
    cliente_id: body.cliente_id,
    plan_id: body.plan_id,
    estado: body.estado ?? 'activa',
    fecha_inicio: body.fecha_inicio,
    fecha_fin: body.fecha_fin,
    renovacion_automatica: false,
    observaciones: null,
    created_at: stamp,
    updated_at: stamp,
  };

  demoState.membresias.unshift(memb);
  return ok(memb, { status: 201 });
};

const listPagos = (request: Request) => {
  const session = openSession(request);
  const searchParams = new URL(request.url).searchParams;
  const clienteIdQuery = searchParams.get('clienteId');
  const estado = searchParams.get('estado') as PaymentState | null;

  let clienteId = clienteIdQuery;
  if (session.role === 'cliente') {
    clienteId = session.cliente?.id ?? null;
    if (!clienteId) return okList([], 0);
  }

  let rows = [...demoState.pagos].sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago));
  if (clienteId) rows = rows.filter((item) => item.cliente_id === clienteId);
  if (estado) rows = rows.filter((item) => item.estado === estado);

  const { data, count } = paginate(rows, searchParams);
  return okList(data, count);
};

const createPago = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(session.role, PERMISSIONS.pagos, 'No tienes permisos para registrar pagos.');
  if (permissionError) return permissionError;

  const body = await parseJsonBody<{
    cliente_id?: string;
    membresia_id?: string | null;
    monto?: number;
    canje_id?: string | null;
    moneda?: string;
    estado?: PaymentState;
    metodo?: string;
    referencia?: string | null;
    fecha_pago?: string;
    notas?: string | null;
  }>(request);

  if (!body.cliente_id) return fail('cliente_id es obligatorio.', 400);
  const montoBase = Number(body.monto ?? 0);
  if (!Number.isFinite(montoBase) || montoBase < 0) return fail('monto debe ser mayor o igual a 0.', 400);

  let descuentoCanje = 0;
  let canje: DemoCanje | null = null;

  if (body.canje_id) {
    canje = demoState.canjes.find((item) => item.id === body.canje_id) ?? null;
    if (!canje) return fail('Canje inválido.', 400);
    if (canje.cliente_id !== body.cliente_id) return fail('El canje no pertenece al cliente del pago.', 400);

    const existingPaymentId = typeof canje.metadata.pago_id === 'string' ? String(canje.metadata.pago_id) : null;
    if (canje.estado === 'entregado' && existingPaymentId) {
      return fail('El canje ya fue aplicado a un pago.', 409, 'canje_already_applied', {
        canje_id: canje.id,
        pago_id: existingPaymentId,
      });
    }

    if (canje.estado !== 'aprobado') {
      return fail('Solo se pueden aplicar canjes aprobados.', 400, 'invalid_canje_state', {
        canje_id: canje.id,
        estado: canje.estado,
      });
    }

    const premio = demoState.premios.find((item) => item.id === canje?.premio_id);
    if (!premio) return fail('No se pudo validar premio de canje.', 400);
    if (premio.tipo !== 'descuento_pago') return fail('El canje seleccionado no aplica descuento monetario.', 400);

    descuentoCanje = Number(canje.credito_monto ?? 0);
    if (!Number.isFinite(descuentoCanje) || descuentoCanje <= 0) {
      return fail('El canje no tiene crédito monetario aplicable.', 400);
    }
  }

  const montoFinal = Math.max(Number((montoBase - descuentoCanje).toFixed(2)), 0);
  const stamp = nowIso();

  const pago: DemoPago = {
    id: nextId('pay'),
    gimnasio_id: demoState.gymId,
    cliente_id: body.cliente_id,
    membresia_id: body.membresia_id ?? null,
    monto: montoFinal,
    moneda: body.moneda ?? 'UYU',
    estado: body.estado ?? 'registrado',
    metodo: body.metodo?.trim() || 'manual',
    referencia: body.referencia?.trim() || null,
    fecha_pago: body.fecha_pago ?? stamp,
    registrado_por: session.userId,
    notas:
      body.notas?.trim() || descuentoCanje > 0
        ? [body.notas?.trim(), descuentoCanje > 0 ? `Canje aplicado: -${descuentoCanje} UYU` : null]
            .filter(Boolean)
            .join(' | ')
        : null,
    created_at: stamp,
    updated_at: stamp,
  };

  demoState.pagos.unshift(pago);

  if (canje) {
    canje.estado = 'entregado';
    canje.resuelto_por = session.userId;
    canje.entregado_en = stamp;
    canje.updated_at = stamp;
    canje.metadata = {
      ...canje.metadata,
      pago_id: pago.id,
      pago_estado: pago.estado,
      aplicado_en: stamp,
      descuento_aplicado: descuentoCanje,
    };
  }

  return ok(pago, { status: 201 });
};

const listWhatsappQueue = () => {
  return ok({
    data: sortByCreatedDesc(demoState.whatsappQueue).slice(0, 50),
  });
};

const enqueueWhatsapp = async (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(
    session.role,
    PERMISSIONS.notificaciones,
    'No tienes permisos para enviar notificaciones de WhatsApp.'
  );
  if (permissionError) return permissionError;

  const body = await parseJsonBody<{
    to?: string;
    template?: string;
    message?: string;
    context?: Record<string, unknown>;
    scheduleAt?: string;
  }>(request);

  if (!body.to?.trim() || !body.message?.trim()) {
    return fail('to y message son obligatorios.', 400);
  }

  const scheduleAt = body.scheduleAt ? new Date(body.scheduleAt) : null;
  if (scheduleAt && Number.isNaN(scheduleAt.getTime())) {
    return fail('scheduleAt inválido.', 400);
  }

  const stamp = nowIso();
  const notification: DemoWhatsappQueue = {
    id: nextId('wsp'),
    gimnasio_id: demoState.gymId,
    to_phone: body.to.trim(),
    template: body.template ?? null,
    message: body.message.trim(),
    context: body.context ?? {},
    estado: scheduleAt ? 'pendiente' : 'enviado',
    intentos: 1,
    max_intentos: 3,
    next_retry_at: scheduleAt ? scheduleAt.toISOString() : stamp,
    ultimo_error: null,
    provider_ref: JSON.stringify({ provider: 'demo', sent: !scheduleAt }),
    created_by: session.userId,
    created_at: stamp,
    updated_at: stamp,
  };

  demoState.whatsappQueue.unshift(notification);

  return ok({
    queued: true,
    sent: !scheduleAt,
    provider: 'demo',
    reason: scheduleAt ? 'scheduled' : null,
    notification,
  });
};

const processWhatsappQueue = (request: Request) => {
  const session = openSession(request);
  const permissionError = requireRole(
    session.role,
    PERMISSIONS.notificaciones,
    'No tienes permisos para procesar cola WhatsApp.'
  );
  if (permissionError) return permissionError;

  const now = nowIso();
  const pending = demoState.whatsappQueue.filter(
    (item) => item.estado === 'pendiente' && item.next_retry_at <= now
  );

  const processed = pending.map((item) => {
    item.estado = 'enviado';
    item.intentos += 1;
    item.updated_at = nowIso();
    item.provider_ref = JSON.stringify({ provider: 'demo', processed_at: item.updated_at });

    return {
      id: item.id,
      sent: true,
      estado: item.estado,
      reason: null,
    };
  });

  return ok({
    processed,
    count: processed.length,
  });
};

const retencionMetric = () => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

  const activeAtStart = demoState.membresias.filter(
    (item) => item.fecha_inicio <= monthStart && item.fecha_fin >= monthStart
  ).length;

  const activeAtEnd = demoState.membresias.filter(
    (item) => item.fecha_inicio <= monthEnd && item.fecha_fin >= monthEnd
  ).length;

  return ok({
    month: monthStart.slice(0, 7),
    activeAtStart,
    activeAtEnd,
    retencionMensual: calculateRetentionRate(activeAtStart, activeAtEnd),
  });
};

const listRetos = (request: Request) => {
  const rows = sortByCreatedDesc(demoState.retos);
  const { data, count } = paginate(rows, new URL(request.url).searchParams);
  return okList(data, count);
};

const dispatch = async (request: Request, method: string, path: string[]) => {
  if (getGymcrmDataMode() !== 'demo') {
    return fail('Demo router deshabilitado para este entorno.', 404, 'demo_disabled');
  }

  const [segment0, segment1, segment2] = path;

  if (!segment0) {
    return ok({
      message: 'GymCRM open demo router activo.',
      mode: 'demo',
    });
  }

  if (segment0 === 'health' && method === 'GET') return healthResponse();
  if (segment0 === 'me' && method === 'GET') return meResponse(request);
  if (segment0 === 'bootstrap' && (method === 'GET' || method === 'POST')) return bootstrapResponse(request);
  if (segment0 === 'dashboard' && method === 'GET') return dashboardResponse();

  if (segment0 === 'clientes') {
    if (path.length === 1 && method === 'GET') return listClientes(request);
    if (path.length === 1 && method === 'POST') return createCliente(request);
    if (path.length === 2 && method === 'PATCH') return patchCliente(request, segment1);
    if (path.length === 2 && method === 'DELETE') return deactivateCliente(request, segment1);
  }

  if (segment0 === 'clases') {
    if (path.length === 1 && method === 'GET') return listClases(request);
    if (path.length === 1 && method === 'POST') return createClase(request);
    if (segment1 === 'horarios' && path.length === 2 && method === 'GET') return listHorarios(request);
    if (segment1 === 'horarios' && path.length === 2 && method === 'POST') return createHorario(request);
    if (segment1 === 'horarios' && path.length === 3 && method === 'PATCH') return patchHorario(request, segment2);
    if (segment1 === 'horarios' && path.length === 3 && method === 'DELETE') return cancelHorario(request, segment2);
    if (path.length === 2 && method === 'PATCH') return patchClase(request, segment1);
    if (path.length === 2 && method === 'DELETE') return pauseClase(request, segment1);
  }

  if (segment0 === 'reservas') {
    if (path.length === 1 && method === 'GET') return listReservasClase(request);
    if (path.length === 1 && method === 'POST') return createReservaClase(request);
    if (path.length === 2 && method === 'PATCH') return patchReservaClase(request, segment1);
  }

  if (segment0 === 'builder') {
    if (segment1 === 'plantillas' && path.length === 2 && method === 'GET') return listBuilderTemplatesRoute();
    if (segment1 === 'servicios' && path.length === 2 && method === 'GET') return listBuilderServices(request);
    if (segment1 === 'servicios' && path.length === 2 && method === 'POST') return createBuilderService(request);
    if (segment1 === 'servicios' && path.length === 3 && method === 'PATCH') return patchBuilderService(request, segment2);
    if (segment1 === 'sesiones' && path.length === 2 && method === 'GET') return listBuilderSessions(request);
    if (segment1 === 'sesiones' && path.length === 2 && method === 'POST') return createBuilderSession(request);
    if (segment1 === 'reservas' && path.length === 2 && method === 'GET') return listBuilderReservations(request);
    if (segment1 === 'reservas' && path.length === 2 && method === 'POST') return createBuilderReservation(request);
    if (segment1 === 'reservas' && path.length === 3 && method === 'PATCH') return patchBuilderReservation(request, segment2);
  }

  if (segment0 === 'comunidad') {
    if (segment1 === 'puntos' && path.length === 2 && method === 'GET') return listPuntos(request);
    if (segment1 === 'puntos' && path.length === 2 && method === 'POST') return createPuntos(request);
    if (segment1 === 'premios' && path.length === 2 && method === 'GET') return listPremios(request);
    if (segment1 === 'premios' && path.length === 2 && method === 'POST') return createPremio(request);
    if (segment1 === 'canjes' && path.length === 2 && method === 'GET') return listCanjes(request);
    if (segment1 === 'canjes' && path.length === 2 && method === 'POST') return createCanje(request);
    if (segment1 === 'canjes' && path.length === 3 && method === 'PATCH') return patchCanje(request, segment2);
    if (segment1 === 'ranking' && path.length === 2 && method === 'GET') return rankingResponse(request);
    if (segment1 === 'retos' && path.length === 2 && method === 'GET') return listRetos(request);
  }

  if (segment0 === 'nutricion') {
    if (segment1 === 'consentimientos' && path.length === 2 && method === 'GET') return listConsentimientos(request);
    if (segment1 === 'consentimientos' && path.length === 2 && method === 'POST') return createConsentimiento(request);
    if (segment1 === 'planes' && path.length === 2 && method === 'GET') return listPlanesNutricion(request);
    if (segment1 === 'planes' && path.length === 2 && method === 'POST') return createPlanNutricion(request);
    if (segment1 === 'planes' && path.length === 3 && method === 'PATCH') return patchPlanNutricion(request, segment2);
    if (segment1 === 'mediciones' && path.length === 2 && method === 'GET') return listMediciones(request);
    if (segment1 === 'mediciones' && path.length === 2 && method === 'POST') return createMedicion(request);
  }

  if (segment0 === 'membresias') {
    if (path.length === 1 && method === 'GET') return listMembresias(request);
    if (path.length === 1 && method === 'POST') return createMembresia(request);
  }

  if (segment0 === 'pagos') {
    if (path.length === 1 && method === 'GET') return listPagos(request);
    if (path.length === 1 && method === 'POST') return createPago(request);
  }

  if (segment0 === 'notificaciones' && segment1 === 'whatsapp') {
    if (path.length === 2 && method === 'GET') return listWhatsappQueue();
    if (path.length === 2 && method === 'POST') return enqueueWhatsapp(request);
    if (path.length === 2 && method === 'PUT') return processWhatsappQueue(request);
  }

  if (segment0 === 'metricas' && segment1 === 'retencion' && method === 'GET') {
    return retencionMetric();
  }

  return fail(`Ruta demo no implementada: ${method} /api/gymcrm_open/${path.join('/')}`, 404, 'not_found');
};

const run = async (request: Request, context: RouteContext) => {
  syncDemoState();
  const { path = [] } = await context.params;
  const response = await dispatch(request, request.method, path);

  if (request.method !== 'GET' && response.ok) {
    saveDemoState();
  }

  return response;
};

export async function GET(request: Request, context: RouteContext) {
  return run(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return run(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return run(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return run(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return run(request, context);
}
