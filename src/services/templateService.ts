import { supabase } from '../lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import type { ChecklistTemplate, ClientCategory } from '../types';
import { templates as legacyTemplates } from '../data/templates';
import { withTimeout } from '../utils/network';
import { db } from '../db/database';

export interface RawImportItem {
  section?: string;
  description: string;
  legislation?: string;
  legislationUrl?: string;
  weight?: number;
  isCritical?: boolean;
  requirementType?: 'legal' | 'good_practice';
}

/**
 * Linhas das três tabelas do roteiro, como o PostgREST devolve. Sem tipos gerados do
 * Supabase (DEBT-02), o contrato mora aqui — e é o mesmo que os mapeadores abaixo leem.
 */
interface TemplateRow {
  id: string;
  name: string;
  category: ClientCategory;
  version: string | null;
}

interface SectionRow {
  id: string;
  template_id: string;
  title: string;
  order: number;
}

interface ItemRow {
  id: string;
  section_id: string;
  description: string;
  legislation_name: string | null;
  legislation_url: string | null;
  weight: number | null;
  is_critical: boolean | null;
  requirement_type: 'legal' | 'good_practice' | null;
  /** Decisão 21 (FE-17b): item aposentado sai das próximas inspeções, não das em andamento. */
  retired_at: string | null;
  order: number;
}

/** Resposta do PostgREST para uma consulta de lista. */
type Resposta<Row> = { data: Row[] | null; error: PostgrestError | null };

/**
 * Seção/item **como o editor manda**, que não é a mesma forma que sai do banco: o mesmo
 * campo pode chegar em camelCase (roteiro local) ou snake_case (linha remota), e o código
 * lê os dois com `||`. Estava tudo como `any`, o que escondia justamente essa duplicidade.
 */
interface ItemInput {
  id?: string;
  description: string;
  legislation?: string;
  legislation_name?: string;
  legislationUrl?: string;
  legislation_url?: string;
  weight?: number;
  isCritical?: boolean;
  is_critical?: boolean;
  requirementType?: string;
  requirement_type?: string;
  retiredAt?: string | null;
  retired_at?: string | null;
  order?: number;
}

interface SectionInput {
  id?: string;
  title?: string;
  order?: number;
  items?: ItemInput[];
}

/** O que vai para o `insert` de `checklist_items` (o id só aparece quando é uuid existente). */
type ItemInsert = {
  id?: string;
  section_id: string;
  description: string;
  // `undefined` aqui significa coluna omitida no insert, que e o que o codigo sempre fez;
  // trocar por `null` explicito mudaria o payload enviado.
  legislation_name: string | null | undefined;
  legislation_url: string | null;
  weight: number;
  is_critical: boolean;
  requirement_type: string;
  retired_at?: string | null;
  order: number;
};

