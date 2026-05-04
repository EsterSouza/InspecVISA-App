import { supabase } from '../lib/supabase';
import type { ChecklistTemplate, ClientCategory } from '../types';
import { templates as legacyTemplates } from '../data/templates';
import { templateIlpiGoias } from '../data/templates_ilpi_go';
import { alimentosTemplates } from '../data/templates_alimentos';
import { withTimeout } from '../utils/network';
import { db } from '../db/database';

interface RawImportItem {
  section?: string;
  description: string;
  legislation?: string;
  weight?: number;
  isCritical?: boolean;
}

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
    const { data, error } = await withTimeout<any>(
      supabase
        .from('checklist_templates')
        .select('*')
        .order('created_at', { ascending: false }),
      30000,
      'ListTemplates'
    );
    
    if (error) throw error;
    return data;
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

      const tpls = (tplsResult as any).data || [];
      const secs = (secsResult as any).data || [];

      if (!tpls.length) return [];

      // 2. Fetch items in section chunks to avoid one huge PostgREST request.
      const sectionIds = secs.map((s: any) => s.id).filter(Boolean);
      const items: any[] = [];
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

        const iError = (itemsResult as any).error;
        if (iError) throw iError;
        items.push(...((itemsResult as any).data || []));
      }

      // 3. Optimized mapping
      const itemsBySection = new Map<string, any[]>();
      items.forEach((i: any) => {
        const list = itemsBySection.get(i.section_id) || [];
        list.push(i);
        itemsBySection.set(i.section_id, list);
      });

      const sectionsByTemplate = new Map<string, any[]>();
      secs.forEach((s: any) => {
        const list = sectionsByTemplate.get(s.template_id) || [];
        list.push(s);
        sectionsByTemplate.set(s.template_id, list);
      });

      console.log(`[TemplateService] Successfully fetched ${tpls.length} templates from server.`);

      const verifiedAt = new Date();
      return tpls.map((t: any) => {
        const tSecs = (sectionsByTemplate.get(t.id) || []).sort((a: any, b: any) => a.order - b.order);
        const fullSecs = tSecs.map((sec: any) => {
          const sItems = (itemsBySection.get(sec.id) || []).sort((a: any, b: any) => a.order - b.order);
          return {
            id: sec.id,
            title: sec.title,
            order: sec.order,
            items: sItems.map((i: any) => ({
               id: i.id,
               description: i.description,
               legislation: i.legislation_name,
               weight: i.weight,
               isCritical: i.is_critical,
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
        .single();
      if (tError) throw tError;

      const { data: sections, error: sError } = await supabase
        .from('checklist_sections')
        .select('*')
        .eq('template_id', templateId)
        .order('order', { ascending: true })
        .abortSignal(controller.signal);
      if (sError) throw sError;

      // Bulk fetch all items for all sections in one request (instead of N+1)
      const sectionIds = sections.map((s: any) => s.id);
      const { data: allItems, error: iError } = sectionIds.length > 0
        ? await supabase
          .from('checklist_items')
          .select('*')
          .in('section_id', sectionIds)
          .order('order', { ascending: true })
          .abortSignal(controller.signal)
        : { data: [], error: null };
      if (iError) throw iError;

      const itemsBySection = new Map<string, any[]>();
      (allItems || []).forEach((i: any) => {
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
        sections: sections.map((sec: any) => ({
          id: sec.id,
          title: sec.title,
          order: sec.order,
          items: (itemsBySection.get(sec.id) || []).map((i: any) => ({
            id: i.id,
            description: i.description,
            legislation: i.legislation_name,
            weight: i.weight,
            isCritical: i.is_critical,
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
    const itemsToInsert: any[] = [];
    
    rawData.forEach(item => {
      const sectionTitle = item.section || 'Geral';
      const section = (createdSections as any[]).find((s: any) => s.title === sectionTitle);
      
      if (section) {
        itemsToInsert.push({
          section_id: section.id,
          description: item.description,
          legislation_name: item.legislation,
          weight: item.weight || 1,
          is_critical: item.isCritical || false,
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

  async _insertSectionsAndItems(templateId: string, sections: any[]) {
    const sectionsToInsert = sections.map((sec, idx) => ({
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

    const itemsToInsert: any[] = [];
    sections.forEach((sec, sIdx) => {
      const createdSec = createdSections[sIdx];
      if (createdSec && sec.items) {
        sec.items.forEach((item: any, iIdx: number) => {
          itemsToInsert.push({
            section_id: createdSec.id,
            description: item.description,
            legislation_name: item.legislation || item.legislation_name || null,
            weight: item.weight || 1,
            is_critical: item.isCritical || item.is_critical || false,
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
    sections: any[]
  ) {
    const isUsed = await this.checkTemplateUsage(templateId);

    if (isUsed) {
      // 1. Archive old template
      const { data: oldTpl } = await supabase.from('checklist_templates').select('name').eq('id', templateId).single();
      const oldName = oldTpl?.name || 'Template Original';
      
      await supabase
        .from('checklist_templates')
        .update({ name: `[ARQUIVADO] ${oldName}` })
        .eq('id', templateId);

      // 2. Create new template (cloning approach)
      // Extracts base name in case it already has an appended version
      const baseName = templateData.name.replace(/\s\(v\d+\)$/, '');
      const newVersionNum = parseInt(templateData.version || '1') + 1;
      const newName = `${baseName} (v${newVersionNum})`;

      const newTemplate = await this.createTemplate({
        name: newName,
        category: templateData.category,
        version: newVersionNum.toString()
      });

      // 3. Insert sections and items
      await this._insertSectionsAndItems(newTemplate.id, sections);
      return newTemplate;
    } else {
      // Safe to mutate directly
      // 1. Update Template
      await supabase
        .from('checklist_templates')
        .update({ 
          name: templateData.name, 
          category: templateData.category, 
          version: templateData.version || '1'
        })
        .eq('id', templateId);

      // 2. Clear old items and sections
      const { data: oldSections } = await supabase.from('checklist_sections').select('id').eq('template_id', templateId);
      if (oldSections && oldSections.length > 0) {
        const oldSectionIds = oldSections.map(s => s.id);
        await supabase.from('checklist_items').delete().in('section_id', oldSectionIds);
        await supabase.from('checklist_sections').delete().in('id', oldSectionIds);
      }

      // 3. Insert new sections and items
      await this._insertSectionsAndItems(templateId, sections);
      
      return { id: templateId, ...templateData };
    }
  },

  async seedLegacyTemplates() {
    console.log('Seeding legacy templates...');
    
    // Combine all legacy templates to seed
    const allLegacy = [
      ...legacyTemplates,
      templateIlpiGoias,
      ...alimentosTemplates
    ];

    // 1. Batch check existing names to avoid repeated queries
    const namesToCheck = allLegacy.map((t: any) => t.name);
    const { data: existingTemplates } = await supabase
      .from('checklist_templates')
      .select('name')
      .in('name', namesToCheck);
    
    const existingNames = new Set(existingTemplates?.map((t: any) => t.name) || []);
    const seeded = [];
    
    for (const tpl of allLegacy) {
      if (existingNames.has(tpl.name)) {
        console.log(`Template "${tpl.name}" already exists, skipping.`);
        continue;
      }

      console.log(`Seeding template: ${tpl.name}`);
      
      // We use our existing saveFullTemplate logic by mapping the legacy object to RawImportItem[]
      const rawItems = tpl.sections.flatMap((sec: any) => 
        sec.items.map((it: any) => ({
          section: sec.title,
          description: it.description,
          legislation: it.legislation,
          weight: it.weight,
          isCritical: it.isCritical
        }))
      );

      const result = await this.saveFullTemplate(tpl.name, tpl.category, rawItems);
      seeded.push(result);
    }

    return seeded;
  }
};
