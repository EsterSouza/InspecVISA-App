# Cards executáveis — Portal do Cliente e Consultoria 360º

Este arquivo é a fila operacional do [handoff técnico](./HANDOFF.md). Cada card deve ser implementado isoladamente, com diff revisável e validação proporcional ao risco.

## P360-001 — Baseline reproduzível e homologação do portal

**Prioridade:** P0 de execução

**Dependências:** nenhuma

**Modelo recomendado:** Terra

**Esforço:** médio

**Resultado:** ambiente local reproduzível e uma conta de homologação capaz de exercitar o portal sem usar dados de cliente real.

### Implementação

- Preservar arquivos não relacionados já presentes no worktree.
- Executar `npm ci` usando `package-lock.json`; não atualizar versões neste card.
- Registrar versões de Node e npm usadas.
- Rodar build, lint e suíte atual para estabelecer a linha de base.
- Separar falhas preexistentes de falhas ambientais.
- Preparar dados de homologação isolados por tenant: uma conta, duas unidades, uma pasta principal, uma pasta personalizada em apenas uma unidade, inspeções com e sem arquivos, pagamento pago/pendente e um compromisso futuro.
- Documentar como acessar a conta sem registrar senha ou token no Git.

### Testes

- `npm run build`.
- `npm run lint`.
- `npm test` e suítes direcionadas existentes.
- Login, logout, sessão expirada e conta sem unidades.
- Confirmar que a conta de homologação não lê dados de outro tenant.

### Critérios de aceite

- Dependências instaladas de forma determinística pelo lockfile.
- Resultado de cada comando registrado sem esconder falhas.
- Conta de homologação reproduz todos os estados necessários aos cards seguintes.
- Nenhum segredo, token ou dado de cliente real entra em fixture ou documentação.

### Fora de escopo

- Corrigir todos os erros preexistentes de lint.
- Atualizar dependências.
- Publicar produção.

---

## P360-002 — Pasta Principal Completa e configuração institucional do portal

**Prioridade:** P1

**Dependências:** P360-001

**Modelo recomendado:** Sol

**Esforço:** alto

**Resultado:** a equipe configura uma Pasta Principal Completa por conta do portal e um tutorial PDF por tenant, mantendo as pastas personalizadas por unidade.

### Implementação

- Migration aditiva para `client_portal_accounts.main_drive_folder_url`.
- Criar `client_portal_settings` tenant-scoped com tutorial, WhatsApp e flags definidos no handoff.
- RLS: staff do tenant gerencia; cliente do portal não faz DML direto.
- Criar/estender RPC administrativa para salvar configuração com validação de URL HTTPS.
- Estender `client_portal_overview` a partir da versão viva mais recente para retornar somente `main_drive_folder_url`, `tutorial_pdf_url`, `support_whatsapp` e flags seguras.
- Atualizar `ClientPortalAccountRow`, `ClientPortalOverview`, `AppointmentAdminService` e `clientPortalService`.
- Adicionar campos administrativos em `Clientes > Portal do Cliente`, com rótulos distintos e ajuda curta.
- Preservar `has_personalized_sanitary_folder` e `personalized_sanitary_folder_url` sem renomear ou migrar seu conteúdo.

### Arquivos esperados

- `supabase/migrations/<timestamp>_portal_main_folder_and_settings.sql`
- `src/types/index.ts`
- `src/services/appointmentAdminService.ts`
- `src/services/clientPortalService.ts`
- `src/components/clients/ClientPortalManagement.tsx`

### Testes

- Migration em banco limpo e sobre schema atualizado.
- RLS positiva para staff do tenant e negativa para usuário de outro tenant/anon.
- RPC do portal com token válido, inválido, inativo e pertencente a outro tenant.
- URL vazia, HTTP, HTTPS válida e texto malformado.
- Regressão dos campos de pagamento, notas, scores e pastas personalizadas na overview.

### Critérios de aceite

