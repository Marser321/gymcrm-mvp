import type { GymRole } from '@/lib/gymcrm/types';

export const ROLE_PRIORITY: Record<GymRole, number> = {
  admin: 100,
  recepcion: 80,
  entrenador: 70,
  nutricionista: 70,
  cliente: 10,
};

export const PERMISSIONS = {
  clientes: ['admin', 'recepcion', 'entrenador'] as GymRole[],
  membresias: ['admin', 'recepcion'] as GymRole[],
  pagos: ['admin', 'recepcion'] as GymRole[],
  clases: ['admin', 'recepcion', 'entrenador'] as GymRole[],
  reservasStaff: ['admin', 'recepcion', 'entrenador'] as GymRole[],
  checkins: ['admin', 'recepcion', 'entrenador'] as GymRole[],
  nutricion: ['admin', 'nutricionista'] as GymRole[],
  nutricionSeguimientoCliente: ['cliente'] as GymRole[],
  builder: ['admin'] as GymRole[],
  builderRuntimeStaff: ['admin', 'recepcion', 'entrenador'] as GymRole[],
  comunidad: ['admin', 'recepcion', 'entrenador'] as GymRole[],
  comunidadPremios: ['admin', 'recepcion'] as GymRole[],
  comunidadCanjesStaff: ['admin', 'recepcion', 'entrenador'] as GymRole[],
  eventos: ['admin', 'recepcion'] as GymRole[],
  notificaciones: ['admin', 'recepcion'] as GymRole[],
  auditoria: ['admin'] as GymRole[],
} as const;

export const hasRole = (currentRole: GymRole, allowed: readonly GymRole[]): boolean => {
  return allowed.includes(currentRole);
};

export const canManageStaff = (currentRole: GymRole): boolean => {
  return currentRole === 'admin';
};

export const canManageAsStaff = (currentRole: GymRole): boolean => {
  return currentRole === 'admin' || currentRole === 'recepcion' || currentRole === 'entrenador';
};

export const canAccessAdmin = (currentRole: GymRole): boolean => {
  return currentRole !== 'cliente';
};
