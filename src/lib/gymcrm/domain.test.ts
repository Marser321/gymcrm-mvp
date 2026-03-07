import { describe, expect, it } from 'vitest';
import {
  calculateDiscountFromPoints,
  calculatePointsBalance,
  calculateRetentionRate,
  canRedeemPoints,
  canCancelReservation,
  isConsentActive,
  resolveMembershipState,
  resolveReservationStateByCapacity,
} from '@/lib/gymcrm/domain';

describe('gymcrm domain rules', () => {
  it('marks membership as vencida when end date is in the past', () => {
    const state = resolveMembershipState('activa', '2020-01-01', new Date('2026-03-06T00:00:00.000Z'));
    expect(state).toBe('vencida');
  });

  it('keeps suspended membership state as suspended', () => {
    const state = resolveMembershipState('suspendida', '2026-12-31', new Date('2026-03-06T00:00:00.000Z'));
    expect(state).toBe('suspendida');
  });

  it('moves reservation to waitlist when capacity is full', () => {
    const state = resolveReservationStateByCapacity('confirmada', 20, 20);
    expect(state).toBe('espera');
  });

  it('allows cancellation with at least 30 minutes in advance', () => {
    const canCancel = canCancelReservation(
      '2026-03-06T18:00:00.000Z',
      new Date('2026-03-06T17:20:00.000Z'),
      30
    );
    expect(canCancel).toBe(true);
  });

  it('blocks cancellation when less than 30 minutes remain', () => {
    const canCancel = canCancelReservation(
      '2026-03-06T18:00:00.000Z',
      new Date('2026-03-06T17:45:00.000Z'),
      30
    );
    expect(canCancel).toBe(false);
  });

  it('calculates retention percentage with two decimals', () => {
    const retention = calculateRetentionRate(120, 132);
    expect(retention).toBe(110);
  });

  it('returns 100 retention when baseline is zero', () => {
    const retention = calculateRetentionRate(0, 0);
    expect(retention).toBe(100);
  });

  it('computes points balance by summing positive and negative movements', () => {
    const balance = calculatePointsBalance([{ puntos: 50 }, { puntos: -20 }, { puntos: 15 }]);
    expect(balance).toBe(45);
  });

  it('allows redeem only when balance covers cost', () => {
    expect(canRedeemPoints(100, 70)).toBe(true);
    expect(canRedeemPoints(60, 70)).toBe(false);
  });

  it('calculates discount in UYU from points cost', () => {
    expect(calculateDiscountFromPoints(250, 0.5)).toBe(125);
    expect(calculateDiscountFromPoints(0, 1)).toBe(0);
  });

  it('considers consent active when not revoked', () => {
    expect(isConsentActive(true, null)).toBe(true);
    expect(isConsentActive(true, '2026-03-06T12:00:00.000Z')).toBe(false);
  });
});
