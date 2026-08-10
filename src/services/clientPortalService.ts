import { supabase } from '../lib/supabase';
import { formatAppointmentLeadTimeMessage, isAppointmentAtLeast24hAhead } from '../utils/appointmentLeadTime';
import type {
  AppointmentType,
  AppointmentAttachment,
  ClientActionEvidenceStatus,
  ClientActionItemPriority,
  ClientPortalFeatureGates,
  ClientPortalAuditEventType,
  ClientPortalSettings,
  PublicAppointmentStatusResult,
  ServiceRequestCategory,
  ServiceRequestEventType,
  ServiceRequestStatus,
  ServiceRequestWaitingOn,
} from '../types';
import { isInspectionAppointment, normalizeAppointmentType } from '../utils/appointmentType';
import { checkEvidenceFile } from '../utils/evidenceFile';
import { PUBLIC_APPOINTMENT_DRAFT_KEY } from '../utils/publicAppointmentForm';

const TIMEOUT_MS = 30000;

export interface ClientPortalAuditHealth {
  ok: number;
  failed: number;
  lastError: string | null;
  lastEventType: ClientPortalAuditEventType | null;
  lastFailureAt: string | null;
}

const auditHealth: ClientPortalAuditHealth = {
  ok: 0,
  failed: 0,
  lastError: null,
  lastEventType: null,
  lastFailureAt: null,
};

function recordAuditFailure(eventType: ClientPortalAuditEventType, err: unknown): void {
  auditHealth.failed += 1;
  auditHealth.lastError = err instanceof Error ? err.message : String(err);
  auditHealth.lastEventType = eventType;
  auditHealth.lastFailureAt = new Date().toISOString();
  console.error(
    `[ClientPortal] Auditoria falhou em "${eventType}" (${auditHealth.failed} desde que a pagina abriu):`,
    err
  );
}

function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export interface ClientPortalVisit {
  public_token: string;
  unit_name: string;
  status: string;
  appointment_type: AppointmentType;
  subject?: string | null;
  duration_minutes?: number | null;
  consultant_names?: string[] | null;
  meeting_url?: string | null;
  participant_names?: string[] | null;
  cancellation_reason?: string | null;
  requested_date: string | null;
  requested_time: string | null;
  report_due_at: string | null;
  report_delivered_at: string | null;
  compliance_score?: number | null;
  sanitary_score?: number | null;
  nutrition_score?: number | null;
  critical_nc_count?: number | null;
  important_nc_count?: number | null;
  total_nc_count?: number | null;
  recurring_nc_count?: number | null;
  immediate_nc_count?: number | null;
  nc_items?: { id: string; d: string; c: boolean }[];
  report_count?: number;
  photo_count?: number;
  attachment_count?: number;
  created_at: string;
}

export interface ClientPortalUnit {
  client_id: string;
  client_name: string;
  city: string | null;
  state: string | null;
  has_personalized_sanitary_folder?: boolean;
  personalized_sanitary_folder_url?: string | null;
  personalized_sanitary_folder_expected_delivery_date?: string | null;
  has_audit_service?: boolean;
  has_online_followup?: boolean;
  visits: ClientPortalVisit[];
}

export interface ClientPortalAppointmentPayload {
  client_id: string;
  attendance_mode: 'presencial' | 'online';
  municipality?: string;
  district?: string;
  responsible_name?: string;
  phone?: string;
  email?: string;
  requested_starts_at: string;
  requested_ends_at: string;
  appointment_type?: AppointmentType;
  duration_minutes?: number;
  subject?: string;
  participant_names?: string[];
  notes?: string;
}

export interface ClientPortalPayment {
  type: 'monthly' | 'one_time' | null;
  status: 'pending' | 'paid';
  link: string | null;
  links?: { label?: string; url: string }[];
  due_date?: string | null;
  updated_at: string | null;
}

export interface ClientPortalOverview extends Omit<ClientPortalSettings, 'tenant_id'> {
  account_name: string;
  main_drive_folder_url: string | null;
  scheduling_suspended?: boolean;
  /** PORT-01 — o que está liberado nesta conta. Ausente = tudo liberado. */
  feature_gates?: Partial<ClientPortalFeatureGates>;
  payment?: ClientPortalPayment;
  units: ClientPortalUnit[];
}

