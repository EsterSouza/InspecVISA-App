// ============================================================
// src/types/index.ts — All TypeScript interfaces
// InspecVISA — C&C Consultoria Sanitária
// ============================================================

import type { AppointmentType } from '../utils/appointmentType';
export type { AppointmentType } from '../utils/appointmentType';

export type ClientCategory = 'estetica' | 'ilpi' | 'alimentos';

// Food establishment sub-types for modular inspection
export type FoodEstablishmentType =
  | 'servico_alimentacao'     // Restaurantes, lanchonetes, padarias (RDC 216)
  | 'panificacao_confeitaria' // Padarias com produção própria
  | 'mercado_varejo'          // Mercados, minimercados, hortifrúti
  | 'manipulacao_carnes'      // Açougue, peixaria, frios
  | 'pescados_crus'           // Japonês, sushi, sashimi
  | 'dark_kitchen'            // Cozinha virtual / delivery
  | 'bebidas_sorvetes'        // Sorveterias, cafés, açaí
  | 'catering_eventos'        // Buffet, catering, eventos
  | 'industria_artesanal';    // Produção artesanal registrada

export const FOOD_SEGMENT_LABELS: Record<FoodEstablishmentType, string> = {
  servico_alimentacao: 'Restaurante / Lanchonete',
  panificacao_confeitaria: 'Padaria / Confeitaria',
  mercado_varejo: 'Mercado / Hortifrúti',
  manipulacao_carnes: 'Açougue / Peixaria',
  pescados_crus: 'Japonês / Pescados Crus',
  dark_kitchen: 'Dark Kitchen / Delivery',
  bebidas_sorvetes: 'Sorveteria / Lanchonete / Café',
  catering_eventos: 'Buffet / Catering',
  industria_artesanal: 'Indústria Artesanal',
};

export interface Client {
  id: string;
  name: string;
  cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  category: ClientCategory;
  foodTypes?: FoodEstablishmentType[]; // only for 'alimentos'
  responsibleName?: string;
  phone?: string;
  email?: string;
  contacts?: ClientContact[];
  hasPersonalizedSanitaryFolder?: boolean;
  personalizedSanitaryFolderUrl?: string;
  hasAuditService?: boolean;
  hasOnlineFollowup?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  tenantId?: string;
  syncStatus: SyncStatus;
  dataVerifiedAt?: Date;
  syncError?: string;
  syncAttempts?: number;
  localActorId?: string;
  conflictRemote?: any;
  conflictLocal?: any;
}

export interface ClientContact {
  name?: string;
  phone?: string;
  email?: string;
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';

export interface SyncBase {
  syncStatus: SyncStatus;
  dataVerifiedAt?: Date;
  syncError?: string;
  syncAttempts?: number;
  localActorId?: string;
  conflictRemote?: any;
  conflictLocal?: any;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  category: ClientCategory;
  version: string;
  sections: Section[];
  dataVerifiedAt?: Date;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  // For alimentos: if set, section only shows when client has matching food types
  applicableFoodTypes?: FoodEstablishmentType[];
  isExtraSection?: boolean;
  segmentKey?: string;
  items: ChecklistItem[];
}

// Suplementos Regionais
export interface SectionAddition {
  targetSectionId: string;    // ID da seção federal receptora
  targetSectionTitle: string; // legibilidade no código
  items: ChecklistItem[];
}

export interface ChecklistSupplement {
  id: string;
  baseTemplateId: string;     // ID do roteiro base
  state: string;
  municipality?: string;
  name: string;
  version: string;
  sectionAdditions: SectionAddition[];
  newSections?: Section[];
}

export interface ChecklistItem {
  id: string;
  sectionId: string;
  order: number;
  description: string;
  legislation?: string;
  legislationUrl?: string;
  legislationId?: string; // Novo campo para link com a biblioteca central
  weight: number;
  isCritical: boolean;
  isRJOnly?: boolean;
  // Ausente = 'legal' (exigência normativa). 'good_practice' = recomendação sem base legal
  // vigente, entra no score com peso reduzido e nunca é crítica.
  requirementType?: 'legal' | 'good_practice';

