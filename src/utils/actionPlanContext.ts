import { db } from '../db/database';
import { getTemplateById, getTemplates } from '../data/templates';
import { InspectionService } from '../services/inspectionService';
import type { ChecklistItem, ChecklistTemplate, Inspection, InspectionPhoto, InspectionResponse, Section } from '../types';
import { filterByActiveTenant } from './localScope';

export interface PreviousNCContext {
  itemId: string;
  description: string;
  sectionTitle?: string;
  templateName?: string;
  inspectionId: string;
  inspectionDate: Date;
  count: number;
  situationDescription?: string;
  correctiveAction?: string;
  responsible?: string;
  deadline?: string;
  photos: InspectionPhoto[];
}

export interface ClientActionPlanContext {
  latestInspection?: Inspection;
  latestOpenItems: PreviousNCContext[];
  recurringItems: PreviousNCContext[];
}

function sortInspectionsNewestFirst(inspections: Inspection[]) {
  return [...inspections].sort((a, b) => {
    const aTime = new Date(a.inspectionDate || a.completedAt || a.createdAt).getTime();
    const bTime = new Date(b.inspectionDate || b.completedAt || b.createdAt).getTime();
    return bTime - aTime;
  });
}

function responseTime(response: InspectionResponse, inspectionsById: Map<string, Inspection>) {
  const inspection = inspectionsById.get(response.inspectionId);
  return new Date(inspection?.inspectionDate || response.updatedAt || response.createdAt).getTime();
}

async function templateForInspection(inspection: Inspection): Promise<ChecklistTemplate | undefined> {
  return getTemplateById(inspection.templateId) || await db.templates.get(inspection.templateId);
}

function findItemInTemplate(template: ChecklistTemplate | undefined, itemId: string) {
  if (!template) return null;

  for (const section of template.sections || []) {
    const item = section.items?.find((candidate: ChecklistItem) => candidate.id === itemId);
    if (item) return { item, section, template };
  }

  return null;
}

function findStaticItem(itemId: string) {
  for (const template of getTemplates()) {
    const found = findItemInTemplate(template, itemId);
    if (found) return found;
  }
  return null;
}

async function resolveResponseMeta(response: InspectionResponse, inspection: Inspection) {
  const template = await templateForInspection(inspection);
  const found = findItemInTemplate(template, response.itemId) || findStaticItem(response.itemId);
  const item = found?.item;
  const section = found?.section as Section | undefined;

  return {
    description: response.customDescription || item?.description || `Item ${response.itemId}`,
    sectionTitle: section?.title,
    templateName: found?.template?.name || template?.name,
  };
}

function isDisplayablePhoto(photo: InspectionPhoto) {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(photo.dataUrl || '');
}

async function photosByResponseId(responseIds: string[]) {
  const photos = responseIds.length > 0
    ? await InspectionService.getPhotosByResponseIds(responseIds, false, { remote: false })
    : [];

  const byResponse = new Map<string, InspectionPhoto[]>();
  for (const photo of photos.filter(isDisplayablePhoto)) {
    const current = byResponse.get(photo.responseId) || [];
    current.push(photo);
    byResponse.set(photo.responseId, current);
  }

  return byResponse;
}

async function buildContextItem(
  response: InspectionResponse,
  inspection: Inspection,
  count: number,
  photos: InspectionPhoto[]
): Promise<PreviousNCContext> {
  const meta = await resolveResponseMeta(response, inspection);
  return {
    itemId: response.itemId,
    description: meta.description,
    sectionTitle: meta.sectionTitle,
    templateName: meta.templateName,
    inspectionId: inspection.id,
    inspectionDate: inspection.inspectionDate,
    count,
    situationDescription: response.situationDescription,
    correctiveAction: response.correctiveAction,
    responsible: response.responsible,
    deadline: response.deadline,
    photos,
  };
}