- A conta do portal armazena uma única Pasta Principal Completa.
- Cada unidade mantém sua Pasta Sanitária Personalizada independente.
- Tutorial e suporte podem ser alterados sem deploy.
- A overview não vaza configuração interna ou URLs para token inválido.
- Migration possui rollback documentado e não altera registros legados.

### Risco principal

Sobrescrever uma definição recente de `client_portal_overview` e perder campos já existentes. Comparar a função anterior inteira e criar teste de contrato JSON.

---

## P360-003 — Acessos rápidos, tutorial e novo CTA

**Prioridade:** P1

**Dependências:** P360-002

**Modelo recomendado:** Terra

**Esforço:** médio

**Resultado:** o cliente encontra imediatamente as duas pastas, o tutorial e o agendamento.

### Implementação

- Criar componente `PortalQuickActions` no topo da área autenticada.
- Ordem das ações:
  1. `Abrir pasta principal completa`.
  2. `Abrir Pasta Sanitária Personalizada — {unidade}` para cada unidade habilitada.
  3. `Abrir tutorial do portal (PDF)`.
  4. `Agendar horário com as consultoras`.
  5. `Falar com a consultoria`, se WhatsApp estiver configurado.
- Não exibir ação sem URL/configuração; mostrar aviso administrativo somente na tela interna.
- Trocar o CTA atual `Agendar nova inspeção` pelo novo texto.
- Criar eventos `main_drive_folder_opened`, `portal_tutorial_opened`, `schedule_cta_clicked` e `support_whatsapp_clicked`.
- Adicionar rótulos correspondentes no histórico interno de auditoria.
- Garantir alvo de toque mínimo de 44×44 px e foco visível.

### Testes

- Conta com as duas pastas.
- Conta apenas com pasta principal.
- Conta apenas com pastas personalizadas de uma ou várias unidades.
- Conta sem pastas e/ou sem tutorial.
- Auditoria de cada clique sem gravar a URL completa.
- Mobile 360 px, 390 px e desktop.

### Critérios de aceite

- Os dois tipos de pasta são visual e textualmente inequívocos.
- A pasta principal aparece uma vez por conta.
- A pasta personalizada identifica a unidade correta.
- Tutorial abre em nova aba como PDF.
- O primeiro CTA de agenda usa exatamente `Agendar horário com as consultoras`.
- Não há botão morto, overflow horizontal ou ação apenas por ícone.

---

## P360-004 — Domínio multiuso de compromissos

**Prioridade:** P1

**Dependências:** P360-001

**Modelo recomendado:** Sol

**Esforço:** alto

**Resultado:** banco e serviços distinguem inspeções de reuniões, orientações e treinamentos sem quebrar registros legados.

### Implementação

- Adicionar campos do domínio definidos no handoff a `appointment_requests` e `schedules` quando aplicável.
- Usar `check constraint` ou enum controlado para os tipos iniciais.
- Backfill de registros existentes para `inspection`.
- Derivar `duration_minutes` de `requested_starts_at`/`requested_ends_at` quando ambos existirem; não mudar horários legados.
- Atualizar tipos TypeScript e mapeamentos dos serviços.
- Centralizar rótulos/regras em `appointmentType.ts`, evitando condicionais espalhadas.
- Criar guardas: funções de inspeção rejeitam tipos não sanitários.
- Manter leitura compatível quando campos novos vierem nulos durante rollout.

### Testes

- Migration em schema vazio e schema com dados legados.
- Validação de cada tipo permitido e rejeição de tipo desconhecido.
- Compatibilidade de listagens antigas.
- Garantir que reunião não cria `inspection_id` nem `report_due_at`.
- Garantir que inspeção mantém o fluxo atual.

### Critérios de aceite

- 100% dos registros legados continuam visíveis como inspeção.
- Serviços não dependem de comparação textual de rótulos em português.
- Nenhum compromisso não sanitário pode iniciar inspeção ou publicar relatório.
- A migration é aditiva e não remove colunas/status existentes.

---

## P360-005 — Disponibilidade e conflitos por duração

**Prioridade:** P1

**Dependências:** P360-004

**Modelo recomendado:** Sol

