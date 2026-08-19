# Auditoria do admin — base da Onda 4 (frontend)

**Medido em:** 16/08/2026, direto no código de `src/` (não é impressão, é contagem).
**Para que serve:** é a fonte do diagnóstico da Onda 4. Antes de abrir card `FE-14+`, ler isto.
**Relacionado:** [HANDOFF-FRONTEND.md](HANDOFF-FRONTEND.md) · [mapa-paginas-admin.md](mapa-paginas-admin.md)

> ## O que deste diagnóstico já foi fechado — atualizado em 16/08/2026
>
> **Este documento é a foto do problema em 16/08 de manhã. Não apagar: ele é a evidência do
> "antes".** O que mudou desde então:
>
> | Achado daqui | Card | Estado |
> |---|---|---|
> | Duas home telas concorrentes | FE-14 | ✅ `/` absorveu o Painel; `/painel` é redirect |
> | 114 `alert()`/`confirm()` nativos | FE-15 | ✅ 115 ocorrências migradas; `ConfirmDialog` existe |
> | `ClientDetails.tsx` com os 7 achados | FE-16 | ✅ identidade no topo, 3 abas, aba na URL |
> | Solicitações, Roteiros e Biblioteca sem desenho | FE-17 | ✅ tabela densa + `Drawer` nas três |
> | Editor de roteiro sem desenho | FE-17b | ✅ master-detail + "Aposentar item" |
> | Sincronização sem desenho | FE-18 | ✅ linha do tempo, fila que falhou tratada |
> | Configurações sem desenho | FE-19 | ✅ nav de seção lateral, salva por seção, seção na URL |
> | Estados vazio/carregando/erro e `PageHeader` | FE-20 | ✅ padronizados em 7 listas do admin |
> | 2.856 classes de cor cruas · 0 `dark:` | FE-21 · FE-12 | ✅ **FE-21**: 2.705 classes + 20 hex viraram token (recontado; a auditoria contava também os protótipos HTML) · ✅ **FE-12** (dark mode) entregue em 19/08, por variável CSS |
> | `Clients` e `Inspections` ainda em cards | FE-22 | ✅ resolvido de outro jeito: **cards continuam o padrão** e a tabela densa virou alternador (decisão 34, Ester em 17/08); paginação nas duas visualizações |
>
> **O que este diagnóstico não viu, e foi acrescentado em 16/08 (FE-23 a FE-27):** o fluxo
> `/new` → `/execute` → `/summary`, os ~225 controles de formulário crus, `SmartImporter` e as
> telas de entrada, as duas páginas públicas sem login, e a ausência de um gate de regressão
> visual. **Estado card a card: "Onde estamos", no topo do [handoff](HANDOFF-FRONTEND.md).**

---

## O achado central

A Onda 2 entregou **fundação e casca**, não as telas. `FE-04b` criou os primitivos, `FE-05` unificou a
largura, `FE-06` fez o rail, `FE-07` e `FE-08` entregaram duas funcionalidades. **O corpo das páginas
continua sendo o desenho antigo** — e o protótipo `fe-02-admin.html`, aprovado em 09/08/2026, nunca
foi adotado.

O caso mais visível é o detalhe do cliente: o protótipo desenhou **abas**
(Visão geral · Inspeções · Arquivos · Portal · Financeiro) e o app continua com a grade 2/3 + 1/3.

## Os números

| Medida | Valor | Comando |
|---|---|---|
| Classes de cor cruas do Tailwind (`text-gray-500`, `bg-red-50`…) | **2.856** ocorrências | `grep -rho "\b\(bg\|text\|border\)-\(blue\|gray\|slate\|green\|red\|yellow\|amber\|indigo\|emerald\|orange\|purple\|teal\)-[0-9]\{2,3\}" src/pages src/components` |
| Tokens da marca (`primary`, `navy`, `secondary`, `amber-soft`…) | ~600 ocorrências | mesmo grep com os nomes da marca |
| `alert()` / `confirm()` nativos | **114**, em **27 arquivos** | `grep -rn "\balert(\|\bconfirm("` |
| Páginas usando `PageHeader` | **1 de 24** (só `ActionPlan.tsx`) | laço sobre `src/pages/*.tsx` |
| Arquivos usando o primitivo `Input` | **1** (`InspectionExecution.tsx`) | `grep -rln "ui/Input"` |
| Campos crus `<input>/<select>/<textarea>` | ~200, sendo **29 só no `ClientDetails.tsx`** | `grep -rc "<input\|<select\|<textarea"` |
| Arquivos usando `Table` | **3** (`ActionPlan`, `ClientDetails`, `PortalDocuments`) | `grep -rln "<TableContainer\|<Table>"` |
| Classes `dark:` | **0** — e continua 0 depois do FE-12 (19/08): o tema troca o valor da variável, não a classe. O botão de tema funciona. | `grep -rc "dark:" src` |

