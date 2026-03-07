export const GYM_ROLES = ['admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista'] as const;
export type GymRole = (typeof GYM_ROLES)[number];

export const MEMBERSHIP_STATES = ['activa', 'vencida', 'suspendida', 'cancelada'] as const;
export type MembershipState = (typeof MEMBERSHIP_STATES)[number];

export const PAYMENT_STATES = ['pendiente', 'registrado', 'anulado'] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const RESERVATION_STATES = ['confirmada', 'espera', 'cancelada', 'asistio', 'ausente'] as const;
export type ReservationState = (typeof RESERVATION_STATES)[number];

export const BUILDER_SESSION_STATES = ['programada', 'cancelada', 'finalizada'] as const;
export type BuilderSessionState = (typeof BUILDER_SESSION_STATES)[number];

export const CANJE_STATES = ['solicitado', 'aprobado', 'rechazado', 'entregado', 'anulado'] as const;
export type CanjeState = (typeof CANJE_STATES)[number];

export const PREMIO_TIPOS = ['descuento_pago', 'pase_servicio'] as const;
export type PremioTipo = (typeof PREMIO_TIPOS)[number];

export const PLAN_NUTRICION_STATES = ['borrador', 'activo', 'sustituido', 'cerrado'] as const;
export type PlanNutricionState = (typeof PLAN_NUTRICION_STATES)[number];

export const CONSENTIMIENTO_MEDIOS = ['app', 'staff'] as const;
export type ConsentimientoMedio = (typeof CONSENTIMIENTO_MEDIOS)[number];

export type GymContext = {
  gimnasioId: string;
  role: GymRole;
  userId: string;
};

export type UsuarioRol = {
  id: string;
  gimnasio_id: string;
  user_id: string;
  email: string | null;
  rol: GymRole;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Cliente = {
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

export type PlanMembresia = {
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

export type Membresia = {
  id: string;
  gimnasio_id: string;
  cliente_id: string;
  plan_id: string;
  estado: MembershipState;
  fecha_inicio: string;
  fecha_fin: string;
  renovacion_automatica: boolean;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
};

export type Pago = {
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

export type ClaseBase = {
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

export type ClaseHorario = {
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

export type ReservaClase = {
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

export type Checkin = {
  id: string;
  gimnasio_id: string;
  cliente_id: string;
  sede_id: string | null;
  horario_id: string | null;
  metodo: 'qr' | 'manual';
  registrado_por: string | null;
  created_at: string;
};

export type DashboardKPI = {
  totalClientesActivos: number;
  membresiasActivas: number;
  pagosMes: number;
  retencionMensual: number;
  reservasConfirmadasHoy: number;
  adopcionServiciosDinamicos: number;
  tasaCanje: number;
  participacionRetos: number;
  adherenciaNutricional: number;
};

export type Pagination = {
  page?: number;
  pageSize?: number;
};

export type ApiListResponse<T> = {
  data: T[];
  count?: number;
};

export type ApiItemResponse<T> = {
  data: T;
};

export const isGymRole = (value: string): value is GymRole => {
  return (GYM_ROLES as readonly string[]).includes(value);
};

export const isMembershipState = (value: string): value is MembershipState => {
  return (MEMBERSHIP_STATES as readonly string[]).includes(value);
};

export const isPaymentState = (value: string): value is PaymentState => {
  return (PAYMENT_STATES as readonly string[]).includes(value);
};

export const isReservationState = (value: string): value is ReservationState => {
  return (RESERVATION_STATES as readonly string[]).includes(value);
};

export const isBuilderSessionState = (value: string): value is BuilderSessionState => {
  return (BUILDER_SESSION_STATES as readonly string[]).includes(value);
};

export const isCanjeState = (value: string): value is CanjeState => {
  return (CANJE_STATES as readonly string[]).includes(value);
};

export const isPremioTipo = (value: string): value is PremioTipo => {
  return (PREMIO_TIPOS as readonly string[]).includes(value);
};

export const isPlanNutricionState = (value: string): value is PlanNutricionState => {
  return (PLAN_NUTRICION_STATES as readonly string[]).includes(value);
};

export const isConsentimientoMedio = (value: string): value is ConsentimientoMedio => {
  return (CONSENTIMIENTO_MEDIOS as readonly string[]).includes(value);
};
