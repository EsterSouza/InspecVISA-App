# Mapa das páginas do admin — o que cada tela faz, quem usa, quando

**Criado:** 15/08/2026 · **Escopo:** só as páginas do staff (consultoras), atrás de login.
O portal do cliente (`/cliente/...`, `/portal/:token`, `/agendar`) fica fora — é outro card.

**Por que este documento existe:** cada vez que preciso entender "o que essa tela faz" tenho que
reler o arquivo do zero — e às vezes um subagente inteiro só pra isso. Isso é gasto de tokens
repetido a cada sessão. Este mapa é o cache dessa leitura. **Antes de mexer numa página do admin,
olhe aqui primeiro.** Se a página mudar de forma relevante (rota nova, responsabilidade nova,
dado novo que ela lê/escreve), atualize esta tabela no mesmo commit — documento desatualizado
engana mais do que a ausência de documento (foi o que quase aconteceu hoje com o EMAIL-01, que o
HANDOFF.md dizia "não publicado" quando já estava no ar).

## Como as rotas aparecem na barra lateral

| Rótulo na sidebar | Rota | Ícone |
|---|---|---|
| Início | `/` | Home |
| Painel | `/painel` | Gauge |
| Clientes | `/clients` | Users |
| Roteiros | `/templates` | FileText |
| Biblioteca | `/legislations` | BookOpen |
| Agendamentos | `/schedules` | Calendar |
| Solicitações | `/requests` | Headset |
| Inspeções | `/inspections` | ClipboardCheck |
| Sincronização | `/sync` | Activity |
| Configurações | `/settings` | Settings |

Rotas que existem mas não têm item próprio na sidebar (chegam por navegação interna, não pelo
menu): `/clients/:id`, `/new`, `/execute`, `/summary`, `/templates/new`, `/templates/:id`,
`/templates/:id/edit`, `/templates/import`, `/access-denied`.

## As três telas que mais se confundem entre si

Já geraram dúvida real (15/08/2026): **Painel**, **Agendamentos** e **Solicitações** parecem a
mesma coisa por nome, mas são domínios diferentes.

- **Agendamentos** (`Schedules.tsx`) tem duas sub-abas internas: **Agenda** (calendário da semana,
  compromissos confirmados) e **Pedidos de Visita** (`AppointmentRequestsPanel` — pedidos de
  agendamento do portal público, pendente/ativa/encerrada, com os botões de confirmar, remarcar,
  reenviar e-mail, publicar relatório). Essa sub-aba se chamava "Solicitações" até hoje — foi
  renomeada por colidir de nome com a próxima.
- **Solicitações** (`ServiceRequests.tsx`, rota `/requests`) é **outra coisa**: pedidos gerais de
  atendimento do cliente ("preciso de orientação sobre X", segunda via de relatório), sem data nem
  duração. Separado de propósito da agenda desde o card P360-012 — o comentário no código registra
  que misturar as duas listas era "exatamente o que fazia o WhatsApp virar o canal padrão".
- **Painel** (`OperationalPanel.tsx`, rota `/painel`) é um agregador (P360-013): junta num só lugar
  compromissos próximos, pedidos de agendamento pendentes, solicitações novas e pendências
  financeiras, com link direto para a tela de origem de cada item. É o "o que exige ação agora?"
  de tudo junto — não substitui as outras duas, resume as duas.

## Todas as páginas