const TEMPLATE_SYNC_TIMEOUT_MS = 45000;
const ITEM_SECTION_CHUNK_SIZE = 100;
const TEMPLATE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export const TemplateService = {
  async listTemplates() {
    const { data, error } = await withTimeout<Resposta<TemplateRow>>(
      supabase
        .from('checklist_templates')
        .select('*')
        .order('created_at', { ascending: false }),
      30000,
      'ListTemplates'
    );
    
    if (error) throw error;
    // Nunca devolve null: quem chama guarda direto numa lista.
    return data ?? [];
  },

  async syncAllTemplatesToDexie(): Promise<ChecklistTemplate[]> {
    try {
      // TTL guard: if templates were verified recently, serve from Dexie cache
      try {
        const cached = await db.templates.toArray();
        const verifiedTimes = cached
          .map((template: ChecklistTemplate) => template.dataVerifiedAt ? new Date(template.dataVerifiedAt).getTime() : 0)
          .filter((time: number) => Number.isFinite(time) && time > 0);
        const newestVerified = verifiedTimes.length > 0 ? Math.max(...verifiedTimes) : 0;

        if (cached.length > 0 && newestVerified && Date.now() - newestVerified < TEMPLATE_TTL_MS) {
          console.log('[TemplateService] Templates are fresh (< 30 min), skipping remote sync.');
          return cached;
        }
      } catch {
        // No templates in Dexie yet — proceed with full sync
      }

      console.log('[TemplateService] Starting background sync of templates...');

      // 1. Fetch templates and sections with abortable timeouts.
      const [tplsResult, secsResult] = await Promise.all([
        withTimeout(
          supabase.from('checklist_templates').select('*'),
          TEMPLATE_SYNC_TIMEOUT_MS,
          'SyncTemplates'
        ),
        withTimeout(
          supabase.from('checklist_sections').select('*'),
          TEMPLATE_SYNC_TIMEOUT_MS,
          'SyncSections'
        )
      ]);

      const tpls = (tplsResult as Resposta<TemplateRow>).data || [];
      const secs = (secsResult as Resposta<SectionRow>).data || [];

      if (!tpls.length) return [];

      // 2. Fetch items in section chunks to avoid one huge PostgREST request.
      const sectionIds = secs.map((s) => s.id).filter(Boolean);
      const items: ItemRow[] = [];
      for (const [index, ids] of chunkArray(sectionIds, ITEM_SECTION_CHUNK_SIZE).entries()) {
        const itemsResult = await withTimeout(
          supabase
            .from('checklist_items')
            .select('*')
            .in('section_id', ids)
            .order('order', { ascending: true }),
          TEMPLATE_SYNC_TIMEOUT_MS,
          `SyncItems chunk ${index + 1}`
        );

        const { data: chunkItems, error: iError } = itemsResult as Resposta<ItemRow>;
        if (iError) throw iError;
        items.push(...(chunkItems || []));
      }

      // 3. Optimized mapping
      const itemsBySection = new Map<string, ItemRow[]>();
      items.forEach((i) => {
        const list = itemsBySection.get(i.section_id) || [];
        list.push(i);
        itemsBySection.set(i.section_id, list);
      });

      const sectionsByTemplate = new Map<string, SectionRow[]>();
      secs.forEach((s) => {
        const list = sectionsByTemplate.get(s.template_id) || [];
        list.push(s);
        sectionsByTemplate.set(s.template_id, list);
      });

      console.log(`[TemplateService] Successfully fetched ${tpls.length} templates from server.`);

      const verifiedAt = new Date();
      return tpls.map((t) => {
        const tSecs = (sectionsByTemplate.get(t.id) || []).sort((a, b) => a.order - b.order);
        const fullSecs = tSecs.map((sec) => {
          const sItems = (itemsBySection.get(sec.id) || []).sort((a, b) => a.order - b.order);
          return {
            id: sec.id,
            title: sec.title,
            order: sec.order,
            items: sItems.map((i) => ({
               id: i.id,
               description: i.description,
               legislation: i.legislation_name,
               legislationUrl: i.legislation_url,
               weight: i.weight,
               isCritical: i.is_critical,
               requirementType: i.requirement_type,
               retiredAt: i.retired_at,
               order: i.order
            }))
          };
        });
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          version: t.version,
          dataVerifiedAt: verifiedAt,
          sections: fullSecs
        } as ChecklistTemplate;
      });
    } catch (err) {
      console.warn('[TemplateService] Failed to sync full remote templates:', err);
      return [];
    }
  },

  async getFullTemplate(templateId: string): Promise<ChecklistTemplate> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEMPLATE_SYNC_TIMEOUT_MS);

    try {
      const { data: template, error: tError } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('id', templateId)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (tError) throw tError;
      // Templates locais/estáticos (ex.: tpl-ilpi-v1) não existem no remoto —
      // sinaliza ausência limpa para o chamador usar a versão local.
      if (!template) throw new Error(`Template ${templateId} não encontrado no remoto`);

      const { data: sections, error: sError } = await supabase
        .from('checklist_sections')
        .select('*')
        .eq('template_id', templateId)
        .order('order', { ascending: true })
        .abortSignal(controller.signal);
      if (sError) throw sError;

      // Bulk fetch all items for all sections in one request (instead of N+1)
      const sectionIds = (sections as SectionRow[]).map((s) => s.id);
      const { data: allItems, error: iError } = sectionIds.length > 0
        ? await supabase
          .from('checklist_items')
          .select('*')
          .in('section_id', sectionIds)
          .order('order', { ascending: true })
          .abortSignal(controller.signal)
        : { data: [], error: null };
      if (iError) throw iError;

      const itemsBySection = new Map<string, ItemRow[]>();
      ((allItems || []) as ItemRow[]).forEach((i) => {
        const list = itemsBySection.get(i.section_id) || [];
        list.push(i);
        itemsBySection.set(i.section_id, list);
      });

      return {
        id: template.id,
        name: template.name,
        category: template.category,
        version: template.version,
        dataVerifiedAt: new Date(),
        sections: (sections as SectionRow[]).map((sec) => ({
          id: sec.id,
          title: sec.title,
          order: sec.order,
          items: (itemsBySection.get(sec.id) || []).map((i) => ({
            id: i.id,
            description: i.description,
            legislation: i.legislation_name,
            legislationUrl: i.legislation_url,
            weight: i.weight,
            isCritical: i.is_critical,
            requirementType: i.requirement_type,
            retiredAt: i.retired_at,
            order: i.order
          }))
        }))
      } as ChecklistTemplate;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async createTemplate(template: Omit<ChecklistTemplate, 'id' | 'sections'>) {
    const { data, error } = await supabase
      .from('checklist_templates')
      .insert(template)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async saveFullTemplate(templateName: string, category: ClientCategory, rawData: RawImportItem[]) {
    // 1. Create Template
    const template = await this.createTemplate({ name: templateName, category, version: new Date().getFullYear().toString() });

    // 2. Prepare Unique Sections
    const sectionTitles = Array.from(new Set(rawData.map(it => it.section || 'Geral')));
    const sectionsToInsert = sectionTitles.map((title, idx) => ({
      template_id: template.id,
      title,
      order: idx + 1
    }));

    // 3. Batch insert sections and get IDs
    const { data: createdSections, error: sError } = await supabase
      .from('checklist_sections')
      .insert(sectionsToInsert)
      .select();
    
    if (sError) throw sError;
    if (!createdSections) throw new Error('Failed to create sections');

    // 4. Prepare all items for batch insertion
    const itemsToInsert: ItemInsert[] = [];
    
    rawData.forEach(item => {
      const sectionTitle = item.section || 'Geral';
      const section = (createdSections as SectionRow[]).find((s) => s.title === sectionTitle);
      
      if (section) {
        itemsToInsert.push({
          section_id: section.id,
          description: item.description,
          legislation_name: item.legislation,
          legislation_url: item.legislationUrl || null,
          weight: item.weight || 1,
          is_critical: item.isCritical || false,
          requirement_type: item.requirementType || 'legal',
          order: itemsToInsert.filter(it => it.section_id === section.id).length + 1
        });
      }
    });

    // 5. Batch insert all items in chunks of 50 (Supabase/PostgREST limit friendly)
    const chunkSize = 50;
    for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
      const chunk = itemsToInsert.slice(i, i + chunkSize);
      const { error: iError } = await supabase
        .from('checklist_items')
        .insert(chunk);
      
      if (iError) throw iError;
    }

    return template;
  },

  /** Quantas inspeções (não excluídas) usam cada roteiro — para o aviso da coluna "Em uso" antes do clique de editar. */
  async getUsageCounts(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('inspections')
      .select('template_id')
      .is('deleted_at', null);

    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const row of data || []) {
      if (!row.template_id) continue;
      counts[row.template_id] = (counts[row.template_id] || 0) + 1;
    }
    return counts;
  },

  /**
   * Quantas respostas de inspeções EM ANDAMENTO (não concluídas, não excluídas) existem para
   * cada item — usado no editor para avisar antes de reescrever a pergunta (decisão 21).
   * Respostas de inspeções concluídas não entram: relatório publicado usa snapshot (REF-06) e
   * não é afetado por edição do roteiro vivo. Busca as inspeções em andamento PRIMEIRO (conjunto
   * pequeno) e só depois as respostas — na ordem inversa, um roteiro muito usado (com anos de
   * respostas de inspeção já concluída) estoura o limite padrão de linhas do PostgREST antes do
   * filtro em JS rodar, e itens somem da contagem sem erro nenhum aparecer. Duas consultas em vez
   * de embed: responses.item_id e responses.inspection_id não têm FK declarada.
   */
  async getOpenResponseCounts(itemIds: string[]): Promise<Record<string, number>> {
    if (itemIds.length === 0) return {};

    const { data: openInspections, error: iError } = await supabase
      .from('inspections')
      .select('id')
      .eq('status', 'in_progress')
      .is('deleted_at', null);
    if (iError) throw iError;
    const inspectionIds = (openInspections || []).map((i) => i.id);
    if (inspectionIds.length === 0) return {};

    const { data: rows, error } = await supabase
      .from('responses')
      .select('item_id, inspection_id')
      .in('item_id', itemIds)
      .in('inspection_id', inspectionIds)
      .is('deleted_at', null);
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of rows || []) {
      counts[row.item_id] = (counts[row.item_id] || 0) + 1;
    }
    return counts;
  },

  async checkTemplateUsage(templateId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('inspections')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', templateId);
    
    if (error) {
      console.warn('[TemplateService] checkTemplateUsage error (assuming true to be safe):', error);
      return true; // Safer to clone if we can't verify
    }
    return (count && count > 0) ? true : false;
  },

  _isUuid(v: unknown): boolean {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  },

  async _insertSectionsAndItems(templateId: string, sections: SectionInput[]) {
    // Preserva o id de seções/itens já existentes (uuid) para NÃO quebrar
    // o vínculo com respostas de inspeções; só gera id novo para itens novos.
    const sectionsToInsert = sections.map((sec, idx) => ({
      ...(this._isUuid(sec.id) ? { id: sec.id } : {}),
      template_id: templateId,
      title: sec.title || 'Nova Seção',
      order: sec.order ?? (idx + 1)
    }));

    const { data: createdSections, error: sError } = await supabase
      .from('checklist_sections')
      .insert(sectionsToInsert)
      .select();

    if (sError) throw sError;
    if (!createdSections) throw new Error('Failed to create sections');

    const itemsToInsert: ItemInsert[] = [];
    sections.forEach((sec, sIdx) => {
      const createdSec = createdSections[sIdx];
      if (createdSec && sec.items) {
        sec.items.forEach((item, iIdx) => {
          itemsToInsert.push({
            ...(this._isUuid(item.id) ? { id: item.id } : {}),
            section_id: createdSec.id,
            description: item.description,
            legislation_name: item.legislation || item.legislation_name || null,
            legislation_url: item.legislationUrl || item.legislation_url || null,
            weight: item.weight || 1,
            is_critical: item.isCritical || item.is_critical || false,
            requirement_type: item.requirementType || item.requirement_type || 'legal',
            retired_at: item.retiredAt ?? item.retired_at ?? null,
            order: item.order ?? (iIdx + 1)
          });
        });
      }
    });

    if (itemsToInsert.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
        const chunk = itemsToInsert.slice(i, i + chunkSize);
        const { error: iError } = await supabase.from('checklist_items').insert(chunk);
        if (iError) throw iError;
      }
    }
  },

  async updateFullTemplate(
    templateId: string, 
    templateData: { name: string; category: ClientCategory; version?: string },
    sections: SectionInput[]
  ) {
    // Edição SEMPRE no lugar (mesmo id), preservando os ids dos itens existentes.
    // Antes, roteiros EM USO eram arquivados e clonados numa nova versão — o que
    // trocava o roteiro ativo e, partindo de um cache stale, perdia edições.
    // Relatórios concluídos usam o snapshot do roteiro (reportTemplateSnapshot),
    // então não são afetados por edições posteriores ao roteiro vivo.
    await supabase
      .from('checklist_templates')
      .update({
        name: templateData.name,
        category: templateData.category,
        version: templateData.version || '1'
      })
      .eq('id', templateId);

    const { data: oldSections } = await supabase.from('checklist_sections').select('id').eq('template_id', templateId);
    if (oldSections && oldSections.length > 0) {
      const oldSectionIds = oldSections.map(s => s.id);
      await supabase.from('checklist_items').delete().in('section_id', oldSectionIds);
      await supabase.from('checklist_sections').delete().in('id', oldSectionIds);
    }

    await this._insertSectionsAndItems(templateId, sections);
    return { id: templateId, ...templateData };
  },

  async seedLegacyTemplates() {
    console.log('Seeding legacy templates...');
    
    // The static catalog is the source of truth, including the two estética templates.
    const allLegacy = [
      ...legacyTemplates,
    ];

    // 1. Batch check existing names to avoid repeated queries
    const namesToCheck = allLegacy.map((t) => t.name);
    const { data: existingTemplates } = await supabase
      .from('checklist_templates')
      .select('name')
      .in('name', namesToCheck);
    
    const existingNames = new Set((existingTemplates || []).map((t: { name: string }) => t.name));
    const seeded = [];
    
    for (const tpl of allLegacy) {
      if (existingNames.has(tpl.name)) {
        console.log(`Template "${tpl.name}" already exists, skipping.`);
        continue;
      }

      console.log(`Seeding template: ${tpl.name}`);
      
      // We use our existing saveFullTemplate logic by mapping the legacy object to RawImportItem[]
      const rawItems = tpl.sections.flatMap((sec) => 
        sec.items.map((it) => ({
          section: sec.title,
          description: it.description,
          legislation: it.legislation,
          legislationUrl: it.legislationUrl,
          weight: it.weight,
          isCritical: it.isCritical,
          requirementType: it.requirementType
        }))
      );

      const result = await this.saveFullTemplate(tpl.name, tpl.category, rawItems);
      seeded.push(result);
    }

    return seeded;
  }
};