**Esforço:** alto

**Resultado:** horários são liberados/bloqueados pela duração real e pelo tipo de compromisso.

### Implementação

- Substituir a regra genérica de `±4 hours` por sobreposição real de intervalos.
- Preservar comportamento de inspeções até suas durações padrão serem confirmadas em configuração.
- Definir durações permitidas por tipo: reuniões/orientações 30/60/90; treinamento configurável; inspeção conforme slot atual.
- Impedir `ends_at <= starts_at`, duração negativa ou fora do limite.
- Fazer validação transacional no servidor para evitar reserva simultânea.
- Manter datas bloqueadas, antecedência mínima e timezone `America/Sao_Paulo`.
- Não expor nomes ou assuntos de outros compromissos na agenda pública.

### Testes

- Intervalos adjacentes sem conflito.
- Sobreposição parcial, total e mesmo início.
- Duas requisições concorrentes para o mesmo horário: apenas uma vence.
- Virada de mês, horário de verão histórico e serialização UTC/local.
- Agenda sem disponibilidade e retry de rede.

### Critérios de aceite

- Reunião de 30 minutos não bloqueia quatro horas.
- Compromissos sobrepostos não são confirmados para a mesma capacidade/consultora.
- Datas e horários exibidos correspondem ao horário de Brasília.
- A agenda pública não revela dados privados de eventos ocupados.

---

## P360-006 — Solicitação por finalidade no portal

**Prioridade:** P1

**Dependências:** P360-004 e P360-005

**Modelo recomendado:** Terra

**Esforço:** alto

**Resultado:** o cliente escolhe o que deseja agendar e vê somente campos e regras pertinentes.

### Implementação

- Primeira etapa: `O que você deseja agendar?` com tipos habilitados.
- Segunda etapa: unidade, modalidade, duração, data e horário.
- Terceira etapa: assunto, objetivo, participantes e observações.
- Inspeção mantém unidade obrigatória, regras geográficas e bloqueio mensal.
- Reunião/orientação online não pede município/bairro nem aplica bloqueio mensal de inspeção.
- Exibir resumo antes de enviar.
- Reescrever mensagens de sucesso e erro de forma neutra por tipo.
- Persistir rascunho apenas durante a sessão; limpar após sucesso/logout.

### Testes

- Fluxo completo de cada tipo.
- Alternância de tipo limpa campos incompatíveis.
- Conta com uma e várias unidades.
- Validação de campos obrigatórios por tipo.
- Voltar etapas, refresh, sessão expirada e horário tomado durante o preenchimento.
- Teclado e leitor de tela.

### Critérios de aceite

- A página não chama toda solicitação de inspeção/vistoria.
- O cliente nunca preenche endereço para uma reunião online.
- O resumo mostra tipo, unidade, modalidade, duração e horário.
- Uma reunião não consome a cota mensal de inspeção.
- Erro de concorrência devolve o cliente à seleção de horário sem perder os outros dados.

---

## P360-007 — Operação interna e atribuição de consultoras

**Prioridade:** P1

**Dependências:** P360-004 a P360-006

**Modelo recomendado:** Sol

**Esforço:** alto

**Resultado:** a equipe confirma e administra todos os tipos de compromisso sem ações sanitárias indevidas.

### Implementação

- Separar filtros e contadores por tipo/status no painel de solicitações.
- Mostrar assunto, duração, modalidade e preferência de consultora.
- Na confirmação, exigir consultora(s) responsável(is) e permitir ajustar duração/link.
- Para inspeção, manter criação/vínculo com `schedules` e herança para a inspeção.
- Para outros tipos, criar evento de agenda sem inspeção e ocultar publicar relatório, fotos, score e plano de ação sanitário.
- Adicionar cancelar/remarcar com motivo auditável.
- Preservar recolhimento da seção inteira de solicitações ativas, não de cada card.

### Testes

- Confirmar, remarcar e cancelar cada tipo.
- Permissões por tenant.
- Ações sanitárias ausentes para reunião/treinamento.
- Inspeção continua herdando consultoras.
- Filtros e contadores com mistura de tipos.

