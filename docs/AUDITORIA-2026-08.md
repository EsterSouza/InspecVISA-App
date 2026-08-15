# Auditoria de implementação, avaliação e novo plano — InspecVISA

**Data:** 15/08/2026 (BRT) · **Branch:** `main` (limpa, sincronizada com `origin/main`, HEAD `a0180fe`)
**Método:** confronto do que os dois handoffs (`HANDOFF.md`, `HANDOFF-FRONTEND.md`) afirmam contra
o código-fonte e o Supabase de produção (`pfjacmawaigndqclgvpn`) nesta data. Não é planejamento
otimista; é o que está no ar, com evidência de leitura.

Este documento responde a três perguntas: **já fizemos tudo do handoff?**, **como está o InspecVISA
hoje?** e **o que falta para "deixar a base pronta antes de avançar"?** Complementa (não substitui)
os dois handoffs — eles continuam sendo a fonte card a card.

---

## 1. Resposta curta

**Não, mas falta pouco do que foi planejado — e o que falta é quase todo do mesmo lado: o admin.**

- O **núcleo sanitário e o banco** (inspeção → relatório → plano de ação → portal, referências,
  segurança, multi-tenant) está **fechado e em produção**.
- O **redesign** entregou a **Onda 1 inteira (Portal do cliente)**. As **Ondas 2 (Admin) e 3
  (fechamento)** praticamente **não começaram** — confirmado no código, não só no handoff.
