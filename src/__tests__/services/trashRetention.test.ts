import { describe, expect, it } from 'vitest';
import { getTrashDaysRemaining, isTrashExpired } from '../../utils/trashRetention';

describe('trash retention', () => {
  const deletedAt = new Date('2026-04-01T12:00:00.000Z');

  it('keeps a deleted report restorable before 30 days', () => {
    const now = new Date('2026-04-30T12:00:00.000Z');

    expect(isTrashExpired(deletedAt, now)).toBe(false);
    expect(getTrashDaysRemaining(deletedAt, now)).toBe(1);
  });

  it('expires a deleted report after the 30-day retention period', () => {
    const now = new Date('2026-05-01T12:00:00.000Z');

    expect(isTrashExpired(deletedAt, now)).toBe(true);
    expect(getTrashDaysRemaining(deletedAt, now)).toBe(0);
  });
});