### Critérios de aceite

- Uma reunião nunca oferece `Iniciar inspeção` ou `Publicar relatório`.
- A consultora responsável aparece no compromisso confirmado.
- Remarcação libera o horário anterior e ocupa o novo atomicamente.
- Histórico registra quem confirmou/cancelou e o motivo.

---

## P360-008 — Detalhe, notificações e calendário do compromisso

**Prioridade:** P1

**Dependências:** P360-007

**Modelo recomendado:** Terra

**Esforço:** alto

**Resultado:** cliente recebe confirmação útil, link de reunião e opção de adicionar ao calendário.

### Implementação

- Tornar `PublicAppointmentStatus` condicional ao tipo.
- Inspeção conserva timeline sanitária, prazo e entregáveis.
- Reuniões/orientações usam timeline simples: solicitada, confirmada, realizada/cancelada.
- Exibir link online somente após confirmação.
- Gerar download `.ics` no servidor ou cliente com UID estável, timezone e atualização/cancelamento.
- Criar links compatíveis com Google Calendar e Outlook sem incluir dados sanitários sensíveis.
- Atualizar e-mail/WhatsApp de confirmação, remarcação, lembrete e cancelamento.
- Deduplicar notificações com chave idempotente por evento.

### Testes

- Conteúdo de e-mail por tipo.
- ICS validado e importado em Google/Outlook.
- Link online ausente antes da confirmação e presente depois.
- Notificação duplicada/retry não envia duas mensagens.
- Suspensão financeira não deve apagar compromissos já confirmados; regra exata deve ser explicitada em teste.

### Critérios de aceite

- Texto e timeline correspondem ao tipo do compromisso.
- Cliente adiciona evento ao calendário com horário correto.
- Remarcação atualiza o mesmo evento lógico.
- Nenhuma notificação contém token interno, service role ou dados técnicos desnecessários.

---

## P360-009 — Início do portal orientado a próximas ações

**Prioridade:** P2

**Dependências:** P360-003 e P360-008

**Modelo recomendado:** Terra

**Esforço:** alto

**Resultado:** a primeira tela responde “o que preciso fazer agora?” antes de mostrar métricas históricas.

### Implementação

- Extrair `PortalQuickActions`, `PortalNextAction`, `PortalAppointments`, `PortalDocuments`, `PortalBilling` e `PortalCompliance`.
- Mostrar primeiro: pagamento vencido, compromisso próximo, evidência devolvida, item vencido ou solicitação aguardando cliente.
- Aplicar prioridade determinística e nunca exibir alertas contraditórios.
- Adicionar filtro de unidade que afeta indicadores, histórico e plano de ação.
- Manter financeiro e solicitações em áreas distintas.
- Preservar lista compacta/recolhível quando houver muitos itens.

### Testes

- Cada tipo de próxima ação isolado e combinado.
- Ordem de prioridade.
- Conta com zero, uma e muitas unidades.
- Filtro de unidade e retorno a `Todas`.
- Loading por skeleton, erro parcial e dados vazios.

### Critérios de aceite

- Próxima ação aparece acima dos indicadores no mobile.
- O cliente chega ao destino em no máximo um clique.
- Falha de notas fiscais não derruba agenda/documentos.
- Página não usa uma grade longa de cards idênticos.

---

## P360-010 — Projeção segura do plano de ação

**Prioridade:** P1 sanitário

**Dependências:** P360-001

**Modelo recomendado:** Sol

**Esforço:** alto

**Resultado:** o cliente visualiza pendências publicadas sem acesso direto às respostas técnicas originais.

### Implementação

- Criar `client_action_items` com RLS e índices.
- Ao publicar relatório, criar/atualizar projeções a partir das NCs autorizadas.
- Não publicar itens quando relatório estiver oculto/suspenso conforme regra vigente.
- Definir prioridade, responsável, prazo, origem e status.
- Criar RPC de leitura por token da conta validando vínculo com a unidade.
- Criar ações staff para publicar, ocultar, reabrir e resolver.
- Preservar histórico; não apagar item resolvido quando nova inspeção é publicada.