export async function getPreviousNCContextByInspection(inspectionId: string): Promise<Map<string, PreviousNCContext>> {
  // Garante que as respostas da inspeção anterior estejam no Dexie local mesmo
  // quando ela foi feita em outro dispositivo (ou após limpar o cache). Sem isso,
  // o desktop não mostra as NCs anteriores que aparecem no celular. Ver
  // memória sync-no-full-response-hydration.
  await InspectionService.hydrateTenantResponses().catch(() => {});

  const inspection = await db.inspections.get(inspectionId);
  if (!inspection || inspection.deletedAt) return new Map();

  const responses = filterByActiveTenant(await db.responses
    .where('inspectionId')
    .equals(inspectionId)
    .filter(response => response.result === 'not_complies' && !response.deletedAt)
    .toArray());

  const photos = await photosByResponseId(responses.map(response => response.id));
  const result = new Map<string, PreviousNCContext>();

  for (const response of responses) {
    result.set(response.itemId, await buildContextItem(
      response,
      inspection,
      1,
      photos.get(response.id) || []
    ));
  }

  return result;
}

/**
 * Conjunto de itemIds que já foram registrados como não conformes em inspeções
 * concluídas ANTERIORES deste cliente (excluindo a inspeção informada). Usado
 * para marcar reincidência no PDF. Aguarda a hidratação do tenant para funcionar
 * no desktop. Ver memória sync-no-full-response-hydration.
 */
export async function getRecurringItemIdsForClient(
  clientId: string,
  excludeInspectionId?: string
): Promise<Set<string>> {
  await InspectionService.hydrateTenantResponses().catch(() => {});

  const inspections = filterByActiveTenant(await db.inspections
    .where('clientId')
    .equals(clientId)
    .filter(inspection => inspection.status === 'completed' && !inspection.deletedAt && inspection.id !== excludeInspectionId)
    .toArray());

  if (inspections.length === 0) return new Set();

  const responses = filterByActiveTenant(await db.responses
    .where('inspectionId')
    .anyOf(inspections.map(inspection => inspection.id))
    .filter(response => response.result === 'not_complies' && !response.deletedAt)
    .toArray());

  return new Set(responses.map(response => response.itemId));
}

export async function getClientActionPlanContext(clientId: string): Promise<ClientActionPlanContext> {
  // NC recorrentes / plano aberto dependem de TODO o histórico de respostas estar
  // no Dexie local. Aguarda a hidratação do tenant para não calcular vazio no
  // desktop. Ver memória sync-no-full-response-hydration.
  await InspectionService.hydrateTenantResponses().catch(() => {});

  const inspections = sortInspectionsNewestFirst(filterByActiveTenant(await db.inspections
    .where('clientId')
    .equals(clientId)
    .filter(inspection => inspection.status === 'completed' && !inspection.deletedAt)
    .toArray()));

  if (inspections.length === 0) {
    return { latestOpenItems: [], recurringItems: [] };
  }

  const inspectionsById = new Map(inspections.map(inspection => [inspection.id, inspection]));
  const inspectionIds = inspections.map(inspection => inspection.id);
  const responses = filterByActiveTenant(await db.responses
    .where('inspectionId')
    .anyOf(inspectionIds)
    .filter(response => response.result === 'not_complies' && !response.deletedAt)
    .toArray());

  const photos = await photosByResponseId(responses.map(response => response.id));
  const latestInspection = inspections[0];
  const latestResponses = responses.filter(response => response.inspectionId === latestInspection.id);

  const latestOpenItems = await Promise.all(latestResponses
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map(response => buildContextItem(response, latestInspection, 1, photos.get(response.id) || [])));

  const byItem = new Map<string, InspectionResponse[]>();
  for (const response of responses) {
    const current = byItem.get(response.itemId) || [];
    current.push(response);
    byItem.set(response.itemId, current);
  }

  const recurringItems: PreviousNCContext[] = [];
  for (const group of byItem.values()) {
    if (group.length < 2) continue;
    const latest = [...group].sort((a, b) => responseTime(b, inspectionsById) - responseTime(a, inspectionsById))[0];
    const inspection = inspectionsById.get(latest.inspectionId);
    if (!inspection) continue;
    recurringItems.push(await buildContextItem(latest, inspection, group.length, photos.get(latest.id) || []));
  }

  recurringItems.sort((a, b) => b.count - a.count || b.inspectionDate.getTime() - a.inspectionDate.getTime());

  return {
    latestInspection,
    latestOpenItems,
    recurringItems,
  };
}
