# Handoff técnico — Portal do Cliente e Agenda da Consultoria 360º

**Projeto:** InspecVISA

**Repositório:** `EsterSouza/InspecVISA-App`

**Checkout analisado:** `C:\Users\miche\OneDrive - MSFT\TreinaVISA\App`

**Branch e referência:** `main` em `f86e360` (`origin/main` igual após `git fetch origin`)

**Data do handoff:** 01/08/2026 (BRT)

**Estado:** planejamento aprovado para documentação; nenhuma melhoria deste plano foi implementada, migrada ou publicada.

## 1. Objetivo

Evoluir o Portal do Cliente de um painel majoritariamente consultivo para uma área de trabalho da consultoria 360º, mantendo o InspecVISA como fonte de verdade técnica para clientes, inspeções, relatórios, fotos, planos de ação e agenda.

O trabalho está dividido em quatro blocos:

1. Acessos rápidos e documentos do cliente.
2. Agenda multiuso para inspeções, reuniões, orientações e treinamentos.
3. Acompanhamento colaborativo da consultoria 360º.
4. Acessibilidade, testes, manutenção e prova de publicação.

Os cards executáveis estão em [CARDS.md](./CARDS.md).

## 2. Decisões já consolidadas

### 2.1 Dois destinos de Drive, com funções diferentes

- **Pasta Principal Completa do Cliente:** uma pasta raiz da empresa/rede, configurada na conta do portal. Deve ser o primeiro acesso documental.
- **Pasta Sanitária Personalizada:** já existe e continua vinculada à unidade (`clients`). Pode haver uma por unidade.
- Um botão não substitui o outro.
- Se a conta possuir várias unidades, o portal mostra um único botão para a pasta principal e botões identificados por unidade para as pastas personalizadas.
- URLs ausentes ou inválidas não devem produzir botões quebrados.

### 2.2 Tutorial do portal

- O tutorial será inicialmente um PDF global por tenant, versionado e configurável sem novo deploy.
- O portal mostrará `Abrir tutorial do portal (PDF)` em Acessos rápidos.
- O clique deve entrar na auditoria do portal.

### 2.3 Texto do agendamento

- O CTA principal será **Agendar horário com as consultoras**.
- A página não pode apenas trocar “inspeção” por “reunião”: primeiro deverá perguntar o tipo de compromisso e aplicar regras próprias.

### 2.4 Agenda multiuso sem contaminar inspeções

- Registros legados permanecem `inspection` por compatibilidade.
- Somente compromissos do tipo inspeção podem criar/vincular uma inspeção, exigir endereço de atendimento, mostrar prazo de relatório e usar a linha do tempo sanitária.
- Reuniões, orientações e treinamentos não podem gerar inspeções vazias, prazo de relatório ou status sanitários.
- O cliente solicita o horário; a equipe confirma e atribui consultora(s).

### 2.5 Colaboração no plano de ação

- O cliente nunca edita diretamente `responses`, checklists ou o relatório técnico já publicado.
- Itens destinados ao portal são publicados numa projeção própria e auditável.
- Evidências enviadas pelo cliente passam por análise das consultoras antes de um item ser considerado resolvido.

### 2.6 Limites de arquitetura

- InspecVISA permanece fonte de verdade do portal e da agenda técnica.
- Central/ERP pode futuramente receber apenas uma projeção mínima da agenda: data/hora, cliente/unidade, modalidade, consultoras, tipo, status e deep link.
- Nunca compartilhar token do portal, service role, fotos, checklists ou relatórios por integração direta com outro sistema.

## 3. Estado atual confirmado no código

### Portal

- Rota pública autenticada por conta: `/cliente`.
- Detalhe autenticado da visita: `/cliente/visita/:token`.
- Login permanente por e-mail/usuário e senha.
- Visão agregada de unidades, inspeções, indicadores e conformidade.
- Pagamentos, aviso de pagamento e notas fiscais por competência.
- Relatórios, fotos, anexos e resumo executivo em PDF.
- Calendário das inspeções.
- Auditoria de login, visualização, downloads, pagamentos e abertura de pasta.

### Drive existente

- `clients.has_personalized_sanitary_folder`.
- `clients.personalized_sanitary_folder_url`.
- O portal já mostra a Pasta Sanitária Personalizada quando os dois campos estão preenchidos.
- O detalhe interno do cliente já permite configurar esses campos.
- Não existe campo separado para a Pasta Principal Completa da conta do portal.