### Testes

- Tenant/cliente cruzado negado.
- Relatório oculto não vaza item.
- Republicação idempotente.
- Item recorrente mantém rastreabilidade entre inspeções.
- Prazo vencido calculado no timezone correto.

### Critérios de aceite

- Cliente vê situação, ação recomendada, responsável, prazo e prioridade.
- Cliente não recebe IDs/estrutura do checklist além do necessário.
- Alteração no portal não modifica `responses`.
- Consultora consegue ocultar item inadequado antes da publicação.

---

## P360-011 — Evidências do cliente e revisão técnica

**Prioridade:** P1 sanitário

**Dependências:** P360-010

**Modelo recomendado:** Sol

**Esforço:** alto

**Resultado:** cliente envia prova de correção e a consultora aprova ou devolve com orientação.

### Implementação

- Criar `client_action_evidence` e bucket privado específico.
- Upload por Edge Function/RPC autenticada pelo token do portal.
- Aceitar inicialmente PDF, JPG, PNG e WEBP com limites documentados.
- Sanitizar nome e gerar storage path server-side.
- Criar estados `pending`, `approved`, `changes_requested`.
- A aprovação resolve o item somente mediante ação explícita da consultora.
- Notificar equipe ao envio e cliente após revisão, com idempotência.
- Registrar auditoria sem gravar conteúdo/URL assinada.

### Testes

- MIME permitido/proibido, tamanho máximo e arquivo vazio.
- Upload para item de outro cliente/tenant negado.
- URL assinada expira e pode ser renovada por usuário autorizado.
- Retry não duplica evidência.
- Aprovar, devolver, reenviar e reabrir.

### Critérios de aceite

- Cliente acompanha o estado da evidência e comentário da consultora.
- Evidência nunca fica em bucket público.
- Item não é resolvido automaticamente pelo simples upload.
- Consultora acessa arquivo apenas com autorização e URL temporária.

---

## P360-012 — Solicitações estruturadas de consultoria

**Prioridade:** P2

**Dependências:** P360-002

**Modelo recomendado:** Sol

**Esforço:** alto

**Resultado:** cliente abre demandas rastreáveis sem criar um chat livre.

### Implementação

- Criar `client_service_requests` e `client_service_request_events` tenant-scoped.
- Categorias e estados definidos no handoff.
- Formulário curto com unidade, categoria, assunto, descrição e anexo opcional.
- SLA inicial apenas informativo/configurável; não prometer prazo sem regra administrativa.
- Painel interno com filtros, responsável, prioridade e histórico.
- E-mail/WhatsApp opcional na criação e mudança para `aguardando cliente`.
- Rate limit e prevenção de duplicidade por submissão.

### Testes

- Criar/ler somente dentro da conta vinculada.
- Mudanças de status permitidas por papel.
- Anexo seguro e limite de envio.
- Duplo clique e retry.
- Estados vazio, erro e solicitação encerrada.

### Critérios de aceite

- Cliente vê número, categoria, data, status e última atualização.
- Consultora identifica claramente o que aguarda cliente versus equipe.
- Não existe conversa em tempo real ou expectativa de resposta instantânea.
- Solicitações não aparecem misturadas com agendamentos.

---

## P360-013 — Painel operacional das consultoras

**Prioridade:** P2

**Dependências:** P360-007, P360-010, P360-011 e P360-012

**Modelo recomendado:** Terra

**Esforço:** alto

**Resultado:** a equipe administra a consultoria pelo que exige ação, sem procurar cliente por cliente.

### Implementação

- Criar visão agregada com:
  - compromissos próximos;
  - solicitações novas;
  - evidências aguardando revisão;
  - planos de ação vencidos;
  - clientes aguardando resposta;
  - pendências financeiras, sem misturá-las às demandas técnicas.
