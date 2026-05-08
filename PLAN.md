# Plano: Sync SaaS Online-First Sem Perder Dados

## Summary
- Manter Vercel + React + Supabase; não migrar para app nativo.
- Trocar o sync fragmentado do navegador por uma operação transacional no Supabase.
- Preservar dados existentes: migrations só aditivas, sem `DELETE`, sem `TRUNCATE`, sem reset de Dexie, sem apagar templates.
- Antes da primeira sync nova, gerar backup local automático dos dados atuais.

## Key Changes
- Adicionar migration aditiva:
  - Nova tabela `inspection_report_versions` para snapshots de relatórios finalizados.
  - Nova tabela `sync_batches` para registrar tentativas, status e erro por inspeção.
  - Nova função/RPC `sync_inspection_bundle(payload jsonb)` que valida tenant, salva inspeção, respostas e metadados de fotos em transação.
  - Policies RLS novas apenas para tabelas novas.

- Alterar frontend:
  - Dexie continua como rascunho/cache local.
  - Respostas continuam salvando localmente rápido.
  - Cloud sync passa a enviar bundle por inspeção, não upserts independentes por resposta.
  - Finalização de relatório exige conexão e cria snapshot.
  - Se offline, mostrar “rascunho local aguardando conexão”; não marcar como sincronizado.

- Proteger dados/templates:
  - Não alterar `checklist_templates`, `checklist_sections` ou `checklist_items` nesta etapa.
  - Não limpar `db.templates`.
  - Não migrar IDs antigos.
  - Não remover backups existentes.
  - Antes de ativar o novo sync, criar backup local automático com clientes, inspeções, respostas, fotos, agendamentos e templates cacheados.

## Public Interfaces / Types
- Novo payload do cliente:
  - `inspection`
  - `responses`
  - `photos`
  - `clientSyncId`
  - `finalizeReport: boolean`
- Nova resposta do servidor:
  - `ok`
  - `inspectionId`
  - `syncBatchId`
  - `serverUpdatedAt`
  - `reportVersionId`
  - `failedItems`
- Novo status local:
  - Manter `pending`, `syncing`, `synced`, `failed`, `conflict`.
  - Adicionar uso semântico de `syncError` para erro do bundle inteiro.

## Implementation Steps
- Criar migration aditiva com tabelas/função/RLS.
- Criar serviço `InspectionBundleSyncService` no frontend.
- Adaptar `SyncQueueService` para:
  - Agrupar por inspeção.
  - Enviar inspeção pai + respostas + fotos em um bundle.
  - Só marcar filhos como `synced` após confirmação do bundle.
- Adaptar finalização do relatório:
  - Chamar bundle com `finalizeReport: true`.
  - Usar snapshot salvo para PDF/resumo quando existir.
- Adicionar backup automático local:
  - Rodar uma vez antes da primeira chamada ao novo bundle.
  - Registrar flag local `inspecvisa-pre-bundle-backup-created`.
- Manter fallback temporário:
  - Se RPC falhar por indisponibilidade, não apagar nada.
  - Deixar itens como `pending/failed` e exibir na Central de Sincronização.

## Test Plan
- Build e testes de serviços.
- Criar inspeção nova e sincronizar bundle completo.
- Editar várias respostas e confirmar uma única operação por inspeção.
- Finalizar relatório e confirmar criação de snapshot.
- Reabrir relatório após limpar cache local e confirmar leitura do snapshot remoto.
- Simular inspeção pai ausente e confirmar recriação sem perder respostas.
- Simular offline e confirmar que dados ficam locais como rascunho, sem falso “sincronizado”.
- Confirmar que templates existentes continuam visíveis e não são alterados.

## Assumptions
- Supabase continua sendo backend principal.
- Custo mínimo: sem servidor dedicado externo.
- Migrations serão somente aditivas.
- Online-first: finalizar relatório exige internet.
- Dados antigos permanecem no formato atual e serão lidos normalmente.
- Templates existentes não entram no escopo de mudança.