### Agenda existente

- Rota `/agendar` serve tanto acesso externo quanto cliente autenticado.
- `appointment_requests` está semanticamente acoplada a inspeção/vistoria.
- Há modalidades presencial/online, antecedência mínima e datas bloqueadas.
- Há limitação de inspeção presencial ao RJ no modo portal.
- Existe bloqueio de uma vistoria por unidade/mês.
- A disponibilidade e os conflitos ainda carregam regras históricas de janela de quatro horas.
- O painel interno permite confirmar, remarcar, cancelar, vincular inspeção, publicar relatório e anexos.

### Qualidade e validação

- `package-lock.json` existe.
- `node_modules` não estava presente durante o scan; por isso build, lint e testes não foram executados nesta rodada.
- O detector estático encontrou dois usos de borda lateral decorativa no painel de solicitações e dois casos de texto cinza sobre fundo colorido na gestão do portal.
- Não há testes dedicados às páginas `ClientPortal`, `PublicSchedule` e `PublicAppointmentStatus`.
- Os arquivos `5-repos-claude-code.pdf` e `sala-estetica.html` já estavam não rastreados e não pertencem a este plano; preservar.

### Estado do P360-001 em 01/08/2026

- `npm ci` foi executado pelo `package-lock.json` com Node `v25.8.0` e npm `11.11.0`; o lockfile permaneceu inalterado.
- Após a sincronização do OneDrive terminar, `npm run build` passou e `npm test` passou com 10 arquivos e 63 testes.
- `npm run lint` permanece falhando com 450 erros e 24 avisos preexistentes, principalmente `@typescript-eslint/no-explicit-any`; não foram corrigidos neste card.
- A primeira falha do build em `tsconfig.json` foi ambiental (arquivo do OneDrive ainda indisponível) e deixou de ocorrer após a sincronização.
- Não há testes dedicados às páginas `ClientPortal`, `PublicSchedule` e `PublicAppointmentStatus`. A suíte atual não substitui uma homologação autenticada real.
- Os arquivos não relacionados `5-repos-claude-code.pdf`, `docs/` e `sala-estetica.html` foram preservados no worktree.
- O P360-001 **não está concluído**: faltam evidências de login/logout, sessão expirada, conta sem unidades e isolamento real entre tenants com uma conta sintética. Não existe projeto Supabase de staging identificado e não foi criado dado remoto ou de produção.
- O próximo card de implementação continua sendo o P360-002, mas sua execução depende da decisão explícita sobre o ambiente de homologação pendente do P360-001. P360-002 exige modelo Sol em esforço alto por envolver migration, RLS e RPC do portal.

## 4. Arquitetura-alvo

### 4.1 Informação no portal

Ordem recomendada da página:

1. Cabeçalho da conta e próxima ação.
2. Acessos rápidos.
3. Próximo compromisso e pendências urgentes.
4. Plano de ação.
5. Evolução da conformidade.
6. Documentos e histórico.
7. Financeiro.

No celular, as ações rápidas devem aparecer antes dos indicadores. Não criar uma grade extensa de cards idênticos; usar uma faixa de ações, listas e seções recolhíveis quando o conteúdo crescer.

### 4.2 Configuração de portal por tenant

Criar uma configuração administrativa tenant-scoped, preferencialmente `client_portal_settings`:

```text
tenant_id                    uuid primary key
tutorial_pdf_url             text null
support_whatsapp             text null
quick_access_enabled         boolean not null default true
multi_purpose_schedule       boolean not null default false
action_plan_enabled          boolean not null default false
service_requests_enabled     boolean not null default false
created_at                   timestamptz
updated_at                   timestamptz
```

Somente campos explicitamente seguros podem ser retornados pela RPC do portal. Não reutilizar `profiles.consultant_settings`, pois aquela estrutura é individual por consultora e contém configuração profissional, não configuração institucional do portal.

### 4.3 Pasta principal da conta

Adicionar à conta do portal:

```text
client_portal_accounts.main_drive_folder_url text null
```

Regras:

- Configuração em `Clientes > Portal do Cliente`.
- Validar URL HTTPS no cliente e no servidor.
- Retornar pela `client_portal_overview` apenas após autenticação válida da conta.
- Não retornar em superfície pública baseada somente em protocolo legado.
- Registrar evento `main_drive_folder_opened`.

