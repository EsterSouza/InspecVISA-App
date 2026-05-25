const DAY_MS = 24 * 60 * 60 * 1000;

export const TRASH_RETENTION_DAYS = 30;

export function getTrashExpirationDate(deletedAt: Date, retentionDays = TRASH_RETENTION_DAYS): Date {
  return new Date(deletedAt.getTime() + retentionDays * DAY_MS);
}

export function isTrashExpired(deletedAt: Date, now = new Date(), retentionDays = TRASH_RETENTION_DAYS): boolean {
  return getTrashExpirationDate(deletedAt, retentionDays).getTime() <= now.getTime();
}

export function getTrashDaysRemaining(deletedAt: Date, now = new Date(), retentionDays = TRASH_RETENTION_DAYS): number {
  const remainingMs = getTrashExpirationDate(deletedAt, retentionDays).getTime() - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / DAY_MS));
}
