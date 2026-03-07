import type { MembershipState, ReservationState } from '@/lib/gymcrm/types';

export const resolveMembershipState = (
  currentState: MembershipState,
  fechaFin: string,
  now = new Date()
): MembershipState => {
  if (currentState === 'cancelada' || currentState === 'suspendida') {
    return currentState;
  }

  const endDate = new Date(`${fechaFin}T23:59:59.999Z`);
  return endDate < now ? 'vencida' : 'activa';
};

export const resolveReservationStateByCapacity = (
  requestedState: ReservationState,
  confirmedCount: number,
  capacity: number
): ReservationState => {
  if (requestedState !== 'confirmada') {
    return requestedState;
  }

  if (confirmedCount >= capacity) {
    return 'espera';
  }

  return 'confirmada';
};

export const canCancelReservation = (startDateISO: string, now = new Date(), minMinutes = 30): boolean => {
  const startDate = new Date(startDateISO);
  const diffMs = startDate.getTime() - now.getTime();
  return diffMs >= minMinutes * 60 * 1000;
};

export const calculateRetentionRate = (activeAtStart: number, activeAtEnd: number): number => {
  if (activeAtStart <= 0) {
    return 100;
  }

  const ratio = (activeAtEnd / activeAtStart) * 100;
  return Number(ratio.toFixed(2));
};

export const calculatePointsBalance = (movements: Array<{ puntos: number }>): number => {
  return movements.reduce((sum, item) => sum + Number(item.puntos ?? 0), 0);
};

export const canRedeemPoints = (balance: number, pointsCost: number): boolean => {
  if (!Number.isFinite(balance) || !Number.isFinite(pointsCost)) {
    return false;
  }

  return pointsCost > 0 && balance >= pointsCost;
};

export const calculateDiscountFromPoints = (pointsCost: number, ratioUYUPerPoint = 1): number => {
  if (pointsCost <= 0 || ratioUYUPerPoint <= 0) return 0;
  return Number((pointsCost * ratioUYUPerPoint).toFixed(2));
};

export const isConsentActive = (activo: boolean, revocadoEn: string | null): boolean => {
  return activo && !revocadoEn;
};