### 4.4 Tipos de compromisso

Vocabulário inicial:

```text
inspection
follow_up_meeting
results_meeting
document_guidance
training
other
```

Campos aditivos esperados em `appointment_requests` e, quando necessário, em `schedules`:

```text
appointment_type             text not null default 'inspection'
subject                      text null
duration_minutes             integer null
consultant_names             text[] null
preferred_consultant_name    text null
meeting_url                  text null
participant_names            text[] null
cancellation_reason          text null
```

Não renomear tabelas nem remover colunas legadas nesta fase. Fazer migração aditiva, backfill determinístico e compatibilidade de leitura.

### 4.5 Disponibilidade

Substituir progressivamente o conflito histórico de “±4 horas” por sobreposição real de intervalos:

```text
existing.start < candidate.end AND existing.end > candidate.start
```

Regras por tipo:

- Inspeção: mantém inicialmente as durações e restrições existentes.
- Reuniões/orientações: 30, 60 ou 90 minutos.
- Treinamentos: duração configurável.
- A disponibilidade pública mostra capacidade da equipe, sem expor detalhes privados da agenda.
- A escolha de consultora pelo cliente, se exibida, é preferência e não garantia até confirmação.
- A equipe pode agendar sem antecedência mínima e fora das janelas públicas, mas continua impedida de sobrepor compromissos da mesma capacidade/consultora ou bloqueios internos.
- O cliente mantém antecedência mínima de 24 horas e uma margem operacional de quatro horas em relação a demandas já agendadas; essa margem pública não altera a duração real do compromisso interno.

### 4.6 Plano de ação publicado

Criar projeção própria em vez de abrir `responses` ao portal:

```text
client_action_items
  id
  tenant_id
  client_id
  source_inspection_id
  source_response_id
  title
  situation
  recommended_action
  priority
  assigned_to
  due_date
  status
  published_at
  resolved_at
  created_at
  updated_at

client_action_evidence
  id
  tenant_id
  action_item_id
  portal_account_id
  storage_bucket
  storage_path
  file_name
  mime_type
  client_comment
  review_status
  reviewer_id
  reviewer_comment
  reviewed_at
  created_at
```

Estados mínimos do item: `open`, `evidence_sent`, `under_review`, `resolved`, `reopened`.

Estados mínimos da evidência: `pending`, `approved`, `changes_requested`.

### 4.7 Solicitações estruturadas

V1 deve ser ticket estruturado, não chat livre:

- Categorias: dúvida técnica, análise de documento, reunião, suporte ao portal e outro.
- Unidade, assunto, descrição, prioridade e anexo opcional.
- Estados: recebida, em análise, aguardando cliente e concluída.
- Auditoria de criação e mudança de estado.

## 5. Segurança obrigatória

- Todas as tabelas novas devem ter `tenant_id`, RLS e índices compatíveis com as consultas.
- A conta do portal só acessa clientes vinculados em `client_portal_account_clients`.
- RPCs `security definer` devem usar `set search_path` explícito e validar token ativo antes de ler ou alterar dados.
- Nunca disponibilizar `storage_path` bruto; gerar URL assinada de curta duração.
- Uploads devem limitar MIME type, tamanho, quantidade e nome de arquivo.
- Links de Drive/tutorial devem aceitar somente HTTPS e ser renderizados com `target="_blank"` e `rel="noopener noreferrer"`.
- Eventos de auditoria não devem gravar senha, token, URL assinada ou conteúdo clínico integral.
- Rate limit/flood guard deve cobrir agendamento, solicitações e upload de evidência.

## 6. Estratégia de migrations

- Criar migrations novas, aditivas e reversíveis em `supabase/migrations/` com timestamp posterior a `20260717090000`.
- O diretório raiz `migrations/` contém trilha histórica/manual com numeração duplicada; não escolher número por suposição. Confirmar o mecanismo efetivamente usado no ambiente antes de espelhar qualquer migration.
- Nunca editar migration já aplicada.
- Cada migration deve trazer comentários de objetivo, `check constraints`, índices, RLS, grants mínimos e funções substituídas por completo.
- Funções como `client_portal_overview` possuem várias redefinições históricas; a nova definição deve partir da versão viva mais recente e preservar pagamentos, notas, scores, NCs e pastas personalizadas.

