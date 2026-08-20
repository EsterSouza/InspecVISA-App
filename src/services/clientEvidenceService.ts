import { supabase } from '../lib/supabase';
import type { ClientActionEvidenceStatus } from '../types';

/**
 * REL-03 — a evidência do cliente chega até a vistoria seguinte e até o relatório final.
 *
 * O elo entre os dois mundos é o `source_item_id` de `client_action_items`: ele é o id do item
 * do roteiro, o mesmo `itemId` das respostas da inspeção. Por isso dá para casar o que o cliente
 * alegou com o requisito que a consultora está avaliando agora, sem inventar chave nova.
 *
 * Isto roda **online**, com sessão de staff (a RLS de `client_action_evidence` já permite a
 * leitura para o tenant). A execução da inspeção é offline-first, então quem chama trata a
 * falha como "não tem evidência para mostrar" — nunca como erro que impede a vistoria.
 */

export interface ClientEvidenceForItem {
  /** `source_item_id` do plano de ação = id do item do roteiro. */
  itemId: string;
  evidenceId: string;
  status: ClientActionEvidenceStatus;
  fileName: string;
  mimeType: string;
  clientNote: string | null;
  reviewNote: string | null;
  byName: string | null;
  byRole: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  storageBucket: string;
  storagePath: string;
  /** Situação do item do plano quando a evidência foi buscada. */
  itemStatus: 'hidden' | 'published' | 'resolved';
  /** Só preenchido em `prepareForReport`, e só para imagem aprovada. */
  imageDataUrl?: string;
}

export type ClientEvidenceByItem = Map<string, ClientEvidenceForItem[]>;

/** PORT-03 — o que o cliente declarou sobre o item, mesmo sem ter anexado nada. */
export interface ClientDeclarationForItem {
  itemId: string;
  status: 'done' | 'in_progress' | 'not_done';
  note: string | null;
  at: string | null;
  byName: string | null;
  byRole: string | null;
}

export type ClientDeclarationByItem = Map<string, ClientDeclarationForItem>;

/**
 * PORT-05 — cada tópico da ação corretiva e o que o cliente marcou nele.
 *
 * É o que muda a conversa na porta da casa: em vez de "o cliente disse que está
 * providenciando", ela chega sabendo que dois dos três pontos foram feitos e qual é o que
 * ficou. O casamento continua sendo pelo `source_item_id`, igual ao resto deste serviço.
 */
export interface ClientCheckpointForItem {
  itemId: string;
  checkpointId: string;
  text: string;
  done: boolean;
  doneAt: string | null;
  doneByName: string | null;
}

