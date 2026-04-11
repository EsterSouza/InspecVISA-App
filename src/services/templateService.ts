import { supabase } from '../lib/supabase';
import type { ChecklistTemplate, ClientCategory } from '../types';
import { templates as legacyTemplates } from '../data/templates';
import { templateIlpiGoias } from '../data/templates_ilpi_go';
import { alimentosTemplates } from '../data/templates_alimentos';

interface RawImportItem {
  section?: string;
  description: string;
  legislation?: string;
  weight?: number;
  isCritical?: boolean;
}

export const TemplateService = {
  async listTemplates() {
    const { data, error } = await supabase
      .from('checklist_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getFullTemplate(templateId: string): Promise<ChecklistTemplate> {
    // Fetch template
    const { data: template, error: tError } = await supabase
      .from('checklist_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (tError) throw tError;

    // Fetch sections
    const { data: sections, error: sError } = await supabase
      .from('checklist_sections')
      .select('*')
      .eq('template_id', templateId)
      .order('order', { ascending: true });
    
    if (sError) throw sError;

    // Fetch items for each section
    const fullSections = await Promise.all(
      sections.map(async (sec) => {
        const { data: items, error: iError } = await supabase
          .from('checklist_items')
          .select('*')
          .eq('section_id', sec.id)
          .order('order', { ascending: true });
        
        if (iError) throw iError;
        return { ...sec, items };
      })
    );

    return { ...template, sections: fullSections };
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
      const section = createdSections.find(s => s.title === sectionTitle);
      
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

  async seedLegacyTemplates() {
    console.log('Seeding legacy templates...');
    
    // Combine all legacy templates to seed
    const allLegacy = [
      ...legacyTemplates,
      templateIlpiGoias,
      ...alimentosTemplates
    ];

    // 1. Batch check existing names to avoid repeated queries
    const namesToCheck = allLegacy.map(t => t.name);
    const { data: existingTemplates } = await supabase
      .from('checklist_templates')
      .select('name')
      .in('name', namesToCheck);
    
    const existingNames = new Set(existingTemplates?.map(t => t.name) || []);
    const seeded = [];
    
    for (const tpl of allLegacy) {
      if (existingNames.has(tpl.name)) {
        console.log(`Template "${tpl.name}" already exists, skipping.`);
        continue;
      }

      console.log(`Seeding template: ${tpl.name}`);
      
      // We use our existing saveFullTemplate logic by mapping the legacy object to RawImportItem[]
      const rawItems = tpl.sections.flatMap(sec => 
        sec.items.map(it => ({
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