| Rota | Arquivo | O que é | Quem usa / quando | Dados principais |
|---|---|---|---|---|
| `/` | `src/pages/Dashboard.tsx` | Home do staff: estatísticas de inspeções (ativas, concluídas, nota média), atenção do dia (prazos, sync pendente), não conformidades recorrentes. | Toda consultora, ao abrir o app. | Lê `inspections`, `schedules`, `responses` do Dexie local (`db`), agregando client-side. |
| `/painel` | `src/pages/OperationalPanel.tsx` | Painel operacional agregador (ver seção acima). Seis blocos independentes (um falhar não derruba os outros). | Consultora que quer ver "o que precisa da minha atenção" sem entrar em cada tela. | `OperationalOverviewService` — agrega `appointment_requests`, `service_requests`, financeiro; cada bloco carrega e falha isolado. |
| `/clients` | `src/pages/Clients.tsx` | Cadastro de clientes (CRUD) + aba "portal" com contas de acesso do portal do cliente. | Consultora, ao cadastrar/editar cliente ou gerenciar acesso do portal. | `ClientService` (`clients`), `AppointmentAdminService.listPortalAccounts` (`client_portal_accounts`). |
| `/clients/:id` | `src/pages/ClientDetails.tsx` | Ficha completa do cliente: histórico de inspeções, plano de ação, acesso do portal, trilha de auditoria, solicitações vinculadas, anexos publicados, agendar visita retroativa. Tela grande (1163 linhas) — é o hub de tudo daquele cliente. | Consultora, ao investigar ou preparar visita de um cliente específico. | `ClientService`, `InspectionService`, `AppointmentAdminService`, `ScheduleService` — lê e escreve em vários domínios ao mesmo tempo. |
| `/schedules` | `src/pages/Schedules.tsx` | Ver seção "as três telas" acima. Agenda semanal + pedidos de visita. | Consultora, todo dia, para ver/confirmar compromissos. | `ScheduleService` (`schedules`), `AppointmentAdminService` (`appointment_requests`, `appointment_notification_log`). |
| `/requests` | `src/pages/ServiceRequests.tsx` | Fila de pedidos de atendimento do cliente, organizada por "quem está esperando" (equipe/cliente/encerrado), não por status técnico. | Consultora, para responder pedidos que não são agendamento. | `ServiceRequestService` (`service_requests` + `service_request_events`). |
| `/settings` | `src/pages/Settings.tsx` | Configuração local do dispositivo/perfil: logo do relatório, dados da consultora, backup/exportação do banco local, logout. | Consultora, uma vez por dispositivo (ou ao trocar de perfil). | `useSettingsStore` (local) + `SettingsService` (sync remoto do perfil). |
| `/inspections` | `src/pages/Inspections.tsx` | Lista de todas as inspeções (em andamento/concluídas), com lixeira de excluídas. Ponto de entrada para retomar uma inspeção. | Consultora, para achar uma inspeção específica ou continuar uma em andamento. | `InspectionService.getAllInspections`, junta com `ClientService.getClients`. |
| `/new` | `src/pages/NewInspection.tsx` | Wizard de criação de inspeção: escolhe cliente, roteiro (template efetivo com suplemento regional), dados de ILPI (capacidade, dependência), confirma visita. | Consultora, ao iniciar uma inspeção nova (às vezes a partir de um agendamento). | `ClientService`, `getEffectiveTemplate`, `ScheduleService`; cria linha em `inspections`. |
| `/execute` | `src/pages/InspectionExecution.tsx` | Tela de execução: checklist item a item, fotos, calculadora de staffing ILPI, progresso colaborativo em tempo real entre consultoras. Maior página do app (1297 linhas). | Consultora, durante a visita (frequentemente offline, em campo). | `InspectionService`, `InspectionBundleSyncService`, `ClientEvidenceService`; grava `responses`, `photos` local-first (Dexie) e sincroniza depois. |
| `/summary` | `src/pages/InspectionSummary.tsx` | Fechamento da inspeção: nota, edição de metadados, geração e preview do PDF, publicação do relatório (que reconcilia o plano de ação). | Consultora, ao concluir a visita e fechar o relatório. | `InspectionService`, `LegislationService`, `resolveReportTemplate`; publica em `inspection_report_versions` e reconcilia `client_action_items`. |
| `/templates` | `src/pages/admin/AdminTemplates.tsx` | Lista de roteiros (templates) — estáticos (`src/data/`, somente leitura) e editáveis (banco). Ponto de entrada para ver/criar/importar roteiro. | Consultora, ao gerenciar os roteiros de inspeção em si (não uma inspeção específica). | `TemplateService.listTemplates` + `getTemplates()` (estáticos), mesclados. |
| `/templates/new`, `/templates/:id/edit` | `src/pages/admin/TemplateEditor.tsx` | Editor de roteiro do banco: seções e itens (descrição, legislação, peso, crítico). Só roteiros editáveis — os estáticos de `src/data/` não passam por aqui. | Consultora, para criar ou ajustar um roteiro customizado. | `TemplateService` (`checklist_templates`, `checklist_sections`, `checklist_items`). |
| `/templates/:id` | `src/pages/TemplateDetail.tsx` | Visualização somente-leitura de um roteiro: seções, itens, peso (rótulo "Imprescindível/Necessário/Recomendado/Sugerido"), legislação citada. | Consultora, para conferir o conteúdo de um roteiro sem editar. | `getTemplateById` (estático) ou `TemplateService.getFullTemplate` (banco). |
| `/templates/import` | `src/pages/admin/SmartImporter.tsx` | Importador: cola texto ou sobe PDF/DOCX/TS e extrai itens de roteiro automaticamente (parser heurístico ou por tipo de arquivo) para revisão antes de salvar. | Consultora, ao criar um roteiro novo a partir de um documento externo. | `DocumentParser` (client-side) → grava via `TemplateService` depois de revisado. |
| `/legislations` | `src/pages/admin/LegislationsManager.tsx` | Biblioteca de Legislação: normas cadastradas (ementa, autoria, UF, vigência) + notas de pesquisa por norma (novo, 15/08/2026). É a "app de legislação" para consulta a qualquer momento. | Consultora, ao pesquisar ou confirmar uma norma antes de citar num roteiro. | `LegislationService` (`legislations`), com fallback local em `src/data/legislationLibrary.ts`. |
| `/sync` | `src/pages/SyncCenter.tsx` | Central de sincronização: status por tabela (pendente/enviando/erro/conflito/sincronizado), export de backup, retry manual. | Consultora, quando o app avisa item pendente ou para investigar erro de sync. | `SyncQueueService` + `db` (Dexie) — não fala com o Supabase diretamente, só mostra o estado da fila. |
| `/access-denied` | `src/pages/AccessDenied.tsx` | Tela de erro genérica para rota sem permissão. | Ninguém "usa" — é o destino de um redirect de `ProtectedRoute`. | Nenhum dado; só navegação. |

## Como manter isto vivo

- Ao criar rota nova: adicionar linha na tabela.
- Ao mudar a responsabilidade de uma tela (o que ela lê/escreve, quem usa): atualizar a linha
  correspondente no mesmo commit da mudança de código.
- Ao renomear rótulo da sidebar: atualizar a tabela do topo — é o tipo de mudança pequena que gera
  confusão desproporcional se ficar defasada (foi o caso do "Solicitações" duplicado).