export type ClientCheckpointByItem = Map<string, ClientCheckpointForItem[]>;

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export const ClientEvidenceService = {
  /**
   * O que este cliente respondeu sobre o plano de ação, pelo item do roteiro: as evidências que
   * anexou (mais recente primeiro), a situação que declarou e os tópicos que marcou um a um.
   * As três coisas vêm juntas porque saem da mesma consulta e são lidas juntas — na vistoria
   * e no relatório.
   */
  async byItemForClient(clientId: string): Promise<{
    evidence: ClientEvidenceByItem;
    declarations: ClientDeclarationByItem;
    checkpoints: ClientCheckpointByItem;
  }> {
    const byItem: ClientEvidenceByItem = new Map();
    const lastDeclarations: ClientDeclarationByItem = new Map();
    const byCheckpoint: ClientCheckpointByItem = new Map();
    if (!clientId) return { evidence: byItem, declarations: lastDeclarations, checkpoints: byCheckpoint };

    const { data: items, error: itemsError } = await supabase
      .from('client_action_items')
      .select('id, source_item_id, status, client_status, client_status_note, client_status_at, client_status_by_name, client_status_by_role')
      .eq('client_id', clientId);
    if (itemsError) throw itemsError;
    if (!items || items.length === 0) return { evidence: byItem, declarations: lastDeclarations, checkpoints: byCheckpoint };

    const bySourceItem = new Map<string, { sourceItemId: string; status: ClientEvidenceForItem['itemStatus'] }>();
    for (const item of items) {
      bySourceItem.set(item.id as string, {
        sourceItemId: item.source_item_id as string,
        status: item.status as ClientEvidenceForItem['itemStatus'],
      });
      if (item.client_status) {
        lastDeclarations.set(item.source_item_id as string, {
          itemId: item.source_item_id as string,
          status: item.client_status as ClientDeclarationForItem['status'],
          note: (item.client_status_note as string) || null,
          at: (item.client_status_at as string) || null,
          byName: (item.client_status_by_name as string) || null,
          byRole: (item.client_status_by_role as string) || null,
        });
      }
    }

    const { data: rows, error: evidenceError } = await supabase
      .from('client_action_evidence')
      .select('id, action_item_id, status, file_name, mime_type, client_note, review_note, submitted_by_name, submitted_by_role, submitted_at, reviewed_at, storage_bucket, storage_path')
      .in('action_item_id', [...bySourceItem.keys()])
      .order('submitted_at', { ascending: false });
    if (evidenceError) throw evidenceError;

    for (const row of rows || []) {
      const parent = bySourceItem.get(row.action_item_id as string);
      if (!parent) continue;
      const current = byItem.get(parent.sourceItemId) || [];
      current.push({
        itemId: parent.sourceItemId,
        evidenceId: row.id as string,
        status: row.status as ClientActionEvidenceStatus,
        fileName: row.file_name as string,
        mimeType: (row.mime_type as string) || '',
        clientNote: (row.client_note as string) || null,
        reviewNote: (row.review_note as string) || null,
        byName: (row.submitted_by_name as string) || null,
        byRole: (row.submitted_by_role as string) || null,
        submittedAt: row.submitted_at as string,
        reviewedAt: (row.reviewed_at as string) || null,
        storageBucket: (row.storage_bucket as string) || 'client-action-evidence',
        storagePath: row.storage_path as string,
        itemStatus: parent.status,
      });
      byItem.set(parent.sourceItemId, current);
    }

    // PORT-05 — os tópicos de cada pendência, com o que o cliente marcou. Os retirados
    // (`dropped_at`) ficam de fora: não são mais o que ela apontou.
    const { data: checkpointRows, error: checkpointError } = await supabase
      .from('client_action_checkpoints')
      .select('id, action_item_id, text, ordinal, done_at, done_by_name')
      .in('action_item_id', [...bySourceItem.keys()])
      .is('dropped_at', null)
      .order('ordinal', { ascending: true });
    if (checkpointError) throw checkpointError;

    for (const row of checkpointRows || []) {
      const parent = bySourceItem.get(row.action_item_id as string);
      if (!parent) continue;
      const current = byCheckpoint.get(parent.sourceItemId) || [];
      current.push({
        itemId: parent.sourceItemId,
        checkpointId: row.id as string,
        text: row.text as string,
        done: !!row.done_at,
        doneAt: (row.done_at as string) || null,
        doneByName: (row.done_by_name as string) || null,
      });
      byCheckpoint.set(parent.sourceItemId, current);
    }

    return { evidence: byItem, declarations: lastDeclarations, checkpoints: byCheckpoint };
  },

  async reconcileInspection(inspectionId: string, confirmedEvidenceIds: string[]) {
    const { data, error } = await supabase.rpc('admin_reconcile_inspection_action_plan', {
      p_inspection_id: inspectionId,
      p_confirmed_evidence_ids: confirmedEvidenceIds,
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Falha ao reconciliar o plano de ação.');
    return data as {
      ok: boolean;
      approvedEvidenceCount: number;
      resolvedItemCount: number;
    };
  },

  /** URL temporária para abrir o arquivo na tela. Expira; basta pedir de novo. */
  async signedUrl(evidence: Pick<ClientEvidenceForItem, 'storageBucket' | 'storagePath'>): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(evidence.storageBucket)
      .createSignedUrl(evidence.storagePath, 3600);
    if (error) {
      console.warn('[ClientEvidence] Falha ao assinar a URL da evidencia:', error);
      return null;
    }
    return data?.signedUrl || null;
  },

  /**
   * Baixa a imagem e devolve como data URL, que é o formato que o jsPDF aceita.
   *
   * **Só imagem aprovada entra no PDF** (decisão da Ester): o relatório de ILPI já é pesado com
   * as fotos da consultora, e o que sustenta o laudo é a prova aceita. O que foi devolvido ou
   * ainda está em análise entra como registro de texto, não como figura.
   */
  async imageDataUrl(evidence: ClientEvidenceForItem): Promise<string | null> {
    if (!isImage(evidence.mimeType)) return null;
    try {
      const url = await this.signedUrl(evidence);
      if (!url) return null;
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('[ClientEvidence] Falha ao carregar a imagem da evidencia:', err);
      return null;
    }
  },

  /**
   * Prepara o material do relatório: para cada item, o registro textual de tudo que o cliente
   * enviou, e a imagem embutida apenas do que foi aprovado.
   */
  async prepareForReport(clientId: string): Promise<{
    evidence: ClientEvidenceByItem;
    declarations: ClientDeclarationByItem;
  }> {
    const result = await this.byItemForClient(clientId);
    for (const list of result.evidence.values()) {
      for (const evidence of list) {
        if (evidence.status !== 'approved') continue;
        const dataUrl = await this.imageDataUrl(evidence);
        if (dataUrl) evidence.imageDataUrl = dataUrl;
      }
    }
    return result;
  },
};
