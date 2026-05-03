import type { SyncStatus } from '../types';
import { useAuthStore } from '../store/useAuthStore';

type TenantScopedRecord = {
  tenantId?: string | null;
  syncStatus?: SyncStatus;
};

const RECOVERABLE_STATUSES: SyncStatus[] = ['pending', 'syncing', 'failed', 'conflict'];

export function getActiveTenantId(): string | undefined {
  return useAuthStore.getState().tenantInfo?.tenantId;
}

export function isRecoverableWithoutTenant(record: TenantScopedRecord): boolean {
  return !record.tenantId && !!record.syncStatus && RECOVERABLE_STATUSES.includes(record.syncStatus);
}

export function belongsToActiveTenant<T extends TenantScopedRecord>(record: T | null | undefined): record is T {
  if (!record) return false;

  const tenantId = getActiveTenantId();
  if (!tenantId) return true;

  if (record.tenantId === tenantId) return true;

  // Keep local work visible when tenantInfo was missing at write time.
  // Those records need to be recoverable instead of silently disappearing.
  return isRecoverableWithoutTenant(record);
}

export function filterByActiveTenant<T extends TenantScopedRecord>(records: T[]): T[] {
  return records.filter(belongsToActiveTenant);
}