export interface ClientAppointmentDetails {
  status: PublicAppointmentStatusResult;
  assets: AppointmentAttachment[];
}

export interface ClientPortalInvoice {
  id: string;
  competence_month: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
  signed_url?: string;
}

/**
 * Item do plano de ação como o CLIENTE o recebe (P360-010). É de propósito menor que a linha
 * de `client_action_items`: sem `source_item_id`, sem `inspection_id`, sem nada da estrutura
 * do checklist. `visit_token` é o mesmo token público que o portal já usa nos compromissos.
 */
export interface ClientPortalActionItem {
  id: string;
  client_id: string;
  unit_name: string;
  title: string;
  situation: string;
  recommended_action: string;
  priority: ClientActionItemPriority;
  responsible: string | null;
  due_date: string | null;
  status: 'published' | 'resolved';
  is_overdue: boolean;
  occurrence_count: number;
  first_detected_on: string | null;
  last_detected_on: string | null;
  resolved_at: string | null;
  visit_token: string | null;
  /** P360-011 — em que pé está a prova de correção. Nunca traz caminho de arquivo. */
  evidence_count: number;
  evidence_status: ClientActionEvidenceStatus | null;
  evidence_file_name: string | null;
  evidence_submitted_at: string | null;
  evidence_reviewed_at: string | null;
  evidence_review_note: string | null;
  /** PORT-02 — quem assinou o último envio. Sem login, é isto que responde "quem alegou". */
  evidence_by_name: string | null;
  evidence_by_role: string | null;
  /** PORT-03 — o que o CLIENTE declarou. Não confundir com `status`, que é a decisão técnica. */
  client_status: ClientDeclaredStatus | null;
  client_status_note: string | null;
  client_status_at: string | null;
  client_status_by_name: string | null;
  client_status_by_role: string | null;
  accepts_evidence: boolean;
}

/** Assinatura obrigatória de quem insere a evidência ou declara a situação (PORT-02/03). */
export interface EvidenceAuthor {
  byName: string;
  byRole: string;
}

/**
 * PORT-03 — o que o cliente diz sobre a pendência. `not_done` é o estado que faltava: antes,
 * quem ainda não tinha corrigido só podia ficar calado, e silêncio é indistinguível de "nem
 * abriu o portal".
 */
export type ClientDeclaredStatus = 'done' | 'in_progress' | 'not_done';

/**
 * Evidência como o CLIENTE a recebe: sem bucket, sem caminho, com URL temporária assinada na
 * hora pela Edge Function. Renovar é reabrir a lista.
 */
export interface ClientPortalEvidence {
  id: string;
  action_item_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  status: ClientActionEvidenceStatus;
  client_note: string | null;
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  signed_url?: string;
  signed_url_expires_in?: number;
}

/**
 * P360-012 — solicitação como o CLIENTE a recebe. Menor que a linha de
 * `client_service_requests` de propósito: sem prioridade (gestão de fila interna), sem nota
 * interna da equipe e sem caminho de Storage.
 */
export interface ClientPortalServiceRequest {
  id: string;
  request_number: number;
  client_id: string;
  unit_name: string;
  category: ServiceRequestCategory;
  subject: string;
  description: string;
  status: ServiceRequestStatus;
  waiting_on: ServiceRequestWaitingOn;
  assigned_to: string | null;
  /** Prazo informativo congelado na abertura. Nulo = nada foi prometido. */
  sla_days: number | null;
  sla_hint_date: string | null;
  attachment_name: string | null;
  opened_by_name: string | null;
  opened_by_role: string | null;
  created_at: string;
  last_event_at: string;
  closed_at: string | null;
  /** Só é `true` quando a consultoria perguntou algo. É o que impede isto de virar chat. */
  accepts_reply: boolean;
  events: ClientPortalServiceRequestEvent[];
}

export interface ClientPortalServiceRequestEvent {
  id: string;
  event_type: ServiceRequestEventType;
  to_status: ServiceRequestStatus | null;
  note: string | null;
  actor_kind: 'client' | 'staff' | 'system';
  actor_name: string | null;
  created_at: string;
}

export interface CreateServiceRequestInput {
  clientId: string;
  category: ServiceRequestCategory;
  subject: string;
  description: string;
  /** Uma por formulário preenchido: é o que faz clique duplo e retry caírem na mesma linha. */
  submissionKey: string;
  byName?: string;
  byRole?: string;
  file?: File | null;
}

