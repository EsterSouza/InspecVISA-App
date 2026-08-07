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

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export const ClientEvidenceService = {
  /**
   * Todas as evidências que este cliente já enviou, agrupadas pelo item do roteiro. Mais
   * recente primeiro dentro de cada item.
   */
  async byItemForClient(clientId: string): Promise<ClientEvidenceByItem> {
    const byItem: ClientEvidenceByItem = new Map();
    if (!clientId) return byItem;

    const { data: items, error: itemsError } = await supabase
      .from('client_action_items')
      .select('id, source_item_id, status')
      .eq('client_id', clientId);
    if (itemsError) throw itemsError;
    if (!items || items.length === 0) return byItem;

    const bySourceItem = new Map<string, { sourceItemId: string; status: ClientEvidenceForItem['itemStatus'] }>();
    for (const item of items) {
      bySourceItem.set(item.id as string, {
        sourceItemId: item.source_item_id as string,
        status: item.status as ClientEvidenceForItem['itemStatus'],
      });
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

    return byItem;
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
  async prepareForReport(clientId: string): Promise<ClientEvidenceByItem> {
    const byItem = await this.byItemForClient(clientId);
    for (const list of byItem.values()) {
      for (const evidence of list) {
        if (evidence.status !== 'approved') continue;
        const dataUrl = await this.imageDataUrl(evidence);
        if (dataUrl) evidence.imageDataUrl = dataUrl;
      }
    }
    return byItem;
  },
};
