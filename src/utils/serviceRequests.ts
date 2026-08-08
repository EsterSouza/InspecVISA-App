import type {
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestWaitingOn,
} from '../types';

/**
 * P360-012 — vocabulário das solicitações, num lugar só.
 *
 * As mesmas palavras aparecem no portal do cliente e no painel interno. Duplicar os rótulos
 * faria a consultora e o cliente falarem de estados diferentes com o mesmo nome — que é
 * exatamente o problema que o card veio resolver.
 */

export const SERVICE_REQUEST_CATEGORIES: { value: ServiceRequestCategory; label: string; hint: string }[] = [
  { value: 'documentacao', label: 'Documentação', hint: 'Contratos, POPs, manuais, registros e formulários.' },
  { value: 'licenciamento', label: 'Licenciamento e alvará', hint: 'Abertura, renovação ou alteração de licença sanitária.' },
  { value: 'notificacao_visa', label: 'Notificação da vigilância', hint: 'Recebeu auto de infração, exigência ou intimação.' },
  { value: 'obra_reforma', label: 'Obra ou reforma', hint: 'Layout, projeto e adequação de área física.' },
  { value: 'treinamento', label: 'Treinamento de equipe', hint: 'Capacitação da equipe em boas práticas e biossegurança.' },
  { value: 'produto_equipamento', label: 'Produto ou equipamento', hint: 'Compra, regularização ou uso de produto e equipamento.' },
  { value: 'boas_praticas', label: 'Boas práticas e rotinas', hint: 'Dúvida de rotina, processo ou conduta no dia a dia.' },
  { value: 'outro', label: 'Outro assunto', hint: 'Não se encaixa nas anteriores.' },
];

export const SERVICE_REQUEST_CATEGORY_LABELS: Record<ServiceRequestCategory, string> = Object.fromEntries(
  SERVICE_REQUEST_CATEGORIES.map((category) => [category.value, category.label])
) as Record<ServiceRequestCategory, string>;

/**
 * Dois vocabulários para os mesmos estados. Para a equipe, o estado é da fila ("em
 * atendimento"); para o cliente, é sobre quem tem de agir ("aguardando você"). O cliente não
 * precisa saber que existe uma fila; precisa saber se a bola está com ele.
 */
export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  open: 'Nova',
  in_progress: 'Em atendimento',
  awaiting_client: 'Aguardando cliente',
  resolved: 'Concluída',
  cancelled: 'Cancelada',
};

export const SERVICE_REQUEST_CLIENT_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  open: 'Recebida',
  in_progress: 'Em atendimento',
  awaiting_client: 'Aguardando você',
  resolved: 'Concluída',
  cancelled: 'Cancelada',
};

export const SERVICE_REQUEST_PRIORITY_LABELS: Record<ServiceRequestPriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

/** Mesma regra da `private.service_request_waiting_on` do banco. */
export function serviceRequestWaitingOn(status: ServiceRequestStatus): ServiceRequestWaitingOn {
  if (status === 'awaiting_client') return 'client';
  if (status === 'open' || status === 'in_progress') return 'team';
  return 'none';
}

export function isServiceRequestOpen(status: ServiceRequestStatus): boolean {
  return serviceRequestWaitingOn(status) !== 'none';
}