const TOKEN_KEY = 'inspecvisa-client-portal-token';

/** 10 MB numa conexão de ILPI do interior não cabe nos 30s das outras chamadas. */
const UPLOAD_TIMEOUT_MS = 180000;

/**
 * Envio da evidência. Os dois caminhos — login da conta e link aberto do relatório — mandam o
 * mesmo `FormData` para a mesma Edge Function; muda só qual token vai junto. A `uploadKey` é a
 * identidade do envio: gerada uma vez por arquivo escolhido e reusada em qualquer tentativa
 * seguinte, para retry e clique duplo caírem na mesma linha. Quem valida de verdade é o
 * servidor; `checkEvidenceFile` roda antes só para não fazer o cliente esperar um upload que
 * vai ser recusado.
 */
async function sendEvidence(
  auth: { accountToken?: string; visitToken?: string },
  params: { actionItemId: string; uploadKey: string; file: File; note?: string } & EvidenceAuthor
): Promise<{ evidenceId: string; duplicate: boolean }> {
  const check = checkEvidenceFile(params.file);
  if (!check.ok) throw new Error(check.message);
  if (!params.byName.trim() || !params.byRole.trim()) {
    throw new Error('Informe seu nome e sua função para registrar quem enviou.');
  }

  const form = new FormData();
  if (auth.accountToken) form.append('accountToken', auth.accountToken);
  if (auth.visitToken) form.append('visitToken', auth.visitToken);
  form.append('actionItemId', params.actionItemId);
  form.append('uploadKey', params.uploadKey);
  form.append('byName', params.byName.trim());
  form.append('byRole', params.byRole.trim());
  if (params.note) form.append('note', params.note);
  form.append('file', params.file);

  const { data, error } = await withTimeout(
    supabase.functions.invoke('client-action-evidence', { body: form }),
    'EnvioDeEvidencia',
    UPLOAD_TIMEOUT_MS
  );
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { evidenceId: data.evidence_id as string, duplicate: !!data.duplicate };
}