- Filtros por consultora, cliente/unidade, tipo e prazo.
- Deep links para o registro de origem.
- Contadores derivados no servidor, sem carregar todos os anexos/respostas.
- Estado de indisponibilidade parcial por módulo.

### Testes

- Contagens com dados mistos e multi-tenant.
- Filtros combinados.
- Deep links válidos e autorização.
- Paginação e volume representativo.
- Falha de um bloco não derruba os demais.

### Critérios de aceite

- Consultora identifica pendências críticas em menos de um minuto.
- Nenhum contador depende apenas do Dexie/localStorage.
- A visão por consultora não omite compromissos compartilhados.
- Dados financeiros e técnicos permanecem separados visual e semanticamente.

---

## P360-014 — Acessibilidade, responsividade e decomposição

**Prioridade:** P2

**Dependências:** executar após estabilizar as superfícies de cada onda

**Modelo recomendado:** Terra

**Esforço:** médio

**Resultado:** portal e agenda atendem uso real em celular, teclado e leitor de tela e deixam de concentrar regras em páginas gigantes.

### Implementação

- Associar todos os `label` a controles por `htmlFor`/`id` ou wrapper válido.
- Incluir `aria-label`, `aria-live`, `aria-expanded` e estados de erro onde cabível.
- Aumentar controles do calendário para 44×44 px.
- Garantir contraste AA, inclusive placeholders e textos sobre fundos coloridos.
- Remover bordas laterais decorativas detectadas e reduzir caixa alta minúscula repetitiva.
- Substituir spinners centrais por skeletons onde o conteúdo tem estrutura previsível.
- Dividir páginas por domínio sem introduzir estado global desnecessário.
- Adicionar fallback e retry por seção.

### Testes

- `axe`/equivalente nas rotas do portal.
- Navegação completa somente por teclado.
- Zoom 200%, fonte aumentada e reflow a 320 px.
- VoiceOver/NVDA em login, agenda e plano de ação.
- Reduced motion.

### Critérios de aceite

- Zero violações WCAG A/AA críticas nas páginas-alvo.
- Todo controle tem nome acessível e foco visível.
- Nenhum alvo primário fica abaixo de 44×44 px.
- Nenhum overflow horizontal em 320–1440 px.
- Componentes extraídos mantêm comportamento e testes.

---

## P360-015 — E2E, rollout gradual e prova de produção

**Prioridade:** P0 de liberação

**Dependências:** cards da onda a publicar

**Modelo recomendado:** Sol

**Esforço:** alto

**Resultado:** cada onda é liberada com evidência de migration, bundle, permissões e fluxos reais.

### Implementação

- Criar testes E2E autenticados com conta de homologação.
- Cobrir Acessos rápidos, agenda por tipo, detalhe, plano de ação, evidência e solicitações conforme flags habilitadas.
- Ativar features por tenant, começando pela homologação.
- Documentar migration aplicada, SHA do commit/bundle, horário BRT e rollback.
- Validar PWA/service worker com hard refresh e cenário de atualização de bundle.
- Criar smoke de produção com conteúdo distintivo; health endpoint isolado não basta.
- Revisão final de RLS/RPC/Storage antes de cada flag.

### Testes mínimos de liberação

- Conta válida, inválida, suspensa e de outro tenant.
- Pasta principal versus personalizada.
- Tutorial e auditoria.
- Inspeção e reunião sem contaminação de fluxo.
- Reserva concorrente.
- Evidência autorizada e tentativa cruzada negada.
- Mobile real ou emulação confiável.
- Regressão de relatórios, fotos, notas e pagamento.

### Critérios de aceite

- CI verde no SHA publicado.
- Migration confirmada no ambiente correto.
- HTML/bundle em produção contém a feature distintiva.
- Smoke autenticado passa após limpeza do service worker.
- Rollback da flag e da aplicação está documentado e testável.
- Nenhuma feature é declarada em produção apenas porque a imagem/CI foi publicada.

### Revisão final

Mesmo quando a implementação dos testes for feita por Terra, a revisão de segurança, migrations e prova de produção deve ser feita com Sol em esforço alto.
