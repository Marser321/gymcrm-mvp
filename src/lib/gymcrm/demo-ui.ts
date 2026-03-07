import type { OpenRole } from '@/lib/gymcrm/open-session';

export type UIActionState = 'idle' | 'loading' | 'success' | 'error';

export type PortalAccessIntent = {
  route: string;
  requiredRoles: OpenRole[];
  recommendedRole: OpenRole;
  ctaLabel: string;
};

export type ActionAvailability = {
  actionId: string;
  implemented: boolean;
  roadmapTitle: string;
  etaLabel: string;
  owner: string;
  route: string;
  description: string;
};

const ACTION_REGISTRY: Record<string, ActionAvailability> = {
  admin_payments_center: {
    actionId: 'admin_payments_center',
    implemented: false,
    roadmapTitle: 'Centro unificado de cobros y membresias',
    etaLabel: 'Fase MVP+1',
    owner: 'Equipo Operaciones CRM',
    route: '/admin',
    description:
      'Concentrara ajustes de membresias, conciliacion manual y reportes de cobro en una vista unica para staff.',
  },
};

export const getActionAvailability = (actionId: string): ActionAvailability => {
  return (
    ACTION_REGISTRY[actionId] ?? {
      actionId,
      implemented: true,
      roadmapTitle: 'Accion implementada',
      etaLabel: 'Disponible',
      owner: 'GymCRM',
      route: '/',
      description: 'Esta accion ya cuenta con flujo funcional.',
    }
  );
};
