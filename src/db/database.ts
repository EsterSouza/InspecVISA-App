import Dexie, { type Table } from 'dexie';
import type {
  Client,
  ChecklistTemplate,
  Inspection,
  InspectionResponse,
  InspectionPhoto,
  Schedule,
} from '../types';

export class InspectionDatabase extends Dexie {
  clients!: Table<Client>;
  templates!: Table<ChecklistTemplate>;
  inspections!: Table<Inspection>;
  responses!: Table<InspectionResponse>;
  photos!: Table<InspectionPhoto>;
  schedules!: Table<Schedule>;

  constructor() {
    super('InspectionDB');
    this.version(4).stores({
      clients:     'id, category, name, city, state, createdAt',
      templates:   'id, category',
      inspections: 'id, clientId, templateId, status, [clientId+status], inspectionDate, completedAt, createdAt',
      responses:   'id, inspectionId, itemId, result',
      photos:      'id, responseId',
      schedules:   'id, clientId, scheduledAt, status'
    });
  }
}

export const db = new InspectionDatabase();

// Initialize templates seed on first load
export async function initializeDatabase(templates: ChecklistTemplate[]) {
  // Use bulkPut to avoid BulkError if IDs already exist
  await db.templates.bulkPut(templates);
}
