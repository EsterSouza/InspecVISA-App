// ============================================================
// src/services/applicabilityRevisionService.ts
// COND-04 — leitura e escrita das revisões de aplicabilidade de um roteiro.
//
// Migration: supabase/migrations/20260819090603_cond04_applicability_revisions.sql
// Schema do que trafega em `rules`/`routingQuestions`: src/domain/applicability/schema.ts
//
// Só revisão PUBLICADA entra em inspeção. Rascunho existe para a consultora poder
// parar no meio de uma regra sem perder trabalho — e é por isso que a validação só
// pesa na publicação. O gate visual, com explicação de cada erro, é o COND-07; aqui
// fica a última linha antes do banco.
//
// Roteiro sem revisão publicada devolve `null`, e `null` significa **sem regra =
// sempre aplicável** — é a compatibilidade que o card exige, não um erro.
// ============================================================

import { supabase } from '../lib/supabase';
import { getActiveTenantId } from '../utils/localScope';
import { validateTemplateRules } from '../domain/applicability';
import type {
  ApplicabilityRule,
  ConditionalTemplate,
  RoutingQuestion,
  ValidationIssue,
} from '../domain/applicability';
import type { ChecklistTemplate } from '../types';

export interface ApplicabilityRevision {
  id: string;
  tenantId: string;
  templateId: string;
  revision: number;
  status: 'draft' | 'published';
  rules: ApplicabilityRule[];
  routingQuestions: RoutingQuestion[];
  notes?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

/** Linha de `checklist_template_revisions` como o PostgREST devolve. */
interface RevisionRow {
  id: string;
  tenant_id: string;
  template_id: string;
  revision: number;
  status: 'draft' | 'published';
  rules: unknown;
  routing_questions: unknown;
  notes?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}

const COLUNAS = 'id, tenant_id, template_id, revision, status, rules, routing_questions, notes, published_at, updated_at';

/** Jsonb que não é lista vira lista vazia: regra ilegível nunca vira regra inventada. */
function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function mapRevisionRow(row: RevisionRow): ApplicabilityRevision {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    templateId: row.template_id,
    revision: row.revision,
    status: row.status,
    rules: asList<ApplicabilityRule>(row.rules),
    routingQuestions: asList<RoutingQuestion>(row.routing_questions),
    notes: row.notes ?? null,
    publishedAt: row.published_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * O roteiro na forma que o motor lê. Sem revisão, `rules` e `routingQuestions`
 * ficam vazios — que é exatamente o roteiro de hoje, sempre aplicável.
 */
export function toConditionalTemplate(
  template: ChecklistTemplate,
  revision?: ApplicabilityRevision | null
): ConditionalTemplate {
  return {
    sections: template.sections,
    rules: revision?.rules ?? [],
    routingQuestions: revision?.routingQuestions ?? [],
  };
}

/**
 * COND-08 — a revisão viaja **dentro** da árvore congelada da inspeção.
 *
 * É o que faz a execução decidir aplicabilidade sem tocar na rede: o motor lê
 * `rules` e `routingQuestions` do próprio `reportTemplateSnapshot`, que mora no
 * Dexie. Sem revisão, os dois ficam vazios — o roteiro de hoje, sempre aplicável.
 */
export function freezeRevisionIntoTemplate(
  template: ChecklistTemplate,
  revision?: ApplicabilityRevision | null
): ChecklistTemplate {
  return {
    ...template,
    applicabilityRevisionId: revision?.id ?? null,
    rules: revision?.rules ?? [],
    routingQuestions: revision?.routingQuestions ?? [],
  };
}

/** `true` quando a árvore congelada ainda não sabe qual é a revisão dela. */
export function needsRevisionFreeze(template: ChecklistTemplate | undefined | null): boolean {
  return Boolean(template) && template!.applicabilityRevisionId === undefined;
}

export class ApplicabilityValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Roteiro com ${issues.length} problema(s) de condição: ${issues.map((i) => i.message).join(' ')}`);
    this.name = 'ApplicabilityValidationError';
    this.issues = issues;
  }
}

async function fetchRevision(templateId: string, status: 'draft' | 'published') {
  const { data, error } = await supabase
    .from('checklist_template_revisions')
    .select(COLUNAS)
    .eq('template_id', templateId)
    .eq('status', status)
    .order('revision', { ascending: false })
    .limit(1);

  if (error) throw error;
  const rows = (data || []) as RevisionRow[];
  return rows.length > 0 ? mapRevisionRow(rows[0]) : null;
}

export const ApplicabilityRevisionService = {
  /** A revisão que uma inspeção nova congela. `null` = roteiro sem regra. */
  getPublishedRevision(templateId: string) {
    return fetchRevision(templateId, 'published');
  },

  /**
   * A revisão exata que uma inspeção congelou (COND-08). Buscada por id porque a
   * publicada de hoje pode não ser a que aquela inspeção usou — e revisão
   * publicada é imutável, então as duas consultoras que a lerem por id leem
   * exatamente a mesma coisa.
   */
  async getRevisionById(id: string): Promise<ApplicabilityRevision | null> {
    const { data, error } = await supabase
      .from('checklist_template_revisions')
      .select(COLUNAS)
      .eq('id', id)
      .limit(1);

    if (error) throw error;
    const rows = (data || []) as RevisionRow[];
    return rows.length > 0 ? mapRevisionRow(rows[0]) : null;
  },

  /** O rascunho em edição, se existir. Há no máximo um por roteiro (índice único). */
  getDraft(templateId: string) {
    return fetchRevision(templateId, 'draft');
  },

  /**
   * Salva o rascunho **sem validar**: regra pela metade é trabalho em andamento, não
   * erro. O que ela não pode é chegar em inspeção — e não chega, porque inspeção só
   * lê revisão publicada.
   */
  async saveDraft(
    templateId: string,
    conteudo: { rules: ApplicabilityRule[]; routingQuestions: RoutingQuestion[]; notes?: string | null }
  ): Promise<ApplicabilityRevision> {
    const existente = await this.getDraft(templateId);
    const payload = {
      rules: conteudo.rules,
      routing_questions: conteudo.routingQuestions,
      notes: conteudo.notes ?? null,
    };

    if (existente) {
      const { data, error } = await supabase
        .from('checklist_template_revisions')
        .update(payload)
        .eq('id', existente.id)
        .select(COLUNAS)
        .single();
      if (error) throw error;
      return mapRevisionRow(data as RevisionRow);
    }

    const tenantId = getActiveTenantId();
    if (!tenantId) throw new Error('Sem tenant ativo: não é possível salvar a revisão do roteiro.');

    const { data, error } = await supabase
      .from('checklist_template_revisions')
      .insert({ ...payload, template_id: templateId, tenant_id: tenantId })
      .select(COLUNAS)
      .single();
    if (error) throw error;
    return mapRevisionRow(data as RevisionRow);
  },

  /**
   * Publica o rascunho do roteiro. Valida contra a árvore de seções e itens recebida
   * — referência quebrada, ciclo, operador incompatível — e recusa a publicação
   * quando houver erro. Depois disso a revisão é imutável, inclusive no banco.
   */
  async publishDraft(template: ChecklistTemplate): Promise<ApplicabilityRevision> {
    const rascunho = await this.getDraft(template.id);
    if (!rascunho) throw new Error('Não há rascunho de condições para publicar neste roteiro.');

    const problemas = validateTemplateRules(toConditionalTemplate(template, rascunho))
      .filter((issue) => issue.severity === 'error');
    if (problemas.length > 0) throw new ApplicabilityValidationError(problemas);

    const { data, error } = await supabase
      .from('checklist_template_revisions')
      .update({ status: 'published' })
      .eq('id', rascunho.id)
      .select(COLUNAS)
      .single();
    if (error) throw error;
    return mapRevisionRow(data as RevisionRow);
  },

  /** Descarta o rascunho. Revisão publicada nunca é apagada (o banco recusa). */
  async discardDraft(templateId: string): Promise<void> {
    const rascunho = await this.getDraft(templateId);
    if (!rascunho) return;

    const { error } = await supabase
      .from('checklist_template_revisions')
      .delete()
      .eq('id', rascunho.id);
    if (error) throw error;
  },
};