**Leitura:** a paleta oficial do Manual de Marca 2.0 é **minoria dentro do próprio app** — perde de
quase 5 para 1 para o cinza/azul genérico do Tailwind. Enquanto isso não virar token, `FE-12`
(dark mode) é impossível: não há o que trocar.

## Listas que ainda são cards (decisão aprovada em 08/08 era tabela densa)

`Clients.tsx`, `Inspections.tsx`, `ServiceRequests.tsx`, `admin/AdminTemplates.tsx`,
`admin/LegislationsManager.tsx`. Só `SyncCenter.tsx` e as duas telas do `FE-07`/`FE-08` usam `Table`.

## `ClientDetails.tsx` — a tela do print (1.257 linhas)

Grade `lg:grid-cols-3` (`:477`): coluna de 2/3 com **2 cards** e trilho de 1/3 com **7 cards
empilhados**. Consequências medidas no código:

1. **O trilho de 1/3 (~380px) carrega a tabela de arquivos do `FE-07`** (`:656-750`), com miniatura,
   agrupamento por visita e paginação — desenhada para largura cheia. Numa visita com 28 arquivos,
   é uma coluna de "Foto" repetida.
2. **A trilha de auditoria (`:754-800`) renderiza todos os eventos**, sem limite nem paginação, no
   mesmo trilho estreito.
3. **"Resumo do cliente"** — responsável, telefone, endereço, ou seja, a identidade da ficha — é o
   **último** card da página (`:848`, `bg-primary-900`). Está abaixo de tudo.
4. **O gráfico de conformidade ocupa ~200px para dizer "Dados insuficientes"** quando o cliente tem
   menos de 2 inspeções concluídas (`:428-434` monta o `chartData`).
5. **Credenciais do portal em texto puro**, sempre visíveis (`:565-590`): usuário, senha e token.
6. **29 campos crus** e `window.confirm` para excluir cliente (`:402`).
7. O primitivo `Tabs` existe desde o `FE-04b`, com ARIA completo, e **não é usado aqui**.

## Duas home telas concorrentes

`Dashboard.tsx` (`/`, 761 linhas, **31 `<Card>`**) e `OperationalPanel.tsx` (`/painel`, 519 linhas)
respondem à mesma pergunta — "o que precisa de mim agora?" — com dados diferentes e desenhos
diferentes. O próprio `mapa-paginas-admin.md` já registra que Painel, Agendamentos e Solicitações se
confundem entre si. Decisão de produto pendente, não é só layout.

## O que o protótipo FE-02 já resolveu (e só falta implementar)

Painel · Clientes (tabela densa) · **Detalhe do cliente com abas** · Plano de ação · Agendamentos ·
Execução da inspeção.

## O que nunca foi desenhado (é aqui que o DesignMD entra)

No próprio `fe-02-admin.html` estas rotas são "esboço", uma tela cinza de marcação:

**Início** · **Solicitações** · **Roteiros** · **Biblioteca** · **Sincronização** · **Configurações**

Mais, fora do protótipo: `NewInspection` (wizard), `InspectionSummary` (fechamento/PDF),
`TemplateEditor`, `SmartImporter`, `TemplateDetail`.

E um primitivo que não existe em lugar nenhum: **diálogo de confirmação** — é ele que mata os 114
`alert()`/`confirm()`.

## Padrões do catálogo a consultar antes de desenhar

`dashboard-layout`, `list-view`, `data-table`, `settings-form`, `confirmation-dialog`,
`empty-state`, `error-state`, `loading-skeleton`, `filter-panel`, `stats-cards`, `timeline`,
`dropdown-menu`, `tabs`.

## Estado do MCP do DesignMD (16/08/2026)

Funcionando, com token pessoal do plano Builder. Três coisas o derrubavam, todas corrigidas hoje:

1. URL **sem `www`** → `307` → o `Authorization` é descartado no redirect → `401`.
   Usar sempre `https://www.designmd.co/api/mcp`.
2. `~/.claude.json` tinha **duas** entradas para o projeto — `C:\Saas\App` (aprovada) e `C:/Saas/App`
   (vazia). Conforme a sessão abrisse, caía na não aprovada e o servidor sumia. Corrigido nas duas
   (backup: `~/.claude.json.bak-designmd-16ago`).
3. O token free era **público e compartilhado**: 150 requests/dia para todos juntos, `429` com
   `Retry-After: 86400`.

`.mcp.json` **saiu do git** (`git rm --cached` + `.gitignore`) — o handoff já exigia isso para token
pago. **O trial vence em 23/08/2026; cancelar até 22/08.**