  // Controle de Mescla (Suplementos / Dinâmicos)
  replacesItemId?: string;
  insertAfterItemId?: string;
}

export interface ReferenceSource {
  id: string;
  url: string;
  title?: string;
  note?: string;
}

export interface Inspection {
  id: string;
  clientId: string;
  templateId: string;
  consultantName: string;
  // Consultoras responsáveis (co-responsabilidade). Quando presente, é a
  // fonte de atribuição; consultantName segue como líder/compatibilidade.
  consultantNames?: string[];
  inspectionDate: Date;
  status: 'in_progress' | 'completed';
  observations?: string;
  // Fontes consultadas pela consultora além das legislações do roteiro (REF-03).
  referenceSources?: ReferenceSource[];
  createdAt: Date;
  completedAt?: Date;
  // Cached for display
  clientName?: string;
  clientCategory?: ClientCategory;
  foodTypes?: FoodEstablishmentType[];
  city?: string;
  state?: string;
  // P2: Advanced Metadata
  accompanistName?: string;
  accompanistRole?: string;
  // ILPI Specifics
  ilpiCapacity?: number;
  residentsTotal?: number;
  residentsMale?: number;
  residentsFemale?: number;
  dependencyLevel1?: number;
  dependencyLevel2?: number;
  dependencyLevel3?: number;
  observedStaff?: number;
  observedNursingTechs?: number; // RJ specific staff
  usableAreaM2?: number;
  observedCleaningStaff?: number;
  signatureDataUrl?: string;
  // Rastreabilidade: nome de quem fez a última modificação (Ester/Ana).
  lastEditedBy?: string;
  // Co-finalização ILPI: quem já finalizou a sua parte. A inspeção só fecha
  // de fato quando todas as consultoras esperadas (consultantNames) finalizarem.
  finalizedBy?: { name: string; at: string }[];
  // Immutable template used when the inspection was completed.
  reportTemplateSnapshot?: ChecklistTemplate;
  updatedAt: Date;
  deletedAt?: Date | null;
  tenantId?: string;
  syncStatus: SyncStatus;
  dataVerifiedAt?: Date;
  syncError?: string;
  syncAttempts?: number;
  localActorId?: string;
  conflictRemote?: any;
  conflictLocal?: any;
}

export type ResponseResult = 'complies' | 'not_complies' | 'not_applicable' | 'not_observed' | 'not_evaluated';

export interface InspectionResponse {
  id: string;
  inspectionId: string;
  itemId: string;
  result: ResponseResult;
  situationDescription?: string;
  correctiveAction?: string;
  responsible?: string;
  deadline?: string;
  customDescription?: string; // For ad-hoc items added by consultant
  photos?: InspectionPhoto[];
  // Links/fontes anexados pela consultora enquanto responde este item específico.
  links?: string[];
  // Rastreabilidade: nome de quem fez a última modificação nesta resposta.
  lastEditedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  tenantId?: string;
  syncStatus: SyncStatus;
  dataVerifiedAt?: Date;
  syncError?: string;
  syncAttempts?: number;
  localActorId?: string;
  conflictRemote?: any;
  conflictLocal?: any;
}

export interface InspectionPhoto {
  id: string;
  responseId: string;
  dataUrl: string; // base64 JPEG
  storagePath?: string; // Supabase Storage path after cloud upload
  caption?: string;
  takenAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  tenantId?: string;
  syncStatus: SyncStatus;
  dataVerifiedAt?: Date;
  syncError?: string;
  syncAttempts?: number;
  localActorId?: string;
  conflictRemote?: any;
  conflictLocal?: any;
}

export interface InspectionBundlePayload {
  client?: any;
  inspection: any;
  responses: any[];
  photos: any[];
  schedules?: any[];
  clientSyncId: string;
  finalizeReport: boolean;
  reportSnapshot?: {
    generatedAt: string;
    client: Client;
    inspection: Inspection;
    responses: InspectionResponse[];
    photos: InspectionPhoto[];
    schedules?: Schedule[];
    template?: ChecklistTemplate;
  };
}

export interface InspectionBundleResult {
  ok: boolean;
  inspectionId: string;
  jobId?: string;
  status?: 'queued' | 'processing' | 'completed' | 'failed';
  syncBatchId?: string;
  serverUpdatedAt?: string;
  reportVersionId?: string | null;
  failedItems: Array<{
    table: 'clients' | 'inspections' | 'responses' | 'photos' | 'schedules';
    id: string;
    error: string;
  }>;
  error?: string;
}

export interface LocalBackupRecord {
  id: string;
  createdAt: Date;
  reason: 'pre-bundle-sync' | string;
  payload: any;
}

export interface SectionScore {
  sectionId: string;
  sectionTitle: string;
  totalItems: number;
  evaluatedItems: number;
  compliesCount: number;
  notCompliesCount: number;
  criticalNotCompliesCount: number;
  notApplicableCount: number;
  notObservedCount: number;
  scorePercentage: number;
  urgentActionsCount: number;
  importantActionsCount: number;
  // MARP metrics
  ic: number;
  inc: number;
  cr: number;
  rp: number;
}

export type ScoreClassification = 'critical' | 'regular' | 'good' | 'excellent';

export interface InspectionScore {
  totalItems: number;
  evaluatedItems: number;
  compliesCount: number;
  notCompliesCount: number;
  criticalNotCompliesCount: number;
  notApplicableCount: number;
  notObservedCount: number;
  notEvaluatedCount: number;
  scorePercentage: number;
  scoreBySection: SectionScore[];
  classification: ScoreClassification;
  urgentActionsCount: number;
  importantActionsCount: number;
  // MARP metrics
  ic: number;
  inc: number;
  cr: number;
  rp: number;
}

export interface ConsultantSettings {
  name: string;
  professionalId?: string; // CRF, CRBM, CRN, Coren, etc.
  professionalIdLabel?: string; // e.g. "CRN", "COREN"
  logoDataUrl?: string; // base64 PNG/JPG max 200KB
  theme: 'light' | 'dark';
  companyName?: string;
  phone?: string;
  consultantRole?: 'saude' | 'nutricao' | 'ambos'; // role filter for ILPI
}

export interface Schedule {
  id: string;
  clientId: string;
  clientName?: string;
  scheduledAt: Date;
  status: 'pending' | 'completed' | 'cancelled' | 'in_progress';
  notes?: string;
  /** Ausente apenas em registros locais legados, que são tratados como inspeção. */
  appointmentType?: AppointmentType;
  subject?: string;
  durationMinutes?: number;
  meetingUrl?: string;
  participantNames?: string[];
  cancellationReason?: string;
  // Consultora(s) responsável(is) por esta visita. A inspeção herda na criação.
  consultantNames?: string[];
  user_id?: string;
  inspectionId?: string;
  updatedAt: Date;
  deletedAt?: Date | null;
  tenantId?: string;
  syncStatus: SyncStatus;
  dataVerifiedAt?: Date;
  syncError?: string;
  syncAttempts?: number;
  localActorId?: string;
  conflictRemote?: any;
  conflictLocal?: any;
}

export interface SyncLog {
  id?: number;
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
}

// ─── Portal Público ───────────────────────────────────────────────────────────

export type SlotPeriod = 'manha' | 'tarde' | 'noite' | 'integral';
export type SlotStatus = 'available' | 'blocked' | 'full' | 'cancelled';
export type AttendanceMode = 'presencial' | 'online';
export type AppointmentBlockRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'rescheduled'
  | 'completed'
  | 'report_available'
  | 'cancelled';
export type AttachmentKind = 'report_pdf' | 'photo' | 'attachment';
export type ReportDueSource = 'business_days' | 'manual';
export type ClientPortalAuditEventType =
  | 'login'
  | 'overview_viewed'
  | 'appointment_viewed'
  | 'report_download_clicked'
  | 'attachment_download_clicked'
  | 'photo_download_clicked'
  | 'photo_gallery_opened'
  | 'payment_link_clicked'
  | 'payment_acknowledged'
  | 'sanitary_folder_opened'
  | 'invoice_download_clicked'
  | 'main_drive_folder_opened'
  | 'portal_tutorial_opened'
  | 'schedule_cta_clicked'
  | 'support_whatsapp_clicked'
  | 'next_action_clicked'
  | 'unit_filter_changed'
  | 'action_plan_viewed';

export interface AppointmentSlot {
  id: string;
  tenant_id: string;
  starts_at: string | null;
  ends_at: string | null;
  period: SlotPeriod | null;
  capacity: number;
  booked_count: number;
  is_public: boolean;
  status: SlotStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  spots_left?: number; // calculado: capacity - booked_count
}

export interface AppointmentRequest {
  id: string;
  tenant_id: string;
  slot_id: string | null;
  client_id: string | null;
  schedule_id: string | null;
  inspection_id: string | null;
  appointment_type: AppointmentType;
  subject: string | null;
  duration_minutes: number | null;
  consultant_names: string[] | null;
  preferred_consultant_name: string | null;
  meeting_url: string | null;
  participant_names: string[] | null;
  cancellation_reason: string | null;
  public_token: string;
  unit_name: string;
  district: string;
  responsible_name: string | null;
  phone: string | null;
  email: string | null;
  requested_date: string | null;
  requested_period: string | null;
  requested_time: string | null;
  requested_starts_at?: string | null;
  requested_ends_at?: string | null;
  attendance_mode?: AttendanceMode | null;
  municipality?: string | null;
  matched_client_name?: string | null;
  status: AppointmentStatus;
  report_due_at: string | null;
  report_due_source: ReportDueSource | null;
  report_pdf_path: string | null;
  report_hidden?: boolean;
  compliance_score?: number | null;
  // Score por área da ILPI (opcional): sanitária x nutrição. O global é compliance_score.
  sanitary_score?: number | null;
  nutrition_score?: number | null;
  // Estatísticas de NC gravadas ao publicar o relatório, para o resumo executivo do portal.
  critical_nc_count?: number | null;
  important_nc_count?: number | null;
  total_nc_count?: number | null;
  recurring_nc_count?: number | null;
  immediate_nc_count?: number | null;
  nc_items?: { id: string; d: string; c: boolean }[];
  notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentAttachment {
  id: string;
  tenant_id: string;
  appointment_request_id: string;
  inspection_id: string | null;
  kind: AttachmentKind;
  storage_bucket: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  caption: string | null;
  signed_url?: string; // preenchido pelo serviço, nunca expor storage_path bruto ao cliente
  created_at: string;
}

/**
 * PORT-01 — funções de entrega técnica que a consultora pode liberar/ocultar por CONTA de
 * portal. Agendamento não entra aqui: tem modo próprio (`SchedulingSuspensionMode`), e o
 * tutorial/WhatsApp/acessos rápidos continuam sendo configuração do tenant.
 */
export type ClientPortalFeature = 'reports' | 'photos' | 'action_plan' | 'compliance';
export type ClientPortalFeatureState = 'released' | 'hidden' | 'scheduled';
export type ClientPortalFeatureGates = Record<ClientPortalFeature, boolean>;

export interface ClientPortalFeatureRow {
  account_id: string;
  tenant_id: string;
  feature: ClientPortalFeature;
  state: ClientPortalFeatureState;
  release_at: string | null;
  hide_at: string | null;
  lock_when_overdue: boolean;
  updated_at: string;
  updated_by: string | null;
}

/**
 * `auto` suspende sozinho quando a conta passa da tolerância de atraso; `always_open` é a
 * trava manual para o cliente que a consultora sabe que vai pagar; `suspended` é suspensão
 * manual permanente.
 */
export type SchedulingSuspensionMode = 'auto' | 'always_open' | 'suspended';

export type ClientActionItemPriority = 'urgent' | 'important' | 'recommended';
export type ClientActionItemStatus = 'hidden' | 'published' | 'resolved';

/**
 * Projeção do plano de ação (P360-010) como o staff a enxerga. O cliente recebe uma versão
 * reduzida, sem `source_item_id`, `inspection_id` nem qualquer id de checklist.
 */
export interface ClientActionItem {
  id: string;
  tenant_id: string;
  client_id: string;
  appointment_request_id: string | null;
  inspection_id: string | null;
  source_item_id: string;
  title: string;
  situation: string;
  recommended_action: string;
  priority: ClientActionItemPriority;
  responsible: string | null;
  due_date: string | null;
  status: ClientActionItemStatus;
  occurrence_count: number;
  first_detected_on: string | null;
  last_detected_on: string | null;
  published_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientPortalAuditEvent {
  id: string;
  tenant_id: string;
  account_id: string | null;
  client_id: string | null;
  appointment_request_id: string | null;
  attachment_id: string | null;
  event_type: ClientPortalAuditEventType | string;
  payload: Record<string, unknown>;
  user_agent: string | null;
  created_at: string;
}

export interface AppointmentBlock {
  id: string;
  tenant_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  recurrence_group_id: string | null;
  recurrence: AppointmentBlockRecurrence;
  occurrence_index: number;
  occurrence_count: number;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientPortalSettings {
  tenant_id: string;
  tutorial_pdf_url: string | null;
  support_whatsapp: string | null;
  quick_access_enabled: boolean;
  multi_purpose_schedule: boolean;
  action_plan_enabled: boolean;
  service_requests_enabled: boolean;
  // Dias de tolerância depois do vencimento antes de a conta contar como em atraso.
  overdue_grace_days?: number;
}

export interface PublicAppointmentPayload {
  tenant_id: string;
  slot_id?: string;
  unit_name: string;
  district: string;
  responsible_name?: string;
  phone: string;
  email?: string;
  requested_date?: string;
  requested_period?: string;
  requested_starts_at?: string;
  requested_ends_at?: string;
  appointment_type?: AppointmentType;
  duration_minutes?: number;
  subject?: string;
  participant_names?: string[];
  attendance_mode?: AttendanceMode;
  municipality?: string;
  existing_client_id?: string;
  matched_client_name?: string;
  notes?: string;
}

export interface PublicAppointmentStatusResult {
  id: string;
  client_id?: string | null;
  unit_name: string;
  district: string;
  municipality?: string | null;
  attendance_mode?: AttendanceMode | null;
  appointment_type: AppointmentType;
  subject?: string | null;
  duration_minutes?: number | null;
  consultant_names?: string[] | null;
  preferred_consultant_name?: string | null;
  meeting_url?: string | null;
  participant_names?: string[] | null;
  cancellation_reason?: string | null;
  status: AppointmentStatus;
  requested_date: string | null;
  requested_period: string | null;
  requested_time?: string | null;
  requested_starts_at?: string | null;
  requested_ends_at?: string | null;
  report_due_at: string | null;
  report_due_source: ReportDueSource | null;
  notes?: string | null;
  has_personalized_sanitary_folder?: boolean;
  personalized_sanitary_folder_url?: string | null;
  /** Conta suspensa por pendência de pagamento: relatório/arquivos ficam bloqueados (visíveis, sem abrir/baixar). */
  scheduling_suspended?: boolean;
  /** PORT-01 — travas por conta. Ausente = tudo liberado. */
  feature_gates?: Partial<ClientPortalFeatureGates>;
  payment_link?: string | null;
  payment_due_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicCalendarDay {
  day: string;
  weekday: number;
  available_count: number;
}

export interface PublicAvailableTime {
  starts_at: string;
  ends_at: string;
  label: string;
}

export interface PublicClientSuggestion {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}