- Sobram **4 bugs de dados** conhecidos (a própria exploração do redesign os catalogou como "fora de
  escopo") que corroem silenciosamente o Painel e a publicação. Todos diagnosticados e provados
  abaixo, dois deles com dado real de produção.

Traduzindo para o negócio: **o cliente já usa o produto novo; a consultoria ainda trabalha no
antigo.** É essa assimetria que "deixar a base pronta" precisa resolver.

---

## 2. Auditoria — o que está no ar

### 2.1 Backend, normativo e banco — fechado

Todos os cards do `HANDOFF.md` que dependiam de código estão aplicados em produção (Portal 360
completo, referências REF-01→07, estética, migrations reconciliadas, endurecimento de segurança
SEC-01). Pendências que restam **não são de engenharia**:

| Item | Estado | Trava |
|---|---|---|
| REF-05 (curar `requirement_type` em ILPI/alimentos) | precondição pronta, curadoria em andamento (autorizada 15/08) | curadoria roteiro a roteiro em curso |
| REF-07 — 3 itens sem base vigente (`rj-f-087`, `rj-exc-010`, `rj-exc-011`) | ✅ **resolvido 15/08** | decisão da Ester aplicada em código e produção |
| EMAIL-01 (destinatário canônico + entrega confiável) | ✅ migration e Edge Functions **já estavam publicadas** (conferido 15/08 — a auditoria estava desatualizada) | smoke test real autorizado 15/08 |
| DEBT-02 (dívida de lint, ~500 erros `any`) | nunca iniciado | não bloqueia build/testes; é higiene |

> Nenhum desses quatro é "fazer código e entregar". Três dependem de decisão sua; um (DEBT-02) é
> faxina que pode esperar. Ou seja, **do lado do banco, o handoff está materialmente concluído.**

### 2.2 Frontend / redesign — só a Onda 1 fechou

Confirmado por leitura direta do código em 15/08, não pelo handoff:

| Onda | Cards | Estado real (evidência) |
|---|---|---|
| **1 — Portal** | FE-04a, FE-09, FE-13, FE-10 | ✅ **entregue.** Portal em rotas de seção, plano de ação por unidade, `WeekCalendar`, atrito removido. |
| **2 — Admin** | FE-04b, FE-05, FE-06, FE-07, FE-08 | ❌ **não começou.** Não existem `Table`, `Tabs`, `Pagination`, `Tooltip`, `Drawer`, `PageShell`/`PageHeader` em `src/components/ui/`. Nenhuma rota/página de Plano de Ação do admin (`plano-de-acao` só aparece em arquivos do portal). `Sidebar.tsx:50` ainda é `w-72` fixa e some abaixo de `lg` (sem rail, sem drawer). |
| **3 — Fechamento** | FE-11, FE-12 | ❌ **não começou.** `dark:` aparece **0 vez** em todo `src/**/*.tsx` (dark mode morto). `src/App.css` e `src/components/layout/AdminLayout.tsx` (que o FE-11 manda apagar) ainda no repo. `index.html` ainda descreve o app com marca de terceiro. |

**Consequência prática do meio-caminho:** a fundação nova (tokens, Sora/Source Sans 3, primitivos)
convive com o CSS antigo. Onde o admin ainda roda, coexistem cinco larguras de container, inputs
copiados à mão e `alert()`/`confirm()` nativos. Não está quebrado — está inconsistente, e a
consultoria paga isso em atrito diário.

---

## 3. Avaliação do InspecVISA hoje

### 3.1 O que está forte

1. **A espinha sanitária é sólida e defensável.** Referências resolvidas por chave canônica contra
   biblioteca curada, autoria vinda de dado (não de regex), norma revogada com substituta marcada.
   O laudo não cita norma que a inspeção não avaliou nem inventa base legal — a queixa de "inventado
   pela IA" foi resolvida na raiz (eram fallbacks determinísticos, não IA).
2. **Integridade de dado de cliente real é levada a sério.** Migração de respostas preservando fotos
   por `response_id`, plano de ação como cópia separada (o cliente nunca toca em `responses`),
   deduplicação por `source_item_id`, relatório concluído congelado por snapshot.
3. **Segurança multi-tenant madura.** Escopo por `private.my_tenant_ids()` + `is_tenant_staff`, RPCs
   `security definer` com `search_path=''` e grant explícito aos dois papéis, buckets privados com
   URL assinada. SEC-01 endureceu o que a revisão E2E achou.
4. **O portal do cliente é a superfície mais bem resolvida do produto.** Navegação por seção,
   agrupamento por unidade, calendário compartilhado, link público por unidade sem login.

### 3.2 Onde está o risco

1. **Assimetria admin × portal.** O produto tem duas idades convivendo. Quanto mais tempo assim,
   mais caro o merge (o handoff já registra: "duas implementações parecidas divergem em três meses").
2. **Quatro bugs de dados silenciosos** (seção 4). O pior traço deles é que **não gritam** — o Painel
   mostra número errado com cara de número certo, e o relatório deixa de publicar sem ninguém ver.
3. **Dark mode é uma promessa não cumprida.** Há toggle no store, `darkMode:'class'` no Tailwind e
   zero classe `dark:`. O botão existe e não faz nada — pior que não ter.
4. **Dívida de lint (~500 `any`).** Não bloqueia, mas apaga sinal: um `any` novo e perigoso se
   esconde no meio de 500 inofensivos. E `tsc --noEmit` limpo já deixou o build do Vercel quebrar.
5. **Zero cobertura de comportamento legível.** Há 358 testes unitários e suítes SQL, mas nenhuma
   descrição de *o que o produto faz* que a consultora (ou um Claude numa sessão nova) leia sem
   abrir código. É o buraco que o Gherkin desta entrega começa a fechar.

### 3.3 Nota honesta

O InspecVISA **não é um protótipo** — é um produto em produção com clientes reais, dado sanitário
real e um portal que uma rede de 13 unidades já usa. A base é boa. O que falta não é reescrever; é
**terminar a metade do redesign que ficou e tapar quatro vazamentos conhecidos.** Depois disso, sim,
dá para avançar em funcionalidade nova sem construir sobre areia.

---

## 4. Os 4 bugs de dados — diagnóstico provado e conserto

Catalogados como "fora de escopo" na exploração do FE-08/FE-09 e nunca corrigidos. Confirmados hoje.

### Bug #1 — filtro de consultora do Painel devolve zero em planos de ação e evidências

**Onde:** `admin_operational_counts` / `admin_operational_items`
(`supabase/migrations/20260808113928_admin_operational_overview.sql:119,135,279,293,309,325`).

**O que acontece:** os blocos `action_items_overdue` e `evidence_pending` filtram consultora por
`lower(btrim(client_action_items.responsible))`. Mas `responsible` guarda **setor**, não pessoa.
Prova com dado de produção (contagem por valor):

| `responsible` | itens |
|---|---|
| Gerência / Administração | 184 |
| (null) | 88 |
| Equipe de Manutenção | 49 |
| Responsável Técnico (RT) | 47 |
| Proprietário | 14 |

Nenhuma linha é nome de consultora ("Ester Caiafa", "Ana Roberta Ribeiro"). Logo, filtrar o Painel
por consultora **zera esses dois blocos sempre** — a consultora nunca vê os próprios planos vencidos.

**Conserto:** a atribuição real vive em `inspections.consultant_names` e
`appointment_requests.consultant_names` (ambas ARRAY, confirmadas). `client_action_items` tem
`inspection_id` e `appointment_request_id`. Filtrar por essas colunas (padrão `unnest` +
`lower(btrim)`, igual ao bloco de compromissos já faz com `schedules.consultant_names`), nunca por
`responsible`. Regra da casa: **atribuição por `consultant_name`, jamais por `user_id` nem por setor.**

### Bug #2 — Painel conta itens que o cliente não vê

**Onde:** mesma migration, blocos `action_items_overdue` e `evidence_pending`.

**O que acontece:** a RPC do cliente (`client_portal_action_items`,
`20260807102311_client_action_items.sql:346`) exclui em tempo real todo item de relatório oculto
(`appointment_requests.report_hidden = true`). O Painel do admin **não faz esse join** — filtra só
`client_action_items.status = 'published'`. Um relatório ocultado *depois* da projeção some para o
cliente mas continua contando no Painel. Número inflado, silencioso.

**Conserto:** espelhar o join que a RPC do cliente já usa —
`left join appointment_requests ar on ar.id = i.appointment_request_id` +
`coalesce(ar.report_hidden,false) = false`. O `appointment_request_id` já existe na tabela e já tem
índice (`client_action_items_request_idx`). **Um único join conserta os bugs #1 e #2 juntos.**

### Bug #3 — prazo em texto livre vira item que nunca vence

**Onde:** `deadlineToDays()` em `src/utils/clientActionPlan.ts:26`.

**O que acontece:** o regex casa `^(\d+)\s*(hora|dia|semana|mês)$`. "assim que possível",
"imediatamente", "o quanto antes" → `null` → o item vai ao portal **sem prazo** e **nunca** conta
como vencido, nem para o cliente nem para o Painel.

**Natureza:** é **em parte by design** — não dá para datar "assim que possível" sem inventar data, e
inventar data num laudo é pior que não ter. O conserto certo **não é forçar uma data**, é:
(a) reconhecer as frases claramente imediatas ("imediato/imediata" já vira 0; acrescentar
"imediatamente", "o quanto antes", "urgente") e (b) **dar visibilidade** — o item sem prazo não pode
sumir; tem de aparecer no Painel como "sem prazo definido", um sinal próprio, não um silêncio.

### Bug #4 — publicação silenciosa falha sem vínculo

**Onde:** `src/pages/InspectionSummary.tsx:456-458`.

**O que acontece:** ao gerar o PDF final, se não houver `linkedRequest` (agendamento/solicitação
vinculado), o relatório, os scores e o plano de ação **não são publicados no portal** — e o único
sinal é um `console.warn` que ninguém lê. A consultora acha que entregou; o cliente não recebe nada.

**Conserto:** trocar o `console.warn` por um **aviso visível** (`Toast`, já montado no app via
`useToastStore`/`<Toaster/>`) explicando que o PDF foi gerado mas não publicado por falta de vínculo,
com o caminho para vincular. Não inventa vínculo — **torna a falha visível**, que é o que faltava.

> **Bugs #1 e #2** tocam o banco → migration nova + atualização do fixture
> `supabase/tests/admin_operational_overview.test.sql`, teste em Postgres 16, aplicação em produção
> (autorizada por você em 15/08) e push. **Bugs #3 e #4** são só frontend/util → vitest + build + push.

---

## 5. Pesquisa de melhorias (consultando o MCP DesignMD)

Além de terminar o planejado, o que **aprimora** o produto. Organizado pelos quatro eixos pedidos.
Padrões de UI referenciados vêm do catálogo DesignMD (consultado nesta sessão; só descrições
genéricas de layout foram enviadas — nunca dado de cliente, conforme parecer de segurança do handoff).

### 5.1 Funcionalidades

| Melhoria | Por quê | Custo |
|---|---|---|
| **Fechar a Onda 2 (Admin)** — shell com rail, `PageShell`, `Table` densa, tela de Plano de Ação (lista+detalhe) | É o maior salto de valor: acaba a assimetria admin×portal. Padrões DesignMD: `dashboard-layout`, `data-table`, `stats-cards`. | alto |
| **Painel confiável** (bugs #1/#2) + sinal de "sem prazo" (bug #3) | O Painel operacional é a tela de decisão da consultora; hoje mente em três dimensões. | baixo-médio |
| **Aviso de publicação** (bug #4) + confirmação de entrega ao portal | Fecha o buraco entre "gerei o PDF" e "o cliente recebeu". | baixo |
| **Dark mode de verdade** (FE-12) | Tokens já existem nos dois temas; falta ligar. Ferramenta de trabalho usada de dia e de noite. | médio |

### 5.2 Segurança

| Melhoria | Por quê |
|---|---|
| **Auditar grants de toda RPC pública nos dois papéis** (`anon` **e** `authenticated`) | O cliente Supabase é único; já quebrou em produção uma RPC pública sem grant a `authenticated`. Vale um teste que varre `pg_proc` e falha se alguma RPC pública tiver só um papel. |
| **Expiração/limpeza de buckets privados** | Auditoria de 10/08 confirmou: `inspection-photos`/`client-portal-files` são privados mas **sem TTL/cron** — arquivo fica até apagarem à mão. Definir retenção. |
| **Rate limit visível nas RPCs de escrita do portal** (evidência, solicitação, declaração de status) | Superfície pública por token. Confirmar limites e observabilidade. |
| **Fechar EMAIL-01** | Enquanto não publica, confirmação de agendamento depende do caminho antigo. |

### 5.3 Usabilidade

| Melhoria | Padrão DesignMD |
|---|---|
| **Tela de Plano de Ação do admin** (situação + ação recomendada legíveis, sem abrir relatório) | `data-table` (índice) + painel de detalhe lateral |
| **Aba de Arquivos do cliente** com miniatura, data pt-BR, paginação e "Abrir" (corrige o N+1 e a rolagem infinita) | `data-table` + `empty-state` |
| **Estados vazios e de erro reais** (hoje: `alert()`/`confirm()` nativos no admin) | `empty-state`, `error-state`, `confirmation-dialog`, `toast-notification` |
| **Densidade com respiro** nas listas grandes (tabela no desktop, card no mobile) | `data-table` responsiva |

### 5.4 Intuitividade / experiência

| Melhoria | Padrão DesignMD | Nota |
|---|---|---|
| **Command palette (`Ctrl/Cmd-K`)** — ir a cliente, inspeção, unidade ou ação sem caçar no menu | `command-palette` | **Não está em nenhum card hoje.** Ganho grande numa ferramenta densa de dados; é o atalho que transforma "onde fica isso?" em duas teclas. |
| **Rail colapsável com tooltip + ordem por uso** (FE-06) | `sidebar-nav` | Já planejado; reforça a intuitividade. |
| **`stats-cards` com tendência no topo do Painel** | `stats-cards` | Contexto num relance: "3 vencidos, +2 desde ontem". |
| **Onboarding leve do portal por conta** | `onboarding-flow` | PORT-04 já semeou tutorial; o padrão sugere o "primeiro momento de valor". |

> A única melhoria **fora do que já estava mapeado** é o **command-palette** — vale registrar como
> card novo (`FE-14`, sugestão) porque muda a intuitividade do admin inteiro por custo médio.

---

## 6. Novo plano — para "deixar a base pronta antes de avançar"

Ordem pensada para: primeiro parar o sangramento (bugs), depois terminar o redesign (a assimetria),
depois higiene. Nada aqui é funcionalidade nova além do command-palette (opcional).

### Fase A — Parar o sangramento (esta semana)
1. **Bugs #1+#2** — migration corretiva do Painel + fixture + Postgres 16 + prod + push. *(autorizado)*
2. **Bugs #3+#4** — visibilidade de "sem prazo" e aviso de publicação. vitest + build + push.
3. **Teste-guardião de grants** — varre RPCs públicas e falha se faltar papel.

### Fase B — Fechar a Onda 2 (Admin) — a assimetria
4. **FE-04b** — `Table`, `Tabs`, `Pagination`, `Tooltip`, `Drawer`, `PageShell`, `PageHeader`.
5. **FE-08** — tela de Plano de Ação (lista+detalhe). Consumindo `client_action_items` já corrigido.
6. **FE-06** — rail colapsável + drawer mobile + nova ordem do menu.
7. **FE-07** — aba de Arquivos + corrigir o N+1 de `listAttachments`.
8. **FE-05** — larguras `max-w-*` → `PageShell` (~15 páginas; candidato a Codex/varredura).

### Fase C — Fechamento
9. **FE-12** — ligar dark mode no app inteiro (tokens já prontos).
10. **FE-11** — higiene: apagar `AdminLayout.tsx`, `App.css`, corrigir marca no `index.html`.
11. **DEBT-02** — dívida de lint, por diretório, um PR por fatia.

### Fase D — Avançar (só depois de A–C)
12. **FE-14 (novo)** — command-palette `Ctrl/Cmd-K`.
13. Retenção de buckets, EMAIL-01 (quando você autorizar), e o que a base sólida destravar.

### Paradas que dependem só de você (não de código)
- **REF-05** e os **3 itens do REF-07**: decisão sanitária item a item.
- **EMAIL-01**: autorização para publicar.

---

## 7. O que esta entrega já produz

- Este documento (auditoria + avaliação + pesquisa + plano).
- **Gherkin do produto inteiro** em `docs/gherkin/*.feature` — documentação viva do comportamento,
  em pt-br, por domínio (a linha de base de comportamento que faltava; ver 3.2 item 5).
- **Correção dos 4 bugs de dados** da Fase A, aplicada em produção e no `main`.

O resto do plano (Fases B–D) fica mapeado card a card para as próximas sessões, com o modelo sugerido
herdado do `HANDOFF-FRONTEND.md`.
