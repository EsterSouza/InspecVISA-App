import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';

const PROFILE_EMAILS: Record<string, string> = {
  'Ana Roberta Ribeiro': 'nutrianarr@gmail.com',
  'Ester Caiafa': 'esterposte@hotmail.com'
};

export interface LocalActor {
  id: string;
  name: string;
  email?: string;
  authEmail?: string;
  isSharedAccount: boolean;
}

export function getLocalActor(): LocalActor {
  const settings = useSettingsStore.getState().settings;
  const { user, tenantInfo } = useAuthStore.getState();

  const name = settings.name || tenantInfo?.email || user?.email || 'Consultor';
  const profileEmail = PROFILE_EMAILS[settings.name];
  const authEmail = tenantInfo?.email || user?.email || undefined;
  const email = profileEmail || authEmail;

  return {
    id: profileEmail ? `profile:${profileEmail}` : authEmail ? `auth:${authEmail}` : `profile:${name}`,
    name,
    email,
    authEmail,
    isSharedAccount: Boolean(profileEmail && authEmail && profileEmail !== authEmail)
  };
}

export function withLocalActor<T extends { localActorId?: string }>(record: T): T {
  const actor = getLocalActor();
  return {
    ...record,
    localActorId: record.localActorId || actor.id
  };
}