export const clientPortalService = {
  getStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  storeToken(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch { /* armazenamento indisponível */ }
  },

  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(PUBLIC_APPOINTMENT_DRAFT_KEY);
    } catch { /* armazenamento indisponível */ }
  },

  async login(identifier: string, password: string): Promise<{ portal_token: string; account_name: string }> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_login', { p_email: identifier, p_code: password }),
      'LoginPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error('E-mail/usuario ou senha invalidos.');
    const result = data as { portal_token: string; account_name: string };
    void this.audit(result.portal_token, 'login', { identifier });
    return result;
  },

  async overview(token: string): Promise<ClientPortalOverview> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_overview', { p_token: token }),
      'PainelPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error('acesso invalido');
    const overview = data as ClientPortalOverview;
    return {
      ...overview,
      units: overview.units.map((unit) => ({
        ...unit,
        visits: unit.visits.map((visit) => ({
          ...visit,
          appointment_type: normalizeAppointmentType(visit.appointment_type),
        })),
      })),
    };
  },

  async actionItems(token: string, clientId?: string | null): Promise<ClientPortalActionItem[]> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_action_items', {
        p_token: token,
        p_client_id: clientId || null,
      }),
      'PlanoDeAcaoPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (data?.items ?? []) as ClientPortalActionItem[];
  },

  /**
   * P360-011 — envia a prova de correção de uma pendência.
   *
   * `uploadKey` é a identidade do envio: gerada uma vez por arquivo escolhido e reusada em
   * qualquer nova tentativa, para que retry e clique duplo caiam na mesma linha em vez de
   * criarem evidências repetidas. Quem valida de verdade é o servidor; `checkEvidenceFile`
   * roda antes só para não fazer o cliente esperar um upload que vai ser recusado.
   */
  async submitEvidence(
    token: string,
    params: { actionItemId: string; uploadKey: string; file: File; note?: string } & EvidenceAuthor
  ): Promise<{ evidenceId: string; duplicate: boolean }> {
    return sendEvidence({ accountToken: token }, params);
  },

  /**
   * PORT-02 — o mesmo envio, mas pelo link aberto do relatório: quem usa é o gestor da casa,
   * que não tem o login do dono do contrato. Sem conta, a assinatura é a identificação.
   */
  async submitReportEvidence(
    visitToken: string,
    params: { actionItemId: string; uploadKey: string; file: File; note?: string } & EvidenceAuthor
  ): Promise<{ evidenceId: string; duplicate: boolean }> {
    return sendEvidence({ visitToken }, params);
  },

  /**
   * PORT-03 — o cliente declara em que pé está a pendência. Sem arquivo, então vai direto pela
   * RPC: o token é a autorização e não há caminho de Storage envolvido.
   */
  async setItemStatus(
    auth: { accountToken?: string; visitToken?: string },
    params: { actionItemId: string; status: ClientDeclaredStatus; note?: string } & EvidenceAuthor
  ): Promise<void> {
    if (!params.byName.trim() || !params.byRole.trim()) {
      throw new Error('Informe seu nome e sua função para registrar quem respondeu.');
    }
    if (params.status === 'not_done' && !params.note?.trim()) {
      throw new Error('Explique por que ainda não foi feito — é isso que a consultoria usa na próxima visita.');
    }

    const { data, error } = await withTimeout(
      auth.accountToken
        ? supabase.rpc('client_portal_set_item_status', {
          p_token: auth.accountToken,
          p_action_item_id: params.actionItemId,
          p_status: params.status,
          p_by_name: params.byName.trim(),
          p_by_role: params.byRole.trim(),
          p_note: params.note?.trim() || null,
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        })
        : supabase.rpc('public_report_set_item_status', {
          p_visit_token: auth.visitToken,
          p_action_item_id: params.actionItemId,
          p_status: params.status,
          p_by_name: params.byName.trim(),
          p_by_role: params.byRole.trim(),
          p_note: params.note?.trim() || null,
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      'SituacaoDoItem'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },

  /** Plano de ação de uma unidade, aberto pelo link do relatório — sem login. */
  async reportActionItems(visitToken: string): Promise<{ unitName: string; items: ClientPortalActionItem[] }> {
    const { data, error } = await withTimeout(
      supabase.rpc('public_report_action_items', { p_visit_token: visitToken }),
      'PlanoDeAcaoDoRelatorio'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    const unitName = (data?.unit_name as string) || '';
    // A RPC do link devolve menos campos que a do portal (nada de unidade por item nem de
    // token da visita, que ali seriam redundantes). Completa para o componente ser um só.
    const items = ((data?.items ?? []) as Partial<ClientPortalActionItem>[]).map((item) => ({
      client_id: '',
      unit_name: unitName,
      visit_token: null,
      last_detected_on: null,
      ...item,
    })) as ClientPortalActionItem[];
    return { unitName, items };
  },

  /** Lista as evidências do acesso com URL temporária recém-assinada. */
  async evidence(token: string, actionItemId?: string | null): Promise<ClientPortalEvidence[]> {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('client-action-evidence', {
        body: { accountToken: token, actionItemId: actionItemId || null },
      }),
      'EvidenciasPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (data?.evidence ?? []) as ClientPortalEvidence[];
  },

  async createAppointment(
    token: string,
    payload: ClientPortalAppointmentPayload
  ): Promise<{ public_token: string }> {
    if (!isAppointmentAtLeast24hAhead(payload.requested_starts_at)) {
      throw new Error(formatAppointmentLeadTimeMessage());
    }
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_create_appointment', {
        p_payload: { ...payload, portal_token: token },
      }),
      'AgendarPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { public_token: string };
  },

  /**
   * PORT-02 — `accountToken` nulo é o link aberto do relatório: a Edge Function valida só o
   * token da visita e aplica o `report_hidden` dela. As travas por conta não entram porque
   * não há conta.
   */
  async appointmentDetails(
    accountToken: string | null,
    appointmentToken: string
  ): Promise<ClientAppointmentDetails> {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('client-appointment-assets', {
        body: { accountToken: accountToken || null, appointmentToken },
      }),
      'ArquivosPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    const details = data as ClientAppointmentDetails;
    const appointmentType = normalizeAppointmentType(details.status.appointment_type);
    return {
      ...details,
      status: { ...details.status, appointment_type: appointmentType },
      assets: isInspectionAppointment(appointmentType)
        ? details.assets
        : details.assets.filter((asset) => asset.kind === 'attachment'),
    };
  },

  async audit(
    token: string,
    eventType: ClientPortalAuditEventType,
    payload: Record<string, unknown> = {},
    options: { appointmentToken?: string; attachmentId?: string } = {}
  ): Promise<void> {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('client_portal_audit_event', {
          p_token: token,
          p_event_type: eventType,
          p_payload: payload,
          p_appointment_token: options.appointmentToken || null,
          p_attachment_id: options.attachmentId || null,
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
        'AuditoriaPortalCliente'
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      auditHealth.ok += 1;
    } catch (err) {
      // Registrar auditoria nunca pode derrubar o portal do cliente, mas falhar em silencio ja
      // custou meses: a funcao nao existia em producao e ninguem percebeu. Fica barulhento.
      recordAuditFailure(eventType, err);
    }
  },

  auditHealth(): ClientPortalAuditHealth {
    return { ...auditHealth };
  },

  async invoices(accountToken: string): Promise<ClientPortalInvoice[]> {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('client-portal-invoices', {
        body: { accountToken },
      }),
      'NotasFiscaisPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (data?.invoices ?? []) as ClientPortalInvoice[];
  },

  // ─── Solicitações de consultoria (P360-012) ─────────────────────────────

  async serviceRequests(token: string, clientId?: string | null): Promise<ClientPortalServiceRequest[]> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_service_requests', {
        p_token: token,
        p_client_id: clientId || null,
      }),
      'SolicitacoesPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (data?.requests ?? []) as ClientPortalServiceRequest[];
  },

  /**
   * Abre a solicitação e, só depois, anexa o arquivo.
   *
   * A ordem é deliberada: a demanda do cliente vale mesmo sem o anexo. Se a subida falhar, ele
   * recebe um aviso sobre o ARQUIVO — não sobre o pedido, que já está registrado e numerado.
   * Reenviar com a mesma `submissionKey` cai na mesma linha em vez de abrir uma segunda.
   */
  async createServiceRequest(
    token: string,
    input: CreateServiceRequestInput
  ): Promise<{ requestId: string; requestNumber: number; duplicate: boolean; attachmentError?: string }> {
    if (input.file) {
      const check = checkEvidenceFile(input.file);
      if (!check.ok) throw new Error(check.message);
    }

    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_create_service_request', {
        p_token: token,
        p_client_id: input.clientId,
        p_category: input.category,
        p_subject: input.subject.trim(),
        p_description: input.description.trim(),
        p_submission_key: input.submissionKey,
        p_by_name: input.byName?.trim() || null,
        p_by_role: input.byRole?.trim() || null,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
      'AbrirSolicitacaoPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    const requestId = data.request_id as string;
    const result = {
      requestId,
      requestNumber: data.request_number as number,
      duplicate: !!data.duplicate,
    };

    // Reenvio da mesma submissão não repete o anexo nem o aviso à equipe.
    if (data.duplicate) return result;

    if (input.file) {
      const form = new FormData();
      form.append('accountToken', token);
      form.append('requestId', requestId);
      form.append('file', input.file);
      const upload = await withTimeout(
        supabase.functions.invoke('client-service-request', { body: form }),
        'AnexoDaSolicitacao',
        UPLOAD_TIMEOUT_MS
      );
      const attachmentError = upload.error
        ? upload.error.message
        : (upload.data?.error as string | undefined);
      if (attachmentError) return { ...result, attachmentError };
      return result;
    }

    // Sem arquivo, o aviso à equipe é a única razão de chamar a Edge Function. Falhar aqui não
    // desfaz nada: a solicitação já está registrada.
    void supabase.functions
      .invoke('client-service-request', { body: { accountToken: token, requestId } })
      .catch((err) => console.warn('[ClientPortal] Aviso da solicitacao a equipe falhou:', err));

    return result;
  },

  /** Só existe quando a solicitação está `awaiting_client` — o servidor recusa o resto. */
  async replyServiceRequest(
    token: string,
    params: { requestId: string; message: string; byName?: string; byRole?: string }
  ): Promise<void> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_reply_service_request', {
        p_token: token,
        p_request_id: params.requestId,
        p_message: params.message.trim(),
        p_by_name: params.byName?.trim() || null,
        p_by_role: params.byRole?.trim() || null,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
      'ResponderSolicitacaoPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },

  async acknowledgePayment(token: string, note?: string): Promise<void> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_payment_acknowledge', {
        p_token: token,
        p_note: note || null,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
      'ConfirmarPagamentoPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },
};
