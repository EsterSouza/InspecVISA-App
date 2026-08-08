import { supabase } from '../lib/supabase';
import { getActiveTenantId } from '../utils/localScope';
import { getLocalActor } from '../utils/localActor';
import type {
  ClientPortalSettings,
  ServiceRequest,
  ServiceRequestEvent,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '../types';

/**
 * P360-012 — lado da equipe.
 *
 * Leitura é `select` direto, protegido por RLS: o painel filtra, ordena e conta em cima da
 * mesma lista. Escrita é sempre RPC — o staff não tem `insert`/`update` na tabela, para que
 * carimbo de tempo, histórico e a regra de papel fiquem num lugar só, no Postgres.
 */

const ATTACHMENT_URL_SECONDS = 3600;

export interface ServiceRequestFilters {
  status?: ServiceRequestStatus[];
  clientId?: string | null;
  assignedTo?: string | null;
  priority?: ServiceRequestPriority | null;
  /** Texto livre: bate com assunto ou número. */
  search?: string;
}

export interface ServiceRequestUpdate {
  status?: ServiceRequestStatus;
  priority?: ServiceRequestPriority;
  assignedTo?: string | null;
  note?: string;
  /** Nota interna é o default. Marcar aqui é o gesto explícito de falar com o cliente. */
  noteVisibleToClient?: boolean;
}

export const ServiceRequestService = {
  async list(filters: ServiceRequestFilters = {}): Promise<ServiceRequest[]> {
    const tenantId = getActiveTenantId();
    let query = supabase
      .from('client_service_requests')
      .select('*')
      .order('last_event_at', { ascending: false });

    if (tenantId) query = query.eq('tenant_id', tenantId);
    if (filters.status?.length) query = query.in('status', filters.status);
    if (filters.clientId) query = query.eq('client_id', filters.clientId);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

    const search = filters.search?.trim();
    if (search) {
      const asNumber = Number(search.replace(/\D/g, ''));
      query = Number.isFinite(asNumber) && asNumber > 0
        ? query.or(`subject.ilike.%${search}%,request_number.eq.${asNumber}`)
        : query.ilike('subject', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ServiceRequest[];
  },

  async events(requestId: string): Promise<ServiceRequestEvent[]> {
    const { data, error } = await supabase
      .from('client_service_request_events')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as ServiceRequestEvent[];
  },

  /**
   * Status, prioridade, responsável e nota num gesto só — é assim que a decisão acontece
   * ("assumo, é urgente, e vou perguntar tal coisa"), e é uma linha só de histórico.
   */
  async update(requestId: string, changes: ServiceRequestUpdate): Promise<{ waitingOn: string }> {
    const { data, error } = await supabase.rpc('admin_update_service_request', {
      p_id: requestId,
      p_status: changes.status ?? null,
      p_priority: changes.priority ?? null,
      p_assigned_to: changes.assignedTo === undefined ? null : (changes.assignedTo ?? ''),
      p_note: changes.note?.trim() || null,
      p_note_visible: !!changes.noteVisibleToClient,
      p_actor_name: getLocalActor().name || null,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { waitingOn: data?.waiting_on as string };
  },

  /**
   * Aviso ao cliente. Só faz sentido quando a solicitação passou a aguardar resposta dele ou
   * foi concluída; a Edge Function recusa o resto. Falhar aqui não desfaz a mudança.
   */
  async notifyClient(requestId: string): Promise<{ whatsappLink?: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('notify-service-request', {
        body: { requestId, portalUrl: `${window.location.origin}/cliente` },
      });
      if (error) throw error;
      return data as { whatsappLink?: string };
    } catch (err) {
      console.warn('[ServiceRequest] Falha ao avisar o cliente:', err);
      return null;
    }
  },

  /**
   * URL temporária do anexo, assinada a cada clique. A policy do bucket restringe a assinatura
   * ao staff do tenant dono do caminho — o arquivo nunca fica público.
   */
  async attachmentUrl(request: Pick<ServiceRequest, 'attachment_bucket' | 'attachment_path'>): Promise<string> {
    if (!request.attachment_bucket || !request.attachment_path) {
      throw new Error('Esta solicitação não tem anexo.');
    }
    const { data, error } = await supabase.storage
      .from(request.attachment_bucket)
      .createSignedUrl(request.attachment_path, ATTACHMENT_URL_SECONDS);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error('Nao foi possivel abrir o arquivo agora.');
    return data.signedUrl;
  },

  /**
   * Prazo informativo por categoria. Salvar `{}` volta ao estado em que o portal não fala em
   * prazo nenhum — que é o default e a posição segura.
   */
  async saveSla(sla: ClientPortalSettings['service_request_sla']): Promise<void> {
    const tenantId = getActiveTenantId();
    if (!tenantId) throw new Error('Sem tenant ativo para salvar o prazo.');
    const { data, error } = await supabase.rpc('admin_set_service_request_sla', {
      p_tenant_id: tenantId,
      p_sla: sla || {},
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },
};