## 7. Ordem de execução

### Onda A — fundação e ganho imediato

1. P360-001 — baseline reproduzível e conta de homologação.
2. P360-002 — pasta principal e configuração institucional do portal.
3. P360-003 — Acessos rápidos, tutorial e novo CTA.

### Onda B — agenda multiuso

4. P360-004 — domínio e migration de tipos de compromisso.
5. P360-005 — regras de disponibilidade e conflito por duração.
6. P360-006 — fluxo público de solicitação por finalidade.
7. P360-007 — operação interna, atribuição e confirmação.
8. P360-008 — detalhe, notificações e calendário do compromisso.

### Onda C — consultoria 360º

9. P360-009 — página inicial orientada a próximas ações.
10. P360-010 — projeção segura do plano de ação.
11. P360-011 — envio e revisão de evidências.
12. P360-012 — solicitações estruturadas.
13. P360-013 — painel operacional das consultoras.

### Onda D — endurecimento e liberação

14. P360-014 — acessibilidade, responsividade e decomposição.
15. P360-015 — suíte E2E, publicação gradual e prova de produção.

## 8. Dependências entre cards

```text
P360-001
  ├─ P360-002 ─ P360-003 ─ P360-009
  ├─ P360-004 ─ P360-005 ─ P360-006 ─ P360-007 ─ P360-008
  └─ P360-010 ─ P360-011 ─ P360-013
                 P360-012 ─┘

P360-014 depende das superfícies estabilizadas.
P360-015 fecha todas as ondas liberadas.
```

P360-003 pode ser publicado antes da agenda multiuso, desde que o CTA novo leve ao fluxo ainda identificado internamente como inspeção e a feature flag de outros tipos permaneça desligada. O texto da página de destino deve continuar verdadeiro até P360-006.

## 9. Roteamento de modelo e esforço

| Tipo de trabalho | Modelo seguro/econômico | Esforço |
|---|---|---|
| Inventário, baseline e documentação mecânica | Terra | médio |
| UI delimitada, copy, componentes e testes unitários | Terra | médio |
| Fluxos React multi-arquivo e refatoração controlada | Terra | alto |
| Migrations, RLS, RPCs, Storage e autenticação do portal | Sol | alto |
| Agenda, concorrência, disponibilidade e compatibilidade legada | Sol | alto |
| Plano de ação/evidência com dados sanitários | Sol | alto |
| Revisão final de segurança e liberação | Sol | alto |

Não é necessário Sol max/ultra para este backlog. Luna pode ajudar somente em inventários ou checklists mecânicos, mas não deve assumir migrations, decisões de permissão ou conteúdo sanitário.

## 10. Definition of Done global

Um card funcional só pode ser marcado como concluído quando:

- Código, migration e tipos estão coerentes.
- `npm ci` foi executado a partir do lockfile.
- `npm run build`, `npm run lint` e testes direcionados passaram, ou falhas preexistentes foram isoladas com evidência.
- Fluxo feliz, vazio, erro, permissão negada e sessão expirada foram exercitados.
- Mobile 360/390 px e desktop foram revisados visualmente.
- Ações sensíveis possuem auditoria e RLS verificadas.
- Nenhum dado de outro tenant/cliente aparece nos testes negativos.
- A mudança foi validada com conta real de homologação.
- Para produção: migration aplicada, bundle/SHA identificado, hard refresh ou limpeza do service worker e smoke autenticado da funcionalidade distintiva.

Build verde ou health check isolado não prova deploy do portal.

## 11. Fora de escopo deste ciclo

- Chat em tempo real entre cliente e consultoras.
- Videoconferência própria dentro do InspecVISA.
- Sincronização bidirecional completa com Google Calendar ou Outlook.
- Edição pelo cliente do relatório, checklist técnico ou resposta original da inspeção.
- Compartilhamento de credenciais do Drive ou incorporação dos arquivos do Drive no banco.
- Migração da fonte de verdade do portal para Central/ERP.

## 12. Primeiro comando da próxima conversa

Antes de implementar qualquer card:

```powershell
git fetch origin
git status --short
git branch --show-current
git log -3 --oneline --decorate
```

Depois, ler integralmente este handoff e o card escolhido. Não usar `git add -A` num worktree com arquivos alheios não rastreados.
