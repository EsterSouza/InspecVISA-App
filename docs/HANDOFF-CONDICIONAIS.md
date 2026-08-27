# HANDOFF — Motor de condicionais, aplicabilidade e roteiros adaptativos

> Aberto em 16/08/2026. Cards com prefixo `COND-`.
> **Origem:** plano de 13 cards escrito pelo ChatGPT, revisado contra o código em 16/08/2026. A
> estrutura e a ordem dele foram mantidas; o que mudou está registrado em
> [O que mudou do plano original](#o-que-mudou-do-plano-original), com a evidência de cada correção.
> **Natureza:** domínio + banco + motor + editor + execução + relatório. Não é feature de formulário.

---

## Onde estamos

**COND-01 a COND-08 entregues** (COND-01/02 em 16/08/2026; COND-03 em 18/08/2026; COND-04 em
19/08/2026; COND-05 em 20/08/2026; COND-06, COND-07 e COND-08 em 27/08/2026), com as **4 decisões de produto tomadas** pela Ester
([contrato § 10](contrato-aplicabilidade.md)) — inclusive a de que existe **uma árvore só**, com o
papel virando filtro de exibição. O motor declarativo existe e é testado isoladamente em
`src/domain/applicability/`. O COND-03 fez a execução parar de manter duas árvores, congelou a
revisão do roteiro na criação da inspeção (com lazy-freeze para o legado em andamento) e reescreveu
`resolveReportTemplate` para nunca reconstruir do roteiro vivo. O COND-04 decidiu o formato físico
— `public.checklist_template_revisions`, rascunho × publicada — e o aplicou em produção, com a
tabela vazia: **nenhum roteiro tem revisão ainda**, então nada mudou de comportamento. **O motor de
aplicabilidade ainda não é consultado**: a árvore congelada tem `rules`/`routingQuestions` vazios
até o COND-06 criar a primeira revisão. O COND-05 fechou o outro lado da ponte: a pergunta de
roteamento tem tipo, momento (wizard × campo), opção estável e obrigatoriedade; a inspeção nasce com
o **contexto congelado** e com o vínculo da revisão publicada; e o wizard já pergunta o que dá para
saber antes da visita. O COND-06 abriu a porta: o editor de roteiro ganhou o construtor de
condições, o painel de perguntas de roteamento e as travas do ciclo de vida — **a primeira revisão
já pode ser criada e publicada pela tela**. O COND-07 fechou o lado da autoria: dá para **testar o
roteiro inteiro sem criar cliente nem inspeção**, com o cenário editável e a justificativa de cada
decisão em tela, e a publicação passou a ser **bloqueada de verdade** — o botão só habilita com o
gate limpo, e a lista de bloqueios diz a causa e a seção onde ela mora. **O COND-08 fechou o
circuito**: a execução consulta o motor, local e sem rede; a pergunta de campo tem lugar próprio; o
que sai do roteiro vai para uma lista com o motivo, sem apagar resposta; retirar item já respondido
pede confirmação com número; pendência de condição segura o encerramento e "não foi possível
determinar" o libera; e as respostas de roteamento convergem **por pergunta** entre dois aparelhos.
Como nenhum roteiro tem revisão publicada em produção, **nada mudou de comportamento ainda** — sem
regra = sempre aplicável. Próximo é o `COND-09` — score, progresso, resumo, PDF, referências e plano
de ação sobre o conjunto de aplicáveis, que é o que fecha a invariante das cinco superfícies.

| Card | O que é | Modelo | Esforço | Depois de |
|---|---|---|---|---|
| ~~**COND-01**~~ ✅ | Auditoria + contrato de domínio e invariantes · `docs/mapa-roteiro-inspecao.md`, `docs/contrato-aplicabilidade.md`, `docs/gherkin/aplicabilidade.feature` | Opus 5 | alto | — |
| ~~**COND-02**~~ ✅ | Schema declarativo + motor puro + validador · `src/domain/applicability/` | Opus 5 | alto | COND-01 |
| ~~**COND-03**~~ ✅ | `EffectiveTemplate` canônico + **congelamento na criação da inspeção** · uma árvore só | Opus 5 | alto | COND-02 |
| ~~**COND-04**~~ ✅ | Persistência, revisão, RLS e compatibilidade · `checklist_template_revisions` (rascunho × publicada) | Opus 5 | alto | COND-03 |
| ~~**COND-05**~~ ✅ | Perguntas de roteamento e contexto congelado · `domain/applicability/routing.ts`, `context.ts`, wizard | Opus 5 | médio-alto | COND-04 |
| ~~**COND-06**~~ ✅ | Editor visual **com o ciclo de vida junto** · `domain/applicability/authoring.ts`, `components/templates/` | Opus 5 | alto | COND-05 |
| ~~**COND-07**~~ ✅ | Simulador e gate de publicação · `domain/applicability/simulate.ts`, `components/templates/ApplicabilitySimulator.tsx` | Opus 5 | médio-alto | COND-06 |
| ~~**COND-08**~~ ✅ | Execução adaptativa offline e colaborativa · `domain/applicability/execution.ts`, `RoutingQuestionsBlock`, `ExcludedByRulePanel` | Opus 5 | **muito alto** | COND-03 · COND-05 · COND-07 |
| **COND-09** | Score, progresso, summary, PDF, referências e plano de ação | Opus 5 | **muito alto** | COND-08 |
| **COND-10** | Piloto em Estética + flag por roteiro e rollback | Opus 5 | alto | COND-09 |

**Sequência com o frontend:** o `COND-08` e o `FE-23` mexem no mesmo arquivo
(`InspectionExecution.tsx`, 1.322 linhas). Fazer os dois em paralelo é conflito garantido. Decisão:
**FE-23 primeiro**, desenhando os dois espaços novos (onde mora a pergunta de roteamento, como uma
seção condicional se anuncia). `COND-01` a `COND-04` podem correr antes ou junto — não encostam em
UI nenhuma.

---

## 1. Objetivo

O roteiro deixa de ser uma lista linear que vale para todo estabelecimento. Seção, bloco e item
passam a ser aplicáveis conforme característica do estabelecimento, localização, modalidade,
procedimento realizado, equipamento existente e **resposta dada durante a própria inspeção**.

> Realiza processamento de artigos reutilizáveis?
> **Não** → a seção de processamento próprio deixa de ser aplicável.
> **Sim** → o roteiro pergunta se é próprio ou terceirizado, e cada resposta leva a uma ramificação.

O resultado: um roteiro-mestre tecnicamente amplo, sem obrigar cada estabelecimento a responder
tudo. Para cada inspeção, o InspecVISA produz **o roteiro efetivamente aplicável àquela realidade**.

## 2. O que esta funcionalidade não é

- Não é um campo onde alguém escreve `if resposta_23 == "sim" && uf == "RJ"`.
- Não armazena JavaScript, SQL, fórmula executável nem expressão livre. **Nada de `eval()`.**
- Não infere regra sanitária a partir do texto do item.
- **Não usa IA para decidir qual exigência sanitária se aplica.**

O motor é **declarativo, determinístico e auditável**. A consultora configura em linguagem visual;
o sistema guarda uma estrutura restrita, validada e versionada.

---

## 3. Achado que reenquadra o projeto: o motor já existe, hardcoded

Medido em 16/08/2026 em `src/data/templates.ts:383`. **`getEffectiveTemplate` já é um motor de
aplicabilidade** — só que cravado em TypeScript, em seis regras, sem nome e sem tela:

| # | Regra hoje | Onde | O que é, na linguagem do motor novo |
|---|---|---|---|
| 1 | `getExtraSections(client.foodTypes, client.state)` | `templates.ts:400` | seções acrescentadas por contexto (tipo de alimento + UF) |
| 2 | `supplementRegistry` → `entry.appliesTo(template, client)` | `supplementRegistry.ts` | predicado por UF/município, em código (`isBeloHorizonteClient`, `isSaoPauloCapitalClient`, `isRioState`) |
| 3 | `section.applicableFoodTypes` | `templates.ts:417` · tipo em `types/index.ts:98` | **já é uma regra declarativa, num campo do dado** — operador "pertence a uma lista", alvo = seção |
| 4 | `filterSectionsByRole(role, full)` | `templates.ts` | recorte por profissional na ILPI — casa seção **por palavra no título** (`nutri`, `aliment`, `dieta`…) quando o id não bate |
| 5 | `filterRetiredAsOf` | `templates.ts` (FE-17b, 16/08) | aposentadoria com corte por data de início da inspeção |
| 6 | `ChecklistItem.isRJOnly` | avaliada em `templates_alimentos_segmentos.ts:865` | **funciona, mas só nas seções extras de alimentos** — é a única regra de aplicabilidade **por item** que existe hoje. Nos 9 itens do suplemento ILPI RJ é redundante (o suplemento já é RJ-only) |

**Consequências que valem como decisão de projeto:**

1. **Não é "adicionar um motor". É extrair o motor que já existe e torná-lo declarativo e editável.**
2. **`applicableFoodTypes` é o protótipo do schema do COND-02.** Generalizar a partir dele —
   alvo + operador + valor — em vez de inventar do zero.
3. **As seis regras viram a suíte de teste do motor novo.** Se o motor declarativo não reproduzir
   exatamente o comportamento das seis, ele está errado. Rede de segurança que sai de graça.
4. **O motor novo não pode nascer ao lado das seis.** Dois sistemas de aplicabilidade dentro da
   mesma função é o modo de falha "árvores divergentes", só que na mesma linha de código.
5. **A regra 4 é frágil e vira dívida explícita:** casar seção de nutrição por palavra no título
   funciona até alguém renomear uma seção. Sob o motor novo isso passa a ser regra por id.
6. **`isRJOnly` é o melhor caso de migração** — corrigido em 16/08 depois de reler o código: ela
   **funciona** (`templates_alimentos_segmentos.ts:865`) e é a única regra de aplicabilidade **por
   item** que já existe. Vira regra declarativa `contexto.uf pertence a ['RJ']` no COND-03; os 9
   usos redundantes do suplemento ILPI RJ perdem a flag sem mudar comportamento. Nenhum item deixou
   de ser avaliado por engano.

---

## 4. Achado sobre congelamento: existe, é no lugar errado, e se auto-desliga

O plano original trata congelamento como coisa a construir. Existe parcialmente — e com uma falha
já documentada no código.

- `inspection.reportTemplateSnapshot` (`types/index.ts:197`) é gravado **no fim**, ao concluir
  (`InspectionExecution.tsx:816` e `:865`) e no fechamento (`InspectionSummary.tsx:189`). **Não na
  criação da inspeção.**
- `src/utils/reportTemplate.ts:60` tem `snapshotCoversResponses()` — existe porque **um snapshot
  congelado a partir de roteiro filtrado por papel pode não cobrir todas as respostas**. Quando
  isso acontece, o snapshot é descartado e o roteiro é reconstruído a partir do vivo.

**Por que isso é grave com condicionais:** a regra 9.1 (preservar resposta de branch desativado)
garante que vão existir respostas fora da árvore final. Ou seja, o caso em que o snapshot "não
cobre as respostas" **deixa de ser exceção e vira o comportamento normal** — e a salvaguarda se
desliga sozinha, caindo no roteiro vivo. É exatamente o modo de falha "editar roteiro altera
relatório antigo".

**Por isso o congelamento foi promovido para o COND-03**, antes da persistência e muito antes de
qualquer coisa aparecer na tela. O card move o congelamento para a criação da inspeção e reescreve
`resolveReportTemplate` para nunca reconstruir do vivo.

---

## 5. Conceitos que precisam estar fechados antes de qualquer código

### 5.1 Aplicabilidade não é resposta

Um item está em um de três estados de **aplicabilidade**:

1. **Aplicável** — pertence ao roteiro efetivo daquela inspeção e precisa ser avaliado.
2. **Não aplicável por regra** — uma condição configurada determinou que não pertence àquela
   realidade.
3. **Pendente de condição** — falta responder algo para decidir.

Isso é diferente do **resultado sanitário** (`complies` / `not_complies` / `not_applicable` /
`not_observed`, que já existem em `InspectionResponse`). A aplicabilidade se resolve **antes** da
interpretação da resposta.

**Nunca:** item ocultado = N/A · item ocultado = conforme · item ocultado contado como respondido ·
item não aplicável por regra mexendo em score, percentual ou plano de ação.

> **Cuidado específico deste app:** `not_applicable` já existe e já é tratado no
> `src/utils/scoring.ts` (vira nota neutra 3 na escala MARP e é contado à parte). "Não aplicável
> por regra" é outra coisa, e **não pode ser gravado como `not_applicable`** — senão vira resposta
> sanitária que ninguém deu. O COND-01 fecha essa fronteira por escrito.

### 5.2 Dois tipos de pergunta

| | **Requisito sanitário** (o item de hoje) | **Pergunta de roteamento** (novo) |
|---|---|---|
| Conforme / não conforme | sim | **não** |
| Peso e criticidade | sim | **não** |
| Cita legislação | sim | não |
| Gera plano de ação | sim | **não** |
| Entra no score | sim | **não** |
| Aparece como exigência infringida | sim | **nunca** |
| Controla aplicabilidade | não | **é a razão de existir** |

Tipos admitidos na primeira versão: sim/não, escolha única, múltipla escolha, número.
**Texto livre não é fonte de condicional.**

**É a decisão mais importante do projeto.** Sem ela, a tentação é usar "N/A" para controlar a
árvore — e aí navegação lógica e resultado sanitário viram a mesma coisa, contaminando nota,
relatório e plano de ação.

### 5.3 Fontes das condições

1. **Contexto congelado da inspeção** — UF, município, tipo de estabelecimento, recorte
   profissional, modalidade, dados do wizard. **Congelado na abertura:** mudar o cadastro do
   cliente depois não pode alterar a árvore de uma inspeção já iniciada.
2. **Respostas de perguntas de roteamento** — dadas no wizard ou em campo.

### 5.4 Lógica suportada

Operadores: igual · diferente · contém · não contém · maior · maior ou igual · menor · menor ou
igual · existe · não existe · pertence a lista · não pertence a lista.
Grupos: **TODAS** (`AND`) e **QUALQUER** (`OR`), com negação controlada.
`else` existe como caminho alternativo compreensível na tela; internamente o motor normaliza em
condições complementares.

**Na interface, nunca aparecem as palavras AST, predicado ou expressão booleana.**

### 5.5 Níveis de aplicação

Item · seção · e a arquitetura preparada para bloco/módulo reutilizável (roteiro-base + módulo de
injetáveis + módulo de processamento + suplemento regional). **A primeira versão não expõe módulo
na interface** — só não impede a evolução.

---

## 6. Regras inegociáveis

1. **Nunca apagar resposta porque a condição mudou.** Resposta de branch desativado fica guardada,
   sai do resultado enquanto o item estiver fora da árvore, e reaparece se a condição voltar.
   Nada some em silêncio. *(No banco isso já é o comportamento natural: `responses.item_id` não tem
   FK para `checklist_items` — a resposta sobrevive à ausência do item. Aqui isso deixa de ser
   acidente e vira garantia testada.)*
2. **Inspeção iniciada não depende do roteiro vivo.** Ela carrega a revisão usada, com itens,
   seções, perguntas, opções, regras e contexto. Ver o achado da seção 4.
3. **Relatório concluído é imutável.** Editar condicional amanhã não altera relatório entregue,
   PDF, nota histórica nem o plano de ação daquela publicação.
4. **Condição referencia id, nunca texto.** Mudar a redação da pergunta não pode quebrar regra.
5. **Pergunta controladora não é aposentada sem resolver dependência.** Bloquear ou exigir
   correção — nunca deixar referência quebrada. *(Conversa direto com o "Aposentar" do FE-17b.)*
6. **Dependência circular é erro impeditivo**, inclusive indireta (A → B → C → A). Roteiro com
   ciclo não publica.
7. **`null`, desconhecido e falso são coisas diferentes.** Condição sem resposta gera
   indeterminado, não falso automático.
8. **Uma implementação canônica só.** O mesmo avaliador em campo, nos testes, no summary e no PDF.
   Nada de um motor no servidor e outro parecido no React.
9. **Nenhum efeito além de aplicabilidade na primeira versão.** Regra não muda peso, criticidade,
   prazo, ação recomendada, legislação, score, texto, resposta, nem chama RPC.
   **Condição → aplicabilidade. Só isso.**
10. **Erro do motor nunca esconde requisito.** Falha de avaliação tem comportamento conservador e
    **visível** — o item aparece marcado como indeterminado, com erro na tela. Transformar erro
    técnico em conclusão sanitária falsa é o pior desfecho possível deste projeto.

### Compatibilidade

Roteiro sem regra funciona exatamente como hoje: **sem regra = sempre aplicável**. Sem backfill,
sem reinterpretar resposta antiga, sem recalcular relatório anterior.

---

## 7. Os cards

### COND-01 · Auditoria + contrato de domínio

**Opus 5 · alto · escrita em produção: nenhuma**

Auditoria e contrato ficam no mesmo card de propósito: auditoria sem contrato é documento que
ninguém usa, e o contrato precisa da auditoria na mesma cabeça.

**Mapear** todo o caminho do roteiro: `getEffectiveTemplate`, `TemplateService`, roteiros de
`src/data`, roteiros do Supabase, `supplementRegistry`, `NewInspection`, `InspectionExecution`,
`InspectionBundleSyncService`, Dexie, `responses`, `InspectionSummary`, `resolveReportTemplate`,
`inspection_report_versions`, geração de PDF, `client_action_items`, score, progresso, duplicação,
importação e aposentadoria. Em cada seta do diagrama, dizer qual estrutura trafega.

**Formalizar por escrito**, com cenário Gherkin para cada um: significado de aplicabilidade e seus
três estados · fronteira entre "não aplicável por regra" e o `not_applicable` que já existe ·
requisito × pergunta de roteamento · semântica de `null` · AND/OR/else · o que acontece com
descendente já respondido · score · progresso · plano de ação · inspeção em andamento · relatório
concluído · offline · conflito entre duas consultoras.

**Decisões de produto que este card fecha (e sem as quais o resto trava):**

- **Quem responde a pergunta de roteamento, e quando.** Boa parte do contexto **já está no
  cadastro**: categoria, segmento, `foodTypes`, capacidade da ILPI, UF, município. Se as perguntas
  virarem redigitação do que o sistema já sabe, a consultora responde uma dúzia de perguntas por
  inspeção e passa a odiar a feature. Regra a escrever: pergunta de roteamento só existe para o que
  **não** dá para derivar do contexto congelado.
- **Saída para o "pendente" no fechamento.** Pendência de condição impede fechar — mas e se a
  consultora saiu do local sem conseguir determinar? Precisa existir "não foi possível determinar",
  com o item aparecendo **explicitamente como pendente no relatório**, nunca sumindo.
- **`isRJOnly`:** vira regra de verdade ou é removida (ver seção 3).
- **Casamento de seção por palavra no título** (`filterSectionsByRole`): vira regra por id.

**Aceite:** nenhum comportamento ambíguo nos 15 casos obrigatórios (condição simples · AND · OR ·
else · condição não respondida · mudança de resposta · descendente já preenchido · item crítico que
perde aplicabilidade · NC que perde aplicabilidade · offline · duas consultoras · roteiro alterado
depois da inspeção iniciada · relatório concluído · pergunta controladora aposentada · ciclo).
Não iniciar o COND-02 antes disso.

### COND-02 · Schema declarativo + motor puro + validador

**Opus 5 · alto**

Pacote de domínio puro: **sem React, sem Supabase, sem rede, sem banco, sem `Date.now()`**.

- **Schema:** regra = alvo + expressão; expressão = grupo (`all` | `any`) + condições; condição =
  fonte + campo/pergunta (por **id**) + operador + valor. Generalizado a partir de
  `applicableFoodTypes`, que já é isso em miniatura.
- **Motor:** entrada `(template, contexto, respostasDeRoteamento)` → saída
  `(aplicabilidadePorItem, aplicabilidadePorSeção, explicações, estadoDeValidação)`. A
  **explicação** não é extra: é o que responde "por que este item apareceu?".
- **Validador estrutural:** referência inexistente · tipo incompatível · valor inválido · ciclo ·
  pergunta aposentada · opção inexistente · condição impossível · regra sem destino · seção que
  depende de descendente de si mesma · id duplicado.
- **Testes:** tabelas verdade extensivas. **E as seis regras hardcoded da seção 3 como suíte de
  equivalência** — o motor tem que reproduzir cada uma delas.

**Aceite:** determinístico (mesma entrada, mesma saída) e testável isoladamente.

### COND-03 · `EffectiveTemplate` canônico + congelamento na criação

**Opus 5 · alto** — o card que fecha o buraco da seção 4.

- Todas as origens (banco, `src/data`, suplemento regional) produzem **uma representação canônica**
  antes de o motor rodar. O motor não sabe de onde o item veio.
- **Uma árvore só** (decisão da Ester, 16/08 — [contrato § 6.6](contrato-aplicabilidade.md)): a
  execução para de montar `effectiveTemplate` (papel) e `collaborationTemplate` (completa) em
  paralelo. Fica a completa; o papel vira filtro de exibição com "ver tudo". Nota, snapshot, PDF e
  plano de ação passam a usar, por construção, o mesmo conjunto que a tela mostra.
- Com isso, `snapshotCoversResponses()` perde a razão de existir e o fallback que reconstrói do
  roteiro vivo é **removido**, não mantido — o snapshot cobre as respostas por construção.
- Ordem da composição, explícita e testada:
  `base → suplemento regional → substituições (replacesItemId/insertAfterItemId) → condições → congelamento`.
  Suplemento que substitui item **não pode deixar regra apontando para o id anterior** — o
  validador do COND-02 roda depois da composição.
- **Congelar na criação da inspeção**: revisão do roteiro, regras, opções e contexto relevante.
- **Reescrever `resolveReportTemplate`**: nunca reconstruir do roteiro vivo. O caso de
  `snapshotCoversResponses()` retornando falso passa a ser tratado como **erro visível**, não como
  licença para voltar ao vivo.

**Aceite:** inspeção iniciada não muda quando o roteiro é editado · mesma composição online e
offline · roteiro estático e de banco convergem · suplementos preservados · nenhum relatório antigo
muda de conteúdo (comparar PDF antes/depois em amostra real).

### COND-04 · Persistência, revisão, RLS e compatibilidade

**Opus 5 · alto**

O formato físico é decidido **pelo COND-01**, não aqui — pode ser tabela nova, JSONB validado,
tabela de opções, tipo de item, metadados de publicação. Requisitos fixos: isolamento por tenant,
RLS, grants mínimos, referência por id estável, roteiro antigo funcionando sem regra, **zero
backfill destrutivo**, alteração versionável.

**Rascunho × revisão publicada:** regra incompleta pode ser salva, **não pode afetar inspeção
nova**. Só revisão publicada entra em inspeção.

**Aceite:** migration reversível · testes SQL · roteiros sem condição com comportamento idêntico ·
**produção não tocada sem autorização explícita da Ester**.

### COND-05 · Perguntas de roteamento e contexto congelado

**Opus 5 · médio-alto**

Tipos: booleano, escolha única, múltipla escolha, número. Podem viver no wizard de criação (quando
o dado é conhecido antes) ou na execução (quando só em campo se sabe). Id estável, opções estáveis,
possibilidade de ser obrigatória para liberar um bloco.

**Aceite:** nenhuma pergunta de roteamento aparecendo como infração, no score, no plano de ação ou
na lista de exigências do PDF · contexto congelado de fato · a regra escrita no COND-01 sobre não
perguntar o que já está no cadastro, respeitada.

### COND-06 · Editor visual, com o ciclo de vida junto

**Opus 5 · alto** — o ciclo de vida **não** é um card no fim: se duplicar/aposentar/excluir opção
não nascer com o editor, o editor sai quebrado e vira retrabalho.

No item ou seção: `( ) Sempre aplicável` · `( ) Aplicável sob condição`. Construtor com fonte,
operador compatível com o tipo, valor, `TODAS`/`QUALQUER`, `else` compreensível, **resumo em
linguagem humana** ("Exibida quando 'Realiza processamento de artigos?' = Sim") e a lista de quem
depende daquela pergunta. Na navegação lateral, a seção condicional se anuncia
(`12 itens · Condicional`).

**Ciclo de vida, no mesmo card:**
- **Duplicar roteiro / seção** — recriar referências internas; a cópia **nunca** aponta para ids do
  original.
- **Aposentar pergunta controladora** — bloqueada enquanto houver dependente (estende o "Aposentar"
  do FE-17b).
- **Excluir opção referenciada por regra** — bloqueada.
- **Reordenar** não muda lógica. **Alterar texto** não quebra regra.
- **Importador não cria condicional** nesta versão: importa item, a regra é configurada depois.

**Aceite:** nenhuma operação do editor produz referência órfã em silêncio · rascunho inválido pode
ser salvo, **nunca publicado**.

### COND-07 · Simulador e gate de publicação

**Sonnet 5 · médio-alto**

Simulador com contexto e respostas de roteamento editáveis, mostrando aplicáveis / não aplicáveis /
pendentes, por seção, **com a justificativa de cada decisão** ("não aplicável porque Processamento
próprio = Não"). Gate automático bloqueando publicação com ciclo, referência quebrada, condição
impossível, pergunta aposentada, opção inexistente, destino inválido ou branch inalcançável.

**Aceite:** a Ester consegue testar um roteiro inteiro **sem criar cliente nem inspeção real**.

### COND-08 · Execução adaptativa, offline e colaborativa

**Opus 5 · muito alto** — o card mais arriscado. Não misturar com score e PDF.

Recalcular localmente, **sem nenhuma chamada ao Supabase** para mostrar ou esconder item.
Preservar resposta que perdeu aplicabilidade e restaurá-la se o caminho voltar; manter foto e
evidência; recalcular progresso; explicar quando uma seção entrou ou saiu; não dar salto de rolagem.

**Ao mudar resposta controladora que retira item já respondido**, confirmação explicativa —
`ConfirmDialog` do FE-15, variante com lista de consequências:

> Esta alteração fará com que 6 requisitos deixem de ser aplicáveis. As respostas existentes serão
> preservadas no histórico, mas não participarão do resultado enquanto esta condição permanecer.

**Colaboração:** duas consultoras na mesma inspeção precisam convergir para a mesma árvore. Definir
conflito e "última versão válida" da resposta controladora.

**Aceite:** desktop · mobile · offline · reconexão · duas sessões · troca de branch com respostas ·
foto em branch ocultado · reload do navegador.

### COND-09 · Score, progresso, summary, PDF, referências e plano de ação

**Opus 5 · muito alto** — fecha a integridade sanitária.

- **Score:** denominador = requisitos **aplicáveis**. Item não aplicável por regra não entra.
- **Progresso:** "80 de 82 aplicáveis respondidos" ≠ "80 de 100 cadastrados". A tela diz qual é.
- **Summary:** total cadastrado · aplicável · excluído por regra · pendente · respondido.
- **PDF:** mesma árvore da execução, do snapshot — nunca reconstruída do roteiro vivo.
- **Referências de legislação** *(faltava no plano original)*: seção que sai por regra muda a lista
  de normas citadas e a página de referências do relatório. Isso passa pela curadoria da biblioteca
  (norma sem verbete não é citada). O card precisa fechar essa ponta, senão o relatório cita norma
  de seção que não foi avaliada.
- **Plano de ação:** só NC de item aplicável gera ou atualiza pendência. NC preservada em branch
  desativado não gera pendência nova naquele fechamento — e não apaga histórico anterior.
- **Portal do cliente** *(faltava no plano original)*: o cliente vê plano de ação e relatório.
  Garantir que nenhum rótulo do motor ("não aplicável por regra", "pendente de condição") vaze em
  linguagem técnica para o portal.

**Aceite, e qualquer divergência reprova o card:**

```
itens considerados na execução
= itens considerados no score
= itens considerados no summary
= itens considerados no PDF
= itens elegíveis ao plano de ação
```

### COND-10 · Piloto em Estética + flag por roteiro e rollback

**Opus 5 · alto**

**Um roteiro só.** Estética, por já ter volume, suplementos regionais (RJ e SP capital) e situações
naturalmente condicionais. **3 a 5 árvores bem compreendidas**, não 100% das condicionais
possíveis. Para cada uma, a justificativa sanitária escrita.

Ciclo completo antes de expandir: simular vários perfis → inspeção de teste → executar online →
executar offline → mudar branch → summary → PDF → publicar plano de ação → conferir manualmente.

**Flag por roteiro e revisão** (não por tenant — é um tenant só). **Desligar o motor não apaga
resposta**; roteiro sem condicional continua funcionando. Rollback documentado.

**Aceite:** a feature usada de ponta a ponta em um roteiro real antes de encostar em ILPI,
alimentos ou os demais.

---

## 8. Testes que não se negociam

- **Unitários do motor:** tabelas verdade · tipagem · ciclo · `null` · AND/OR · else · numérico ·
  **as seis regras hardcoded da seção 3 reproduzidas**.
- **Integridade de roteiro:** toda referência resolve · nenhuma pergunta aposentada com dependente
  ativo · ids únicos · opção referenciada existe · suplemento não quebra referência.
- **Integração:** criação → congelamento → execução → reload → sync → summary → PDF → plano.
- **Offline:** começar online e perder rede · começar pelo bundle local · mudar condicional offline
  · recarregar · reconectar · sincronizar.
- **Histórico:** alterar roteiro depois da inspeção iniciada · depois do relatório concluído ·
  aposentar item · alterar texto · alterar regra — **relatório antigo byte a byte idêntico**.
- **E2E, três cenários fixos:** (A) branch simples · (B) branch com resposta anterior preservada ·
  (C) branch + offline + publicação.

## 9. Modos de falha a evitar

Item some e resposta é apagada · item oculto continua na nota · item oculto continua no plano de
ação · PDF mostra item que a tela excluiu · PDF omite item que a tela avaliou · editar roteiro
altera inspeção em andamento · editar roteiro altera relatório antigo · regra referencia texto em
vez de id · duplicar roteiro mantém ids externos · aposentar pergunta quebra descendentes · branch
inalcançável · ciclo trava a tela · online e offline calculam árvores diferentes · suplemento
substitui item e quebra regra · cliente muda de município e inspeção antiga muda · pergunta sem
resposta tratada como "não" · pergunta de roteamento entrando no score ou aparecendo como NC ·
regra incompleta publicada · importador inventando condicional · dois dispositivos com árvores
diferentes · regra inválida travando a execução inteira · **erro de condição tratado em silêncio
como "não aplicável"** — este último é o mais perigoso, e é o que a regra inegociável 10 existe
para impedir.

## 10. Definição de pronto do projeto

Regra criada visualmente · validada antes de publicar · ciclo impossível · roteiro simulável ·
inspeção congela sua revisão na criação · execução funciona offline · branch muda sem perda de dado
· score só com aplicáveis · PDF e plano de ação com exatamente o mesmo conjunto · histórico
imutável · roteiro sem regra inalterado · piloto real completo · rollback · testes cobrindo os
invariantes · handoff e Gherkin atualizados **no mesmo commit**.

## 11. Regras operacionais

Um card por sessão, executado isoladamente. Trabalho de outro card que aparecer no caminho vira
achado registrado, **não é absorvido em silêncio**. Nenhuma migration, backfill, seed, escrita em
produção ou deploy sem autorização explícita. Ao fechar um card, registrar: data · resultado ·
arquivos alterados · migration criada · testes executados e resultado · SHA · riscos encontrados ·
o que ficou deliberadamente de fora · qual card foi desbloqueado. E riscar o card na tabela
"Onde estamos", no topo.

---

## O que mudou do plano original

O plano do ChatGPT tinha 13 cards. A estrutura, a ordem das fases e as regras de integridade foram
mantidas — inclusive a decisão central de separar pergunta de roteamento de requisito sanitário, e
a separação entre execução (COND-08) e resultados (COND-09), que é o que evita quatro superfícies
divergirem. O que mudou, e por quê:

| Mudança | Motivo, com evidência |
|---|---|
| **Reenquadrado: extrair o motor que existe, não criar um** | `getEffectiveTemplate` já aplica 6 regras de aplicabilidade hardcoded (seção 3). As 6 viram suíte de teste do motor novo |
| **COND-00 + COND-01 viraram um card** | O próprio plano dizia "não iniciar COND-02 com ambiguidade aberta" — auditoria e contrato são a mesma unidade de trabalho |
| **Congelamento promovido: era COND-04, virou COND-03** | `reportTemplateSnapshot` é gravado no fim, não na criação, e `snapshotCoversResponses()` já se auto-desliga hoje (seção 4). Com branches, o caso vira regra |
| **Ciclo de vida (era COND-10) entrou no editor (COND-06)** | Duplicar/aposentar/excluir opção depois do editor pronto é retrabalho garantido |
| **Rollout (era COND-12) entrou no piloto (COND-10)** | Flag por tenant não faz sentido em tenant único; o que protege é o gate de publicação e o piloto. Observabilidade elaborada seria over-engineering aqui |
| **13 → 10 cards** | Sem tirar nenhuma garantia da lista de "definição de pronto" |
| **Acrescentado: referências de legislação no COND-09** | Seção que sai muda a lista de normas citadas e a página de referências do relatório |
| **Acrescentado: portal do cliente no COND-09** | O cliente vê plano de ação e relatório; rótulo do motor não pode vazar para lá |
| **Acrescentado: quem responde a pergunta de roteamento (COND-01)** | Metade do contexto já está no cadastro; perguntar de novo mata a adoção |
| **Acrescentado: saída para o "pendente" no fechamento (COND-01)** | Consultora que saiu do local sem determinar precisa de "não foi possível determinar", com o item pendente visível no relatório |
| **Acrescentado: fronteira com o `not_applicable` que já existe** | `scoring.ts` já trata `not_applicable` como nota neutra. "Não aplicável por regra" não pode ser gravado assim |
| **Acrescentado: `isRJOnly` e o casamento por título** | Regra morta (15 ocorrências, 0 leitores) e regra frágil (casa seção por palavra no título) precisam de decisão no COND-01 |
| **Acrescentada a sequência com o frontend** | COND-08 e FE-23 mexem no mesmo arquivo de 1.322 linhas |

## Registro de execução

### COND-01 · 16/08/2026 · Opus 5

**Entregue.** Nenhuma alteração funcional, nenhuma migration, nenhuma escrita em produção.

**Arquivos criados:** `docs/mapa-roteiro-inspecao.md` (auditoria e diagrama, com 10 achados
numerados) · `docs/contrato-aplicabilidade.md` (contrato normativo, os 15 casos resolvidos) ·
`docs/gherkin/aplicabilidade.feature` (28 cenários, marcados como alvo e não como comportamento
atual).
**Arquivos alterados:** este handoff · `docs/gherkin/README.md` (índice).

**Testes:** nenhum — o card é documental. O `.feature` traz no rodapé o que já existe hoje e vira
suíte de equivalência do `COND-02`.

**Riscos e achados** (detalhe no mapa): item sem resposta vale "conforme" **só nos índices MARP**,
que hoje não são exibidos — o percentual e a classificação do relatório contam apenas item
respondido; ainda assim, "pendente de condição" jamais pode entrar no conjunto avaliado (A1) ·
o congelamento tem fallback que reconstrói do roteiro vivo, e com branches esse caso vira o normal
(A2) · o contexto já é congelado, a regra não (A3) · a execução mantém **duas** árvores
simultâneas (A4) · duas regras casam seção **por texto do título** (A5) · erro de composição já é
conservador, mas invisível (A6) · itens ad-hoc entram fora do motor (A7) · seções sintéticas do
relatório (A8) · **divergência real hoje**: item aposentado depois do início some da execução e
aparece no Resumo (A9) · publicação do plano de ação falha calada sem vínculo (A10).

**Ficou deliberadamente de fora:** corrigir A9 (é trabalho do `COND-03`), remover `isRJOnly` (é
`COND-04`, e antes disso a Ester precisa conferir os 15 itens), migrar o casamento por texto para
id (`COND-03`).

**Achado fora do escopo, registrado e corrigido no mesmo commit por ser uma linha:**
`docs/gherkin/agendamento.feature` ainda descrevia a régua do calendário como 07h–19h; é 09h–17h
desde 16/08 (FE-13).

**Desbloqueia:** `COND-02` (motor puro), que pode começar sem depender das respostas da Ester.
**Continua travado:** `COND-05` em diante, até as 4 decisões do § 10 do contrato.

### COND-02 · 16/08/2026 · Opus 5

**Entregue.** Nenhuma alteração de comportamento: o pacote é novo e **nenhuma tela, serviço ou
script o importa ainda**. Nenhuma migration, nenhum backfill, nenhuma escrita em produção.

**Arquivos criados** — `src/domain/applicability/`:

| Arquivo | O que é |
|---|---|
| `schema.ts` | tipos do schema declarativo, catálogo de campos de contexto, tabela de operadores por tipo, rótulos pt-BR |
| `values.ts` | comparação de valores (texto normalizado, número, data por `Date.parse`) |
| `validate.ts` | validador estrutural, com `severity` e `disablesRule` |
| `evaluate.ts` | o motor: `evaluateApplicability({ template, context, answers, contextFields })` |
| `index.ts` | superfície pública — é por aqui que COND-03 em diante entra |

**Testes criados** (144 casos, todos passando): `src/__tests__/domain/applicability.test.ts`
(tabelas verdade, `null`, AND/OR, `else`, herança, erro de regra, explicação, determinismo e um
guarda de pureza que lê os fontes e reprova `Date.now`, `fetch`, React, Supabase e Dexie) ·
`applicabilityValidation.test.ts` (os dez erros do card) · `applicabilityEquivalence.test.ts` (as
regras hardcoded do mapa reproduzidas).

**Testes executados:** `npm test` → **526 passando, 0 falhando** · `npm run build` (tsc -b + vite) →
limpo · `npx eslint src/domain src/__tests__/domain` → limpo.

**Suíte de equivalência — o que ficou provado.** Para cada regra hardcoded, o motor declarativo
concorda com o código de hoje em toda a matriz testada:

| Regra de hoje | Tradução declarativa |
|---|---|
| 1 · `getExtraSections` | seção com `contexto.tiposDeAlimento pertence a [tipos do segmento]` — 9 tipos × 4 UFs |
| 2 · `supplementRegistry` | `uf igual X` · `todas[uf, municipio igual/contém]` — 5 suplementos × 11 clientes. A parte que casa o **roteiro-base** continua sendo composição, e é do COND-03 |
| 3 · `applicableFoodTypes` | `contexto.tiposDeAlimento pertence a [...]`, comparado com o `getEffectiveTemplate` real |
| 4 · `filterSectionsByRole` | `contexto.papel pertence a [...]` — reproduzido **como prova de expressividade**, não como destino: § 6.6 já decidiu que papel é filtro de exibição, e por isso `papel` **não** entra no catálogo de contexto de produção |
| 5 · `filterRetiredAsOf` | `contexto.inicioDaInspecao menor que <retiredAt do item>` — sem ler o relógio |
| 6 · `isRJOnly` | item com `contexto.uf pertence a ['RJ']` |

**Duas divergências deliberadas, testadas como tal** (o COND-03 vai vê-las na migração):

1. **Contexto vazio deixa pendente e visível**, em vez de excluir em silêncio. Hoje
   `isRJOnly && !isRioState(undefined)` some com o item; pelo contrato (§ 4.1 e § 5.2) dado ausente
   é indeterminado, nunca "assume não".
2. **Erro de regra aparece.** O `catch` da execução devolve o roteiro sem filtro e só grava
   `console.error` (achado A6); aqui o alvo fica `pendente_de_condicao` com o motivo na explicação.

**Decisões de projeto tomadas dentro do card** (não estavam no contrato, e o COND-06 depende delas):

1. **Um alvo tem no máximo uma regra.** Duas regras no mesmo alvo é ambiguidade, não composição —
   vira `duplicate_rule_target` e nenhuma vale. Quem quer duas condições usa TODAS/QUALQUER.
2. **`else` é a mesma expressão com `branch: 'else'`** (complemento interno). Negar indeterminado
   continua indeterminado, que é como "nem A nem B" do § 5.3 sai de graça.
3. **Grupo de um nível só**, sem aninhamento. Nada no contrato pede `A e (B ou C)`; quando pedir,
   acrescenta-se `grupos` ao `ConditionGroup` sem mexer no resto.
4. **Comparação de texto é normalizada** (sem acento, sem caixa, sem espaço nas bordas). É o que os
   predicados de hoje já fazem, e o cadastro é texto livre. Número, booleano e data comparam estrito.
5. **`pertence a lista` com fonte que já é lista casa por interseção** — é exatamente o
   `some(t => foodTypes.includes(t))` do `applicableFoodTypes`.
6. **O catálogo de campos de contexto é parâmetro** (`contextFields`), não constante fechada: o
   COND-05 acrescenta campo sem tocar no motor, e o teste da regra 4 usa `papel` sem contaminar
   produção.
7. **Erro que impede avaliar ≠ erro que reprova publicação.** `disablesRule` separa os dois. Opção
   inexistente, condição impossível e pergunta aposentada reprovam a publicação mas **não** travam
   inspeção em andamento — é o que faz o caso 14 do contrato funcionar.
8. **Ciclo é grafo entre seções.** Regra de item não cria aresta: a aplicabilidade de um item não
   decide se a seção aparece, então item que depende de pergunta irmã é legítimo. Seção que depende
   de pergunta de dentro de si mesma é laço curto e é acusada.
9. **`date` é tipo de valor de primeira classe**, para reproduzir o corte de aposentadoria sem
   `Date.now()`.

**Ficou deliberadamente de fora:** persistência do schema (`COND-04` decide o formato físico) ·
composição e congelamento (`COND-03`) · qualquer UI. `ChecklistTemplate` **não** ganhou campo novo:
`ConditionalTemplate` é uma forma estrutural que um `ChecklistTemplate` satisfaz, e é o COND-03 que
decide como regra e pergunta chegam até o motor.

**Achados registrados, não corrigidos** (detalhe em [mapa-roteiro-inspecao.md](mapa-roteiro-inspecao.md)):
**A11** — as chaves de `segmentSectionMap` não são as de `FoodEstablishmentType`, então 8 dos 9
segmentos de alimentos nunca carregam seção extra · **A12** — nenhuma seção do repositório declara
`applicableFoodTypes`, então a regra 3 é um `no-op` hoje.

**Desbloqueia:** `COND-03`.

### COND-03 · 18/08/2026 · Opus 4.8

**Entregue.** Nenhuma migration, nenhum backfill, **nenhuma escrita em produção** (o formato físico
da persistência é do `COND-04`). Verificado com seed/testes locais, sem tocar dado real.

**As quatro decisões da Ester deste card:** (1) inspeção legada em andamento sem revisão congelada
**congela na primeira abertura** (lazy freeze); (2) verificação por **seed local**, não amostra de
produção.

**Arquivos alterados:**

| Arquivo | O que mudou |
|---|---|
| `src/data/templates.ts` | `composeCanonicalTemplate()` — a composição canônica única (árvore completa, corte de aposentados por `retiredAsOf`). `filterSectionsByRoleForDisplay()` extraído como **filtro de exibição puro** (o interno `filterSectionsByRole` delega a ele). |
| `src/pages/NewInspection.tsx` | Congela a revisão (`reportTemplateSnapshot = composeCanonicalTemplate(...)`) na **criação** da inspeção, com `createdAt` fixando o corte. Nunca trava a criação: falha na composição cai no lazy-freeze. |
| `src/pages/InspectionExecution.tsx` | **Uma árvore só**: removidas as duas composições paralelas (`effectiveTemplate` por papel + `collaborationTemplate` completa). Agora `frozenBase` (revisão congelada) → `effectiveTemplate` (completa + ad-hoc); `collaborationTemplate` é alias; `visibleSections` aplica o papel só na exibição. Efeito de **lazy-freeze** para inspeção legada. Reincidência remapeia contra a árvore congelada, não o vivo. |
| `src/utils/reportTemplate.ts` | Inspeção **em andamento** lê a revisão congelada; sem snapshot, compõe a canônica **com o corte de aposentados de `createdAt`** (unifica execução e resumo — achado A9). Concluído: snapshot que não cobre agora **registra aviso visível** antes do caminho legado (que segue idêntico, para relatório antigo não mudar). |

**Testes:** `src/__tests__/services/cond03CanonicalFreeze.test.ts` (5 casos: equivalência canônico ==
completo, papel é filtro puro, em andamento lê o congelado e não o vivo, corte de aposentados
unificado A9). `npx vitest run` → **as 6 falhas restantes são pré-existentes no HEAD** (erro de
ambiente `storage.setItem` no persist do zustand em `sync`, `settingsStore`, `ClientPortalAccessibility`;
registradas como tarefa fora de escopo), **0 regressão nova**. `npx tsc -b` limpo · `npm run build`
limpo · `eslint` dos arquivos alterados limpo.

**Achados endereçados:** **A2** (fallback que reconstrói do vivo) e **A4** (duas árvores) resolvidos
pela raiz — uma árvore completa congelada; **A9** (execução × resumo divergem no aposentado)
unificado pelo corte por `createdAt` em ambos os caminhos.

**Persistência — decisão de fronteira:** a revisão congelada vive no **Dexie local**. `mapToPostgres`
tem whitelist de colunas e **não** envia `reportTemplateSnapshot` ao Supabase (nem dá erro); o merge
remoto preserva o snapshot porque `mapFromPostgres` não emite a chave (`{...local, ...remote}`). É o
mesmo mecanismo que mantém o snapshot dos relatórios concluídos. **Coluna/formato físico no Supabase
e convergência entre dispositivos são do COND-04/COND-08.**

**Ficou deliberadamente de fora:** persistir a revisão no Supabase (`COND-04`); perguntas de
roteamento e contexto congelado além do que a inspeção já guarda (`COND-05`); consultar o motor de
aplicabilidade de fato — a árvore congelada carrega regras vazias por enquanto.

**Desbloqueia:** `COND-04`.

### COND-04 · 19/08/2026 · Opus 5

**Entregue.** Migration criada, testada e **aplicada em produção com autorização explícita da
Ester** ("aplique tudo que tiver pendente em produção", 19/08). A tabela nasceu **vazia**: nenhum
roteiro tem revisão, nenhuma linha existente foi lida, alterada ou apagada — zero backfill, zero
mudança de comportamento.

**O formato físico decidido:** uma **tabela nova**, `public.checklist_template_revisions`, com o
conteúdo condicional em dois JSONB de forma validada (`rules`, `routing_questions`) no schema do
COND-02. Uma linha por revisão, `status` `draft` | `published`.

**Por que não foi coluna em `checklist_items` nem tabela relacional de condição:**
`TemplateService.updateFullTemplate` salva o roteiro **apagando todas as seções e itens e
reinserindo com os mesmos ids** (`src/services/templateService.ts:492`). Regra dentro do item — ou
em tabela filha com FK — seria apagada em CASCADE a cada salvamento do editor, em silêncio. Por
isso a regra referencia item e seção **por id, sem FK**, como `responses.item_id` já faz. Há teste
SQL que reproduz o salvamento do editor e prova que as regras sobrevivem.

**Arquivos criados:**

| Arquivo | O que é |
|---|---|
| `supabase/migrations/20260819090603_cond04_applicability_revisions.sql` | a tabela, o gatilho de ciclo de vida, RLS, grants, `inspections.applicability_revision_id` e o gatilho que só aceita revisão publicada |
| `supabase/tests/cond04_applicability_revisions.test.sql` | 11 blocos de caso, fixture próprio |
| `src/services/applicabilityRevisionService.ts` | ler a publicada, salvar/descartar rascunho, publicar (com o validador do COND-02 antes do banco) |
| `src/__tests__/services/applicabilityRevision.test.ts` | 11 casos |

**Arquivos alterados:** este handoff · `docs/gherkin/aplicabilidade.feature` (persistência e o
rodapé, que ainda dizia "até o COND-03") · `docs/migrations-status.md` (a migration nova e a
correção de nome da de 18/08).

**O que o banco garante, e não depende de o app se comportar:**

1. **Isolamento por tenant** — `tenant_id` obrigatório e RLS por `private.my_tenant_ids()` +
   `private.is_tenant_staff()`. As três tabelas do roteiro são globais e liberadas para qualquer
   `authenticated` (dívida antiga); a tabela nova **não** repete isso.
2. **Grants mínimos** — `anon` sem nada (conferido em produção com `has_table_privilege`);
   `authenticated` com select/insert/update/delete e **sem** truncate.
3. **Insert nasce rascunho** — a policy de insert exige `status = 'draft'`: publicar é transição,
   nunca estado inicial.
4. **Publicada é imutável** — gatilho recusa update e delete de linha publicada, inclusive fora do
   RLS. É o que faz "editar condicional amanhã não altera inspeção de ontem" ser garantia de banco,
   não disciplina de código.
5. **Um rascunho por roteiro e tenant** — índice único parcial.
6. **Rascunho aceita regra pela metade; publicar não** — a validação estrutural
   (`private.applicability_payload_is_structural`) roda só na publicação.
7. **Só revisão publicada entra em inspeção** — `inspections.applicability_revision_id` (nullable)
   com gatilho que recusa rascunho e recusa revisão de outro tenant.

**Testes executados:** suíte SQL nova + as 19 existentes em Postgres 16 limpo (container recriado,
`/work` apagado antes do `docker cp`) → **20/20 OK** · `npx vitest run` (suíte JS completa) ·
`npm run build` (tsc -b + vite) · `eslint` dos arquivos novos. Efeito real conferido **em
produção** depois de aplicar: RLS ligada, 4 policies, 2 gatilhos, coluna criada, `anon` sem
privilégio, 0 linhas na tabela. `get_advisors(security)` não acusa nada nos objetos novos.

**Achado que mudou a migration antes de aplicar:** `checklist_templates.id` é **`text`** em
produção, não `uuid` (`20260426140859_convert_template_ids_to_text` — roteiro estático tem id
legível, `tpl-ilpi-v1`). A primeira versão da FK era `uuid` e teria falhado na aplicação; o fixture
do teste também usava `uuid` e passava mesmo assim. Corrigidos os dois — o fixture agora copia os
tipos reais.

**Achado de ledger, corrigido junto:** `20260818090000_legislations_abnt_municipio.sql` estava
aplicada em produção sob a versão `20260818141657` (aplicada pelo MCP, arquivo local nunca
renomeado). Conteúdo conferido no schema real (`legislations.abnt`, `.municipio` existem); o
arquivo local foi renomeado para bater com o ledger. **Nada foi reaplicado.**

**Ficou deliberadamente de fora:** gravar `applicability_revision_id` na criação da inspeção
(`COND-05`) · levar a revisão congelada ao Dexie e ao sync entre dispositivos (`COND-08`) · o editor
que cria regra (`COND-06`) · o gate de publicação com explicação em tela (`COND-07` — aqui só existe
a recusa, com a lista de problemas do validador). Também ficou de fora persistir o
`reportTemplateSnapshot` no Supabase: o vínculo por revisão publicada e imutável dá convergência sem
duplicar o roteiro inteiro em cada inspeção, e o payload do sync já teve problema de tamanho
(`008_trim_sync_batch_payload`).

**Achados fora do escopo:** (1) `npm run lint` já falhava no `main` antes deste card —
`src/components/ui/PromptDialog.tsx:110` exportava componente e hook no mesmo arquivo
(`react-refresh/only-export-components`), o que deixava o job `js` do CI vermelho desde o FE-28.
Registrado aqui e **corrigido em commit separado** logo depois, a pedido da Ester (hook movido para
`usePromptDialog.tsx`; registro em [HANDOFF-FRONTEND.md](HANDOFF-FRONTEND.md), FE-28). (2) as "6 falhas pré-existentes" registradas no COND-03 **não são falhas
do código**: `npx vitest run` direto quebra no `storage.setItem` do persist do zustand, e `npm test`
passa porque o script traz `NODE_OPTIONS=--no-experimental-webstorage`. Rodando `npm test`, são
**568 testes passando, 0 falhando**.

**Risco conhecido:** a validação estrutural em SQL repete a lista de operadores do
`src/domain/applicability/schema.ts`. Operador novo precisa entrar nos dois lugares — o SQL recusa a
publicação se ficar para trás, então a falha é visível, não silenciosa.

**Desbloqueia:** `COND-05`.

### COND-05 · 20/08/2026 · Opus 5

**Entregue.** **Nenhuma migration e nenhuma escrita em produção.** O formato físico já existia
(COND-04); este card só ligou o app nele. Nenhum roteiro tem revisão publicada, então **nada mudou
de comportamento**: o wizard é o mesmo de ontem enquanto não existir pergunta configurada.

**As decisões deste card:**

1. **`askAt` decide onde a pergunta é feita** — `wizard` (o dado é conhecido antes) ou `execution`
   (só em campo se sabe). Ausente ou ilegível vale `execution`: o lado conservador é **perguntar em
   campo**, nunca deixar de perguntar. Pergunta de wizard não participa de detecção de ciclo — ela
   é respondida antes de a inspeção existir.
2. **A resposta guarda o `value` da opção, nunca o rótulo.** Renomear "Terceirizado" para
   "Terceirizado (contrato)" não muda resposta nem quebra regra. Valor fora do catálogo de opções é
   **recusado na entrada**, não gravado torto para o motor descobrir depois.
3. **Obrigatória segura o botão, não esconde nada.** Pergunta obrigatória em aberto impede começar
   a inspeção (e, no COND-08, liberar o bloco); a opcional sem resposta deixa o alvo
   `pendente_de_condicao` — visível, como manda a regra inegociável 10.
4. **"Não foi possível determinar" conta como respondida** para liberar (contrato § 6.4), e é
   distinguível de valor conhecido (`isAnswered` × `isDetermined`).
5. **O contexto congelado é objeto próprio da inspeção** (`applicabilityContext`), montado na
   criação e nunca recalculado. Campo em branco **não entra** no objeto: ausente é indeterminado,
   nunca "assume não" (contrato § 4.1).
6. **§ 4.1 virou checagem de máquina, em nível de aviso.** Perguntar "Qual o estado?" quando `uf`
   já está no contexto é `question_duplicates_context` (warning) — informa no editor, não reprova
   publicação. A lista de sinônimos é curada de propósito: casar por semelhança de texto acusaria
   pergunta legítima.

**Arquivos criados:**

| Arquivo | O que é |
|---|---|
| `src/domain/applicability/routing.ts` | momento da pergunta, normalização da resposta, gate de obrigatória, o que cada pergunta libera e o **contexto declarado** do relatório |
| `src/domain/applicability/context.ts` | o contexto congelado: UF por `toUF()`, número, data — puro e sem relógio |
| `src/utils/inspectionContext.ts` | a ponte com `Client`/`Inspection`: congelar na criação, reconstruir para inspeção legada, `resolveInspectionContext` |
| `src/components/inspection/RoutingQuestionField.tsx` | como a pergunta aparece — um componente só para o wizard e para a execução (COND-08) |
| `src/__tests__/domain/routingQuestions.test.ts` | 24 casos |
| `src/__tests__/services/cond05FrozenContext.test.ts` | 11 casos |
| `src/__tests__/components/RoutingQuestionField.test.tsx` | 5 casos (o que sai do controle é o valor da opção, não o rótulo) |

**Arquivos alterados:**

| Arquivo | O que mudou |
|---|---|
| `src/domain/applicability/schema.ts` | `RoutingQuestion` ganhou `askAt`, `required`, `helpText`; `RoutingScope`; comentário do `value` como id estável da opção |
| `src/domain/applicability/validate.ts` | 6 códigos novos (`question_without_options`, `invalid_option`, `duplicate_option`, `unused_question`, `question_duplicates_context`, `question_id_collides`) e o ciclo passando ao largo da pergunta de wizard |
| `src/domain/applicability/index.ts` | exporta a API do COND-05 |
| `src/types/index.ts` | `Inspection` ganhou `applicabilityRevisionId`, `applicabilityContext`, `routingAnswers` |
| `src/pages/NewInspection.tsx` | busca a revisão publicada, mostra as perguntas de wizard, segura o botão enquanto faltar obrigatória, e **congela o contexto** na criação |
| `src/pages/InspectionExecution.tsx` | lazy freeze do contexto para inspeção em andamento criada antes deste card |
| `src/services/inspectionService.ts` | `applicability_revision_id` no mapeamento (com a ressalva do merge, abaixo) |
| `src/__tests__/domain/applicability.test.ts` | o teste de pureza do pacote passou a cobrir `routing.ts` e `context.ts` |
| `src/__tests__/domain/applicabilityValidation.test.ts` | o helper `codigos()` passou a filtrar **erros** — "não é acusada" sempre quis dizer "não vira erro", e agora existem avisos |

**Aceite do card, item a item:**

1. *Nenhuma pergunta de roteamento como infração, no score, no plano de ação ou na lista de
   exigências do PDF.* Garantido por construção — a resposta de roteamento mora em
   `inspections.routingAnswers`, nunca em `responses` — e testado no pior caso: mesmo que alguém
   grave uma resposta com o id da pergunta, `calculateScore`, `resolveReportTemplate` e o plano de
   ação a descartam, porque o recorte é sempre pelos itens do roteiro
   (`getLatestResponsesByItem`). O id de pergunta que colide com id de item virou **erro** de
   validação.
2. *Contexto congelado de fato.* `applicabilityContext` é gravado na criação e lido por
   `resolveInspectionContext`; o teste muda o cadastro do cliente depois e a árvore não se mexe.
3. *Não perguntar o que já está no cadastro.* Checagem de máquina (aviso) + o wizard só mostra o
   que a revisão declarou como pergunta de wizard.

**Testes:** `npm test` → **610 passando, 0 falhando** (60 arquivos) · `npx tsc -b` limpo ·
`npm run build` limpo · `eslint` dos arquivos novos e alterados limpo · `npm run check:ui` P0/P1 = 0
· `npm run check:contraste` 47 pares nos dois temas. Conferido na sessão logada em `/new`: a
consulta a `checklist_template_revisions` sai com o `template_id` certo, volta vazia, e a tela
segue com os três blocos de sempre.

**Ficou deliberadamente de fora:**

- **Perguntar em campo** (`askAt: 'execution'`) e o "não foi possível determinar" na tela: o
  componente e o modelo estão prontos, mas quem renderiza a execução adaptativa é o `COND-08`.
- **Sync do contexto e das respostas de roteamento entre dispositivos** (`COND-08`): eles ficam no
  Dexie, como o `reportTemplateSnapshot`. Só o `applicability_revision_id` vai ao Supabase.
- **O editor que cria pergunta e opção** (`COND-06`) e o gate visual de publicação (`COND-07`).
- **Contexto declarado no PDF** (`declaredRoutingContext` já existe e está testado; imprimir é
  `COND-09`).

**Riscos conhecidos, registrados:**

1. **O caminho do bundle não leva o vínculo.** `public.sync_inspection_bundle` tem lista fixa de
   colunas (`20260812112448_automatic_action_plan_custom_items.sql:214`) e ignora
   `applicability_revision_id`. O upsert direto (`repositoryService`) leva. Por isso
   `mapFromPostgres` **só emite a chave quando o servidor tem valor**: emitir sempre faria o merge
   `{...local, ...remote}` apagar o vínculo local. Enquanto nenhuma revisão existir, o campo é
   nulo dos dois lados. Resolver de verdade é do `COND-08`.
2. **A validação estrutural em SQL não conhece `askAt`.** Ela tolera chaves novas, então revisão
   com `askAt` inválido publica — e o app trata como `execution`, que é o lado seguro (pergunta
   aparece em campo). Sem migration, de propósito.

**Desbloqueia:** `COND-06`.

### COND-06 · 27/08/2026 · Opus 5

**Entregue.** O editor de roteiro passou a criar e publicar revisão de aplicabilidade. Até aqui
`checklist_template_revisions` estava vazia e o motor não era consultado por ninguém; agora existe
o caminho pela tela — **nada muda para inspeção que já roda**, porque quem lê a revisão na execução
ainda é o `COND-08`.

**O ciclo de vida nasceu junto, como o card exigia.** Não é card no fim: duplicar, aposentar e
excluir opção foram escritos com o editor, não depois dele.

| Operação | O que acontece | Por quê |
|---|---|---|
| Aposentar pergunta controladora | **Bloqueada** enquanto houver regra dependente | a regra ficaria apontando para pergunta que ninguém responde: o alvo cairia em `pendente_de_condicao` para sempre |
| Excluir opção citada por regra | **Bloqueada** | vira `unknown_option`, e a consultora só descobriria na hora de publicar |
| Excluir pergunta | **Bloqueada** com dependente (mesma trava) | idem |
| Remover seção ou item com condição | **Permitida, nunca calada**: a confirmação lista as condições que saem junto | remover item é operação legítima; o que não pode é a regra virar órfã em silêncio |
| Duplicar seção / item | A cópia recebe **id novo** em seção, item e regra, e a regra copiada é reescrita para o alvo da cópia | cópia que herda id edita o que já está em inspeção |
| Reordenar | Não toca em regra nenhuma | a regra guarda id, não posição |
| Reescrever pergunta ou rótulo de opção | Não toca em regra nenhuma | a regra guarda id, não texto (regra 4 do handoff) |

**Arquivos criados:**

| Arquivo | O que é |
|---|---|
| `src/domain/applicability/authoring.ts` | puro: resumo em linguagem humana (`describeRule`), quem depende de quem, as duas travas, e a duplicação que remapeia id |
| `src/components/templates/useApplicabilityDraft.ts` | estado da tela: carrega rascunho (ou parte da publicada), salva sem validar, publica com validação |
| `src/components/templates/ApplicabilityFieldset.tsx` | o construtor: `( ) Sempre aplicável` · `( ) Aplicável sob condição`, operador compatível com o tipo, `TODAS`/`QUALQUER`, `else`, resumo |
| `src/components/templates/RoutingQuestionsPanel.tsx` | as perguntas de roteamento, as opções e a lista de quem depende de cada uma |
| `src/__tests__/domain/applicabilityAuthoring.test.ts` | 28 casos |
| `src/__tests__/components/ApplicabilityEditor.test.tsx` | 15 casos |

**Arquivos alterados:** `src/domain/applicability/index.ts` (superfície pública do COND-06) ·
`src/pages/admin/TemplateEditor.tsx` (seção passa a ser selecionável, índice anuncia
`N itens · Condicional`, duplicar seção, travas na remoção, painel e barra de publicação) ·
este handoff · `docs/mapa-paginas-admin.md`.

**Decisões de projeto tomadas dentro do card:**

1. **"Sempre aplicável" é a ausência de regra**, não uma regra que diz sim. O validador acusa
   `duplicate_rule_target`, então o modelo da tela é alvo → regra ou nada.
2. **O `else` se anuncia como caminho complementar**, nunca como "o resto": a frase é *"Exibida
   quando não for o caso: …"*. Indeterminado continua indeterminado nos dois lados (contrato § 5.3).
3. **Trocar a fonte troca o operador** quando ele deixa de caber (texto não tem "maior que"), em
   vez de deixar regra impossível na tela esperando o gate recusar.
4. **Publicar salva a árvore antes.** A validação roda contra o que está **no banco**: regra que
   mira item ainda não salvo seria referência órfã. Por isso `handlePublish` persiste o roteiro e o
   rascunho antes de chamar `publishDraft`.
5. **Pergunta com opção nunca vira campo livre.** O valor guardado é o id da opção — digitar à mão
   é exatamente como nasce `unknown_option`.

**Testes:** 43 casos novos (28 de domínio, 15 de componente). Suíte inteira **687 → 702, todos
verdes**, 0 regressão. `npx tsc -b` limpo · `npm run build` limpo · `npm run lint` limpo.

**Ficou deliberadamente de fora:** o simulador e o gate visual com explicação de cada erro
(`COND-07` — aqui a recusa da publicação lista os problemas, mas não deixa testar o roteiro sem
criar inspeção); a execução consultar o motor (`COND-08`); e o **importador continua não criando
condicional**, como o card determina — importa item, a regra é configurada depois.

**Desbloqueia:** `COND-07`.

### COND-07 · 27/08/2026 · Opus 5

**Simulador e gate de publicação.** O card tinha um aceite de uma frase — "a Ester consegue testar
um roteiro inteiro sem criar cliente nem inspeção real" — e uma lista de sete causas que o gate
tinha de bloquear. Seis já existiam no validador do COND-02. A sétima, **ramo inalcançável**, não
existia: foi escrita agora.

**O que passou a existir:**

| Onde | O quê |
|---|---|
| `domain/applicability/simulate.ts` | `simulateTemplate` (cenário → seção a seção, com contagem), `simulationInputs` (o que perguntar), `publishGate`/`gateFromIssues` (bloqueio × aviso, agrupado por causa), `describeIssueLocation` (id → nome na tela) |
| `domain/applicability/validate.ts` | código novo `unreachable_branch` + `detectTautology`/`covers` |
| `components/templates/ApplicabilitySimulator.tsx` | o painel: cenário editável e resultado com justificativa |
| `components/templates/useApplicabilityDraft.ts` | expõe `gate`, da mesma validação que já rodava |
| `pages/admin/TemplateEditor.tsx` | simulador entre as perguntas e a publicação; botão de publicar **desabilitado** enquanto houver bloqueio |

**Decisões deste card:**

1. **O gate desabilita, não avisa.** Antes o erro aparecia em âmbar e o botão continuava clicável —
   a recusa vinha do servidor, depois de salvar. Agora o botão só habilita com o gate limpo, e a
   recusa do serviço fica sendo o que ela deve ser: a última linha, não a primeira.
2. **A lista de bloqueios é agrupada por causa.** Uma opção renomeada errado rende dez linhas
   iguais; o que se conserta é a causa, uma vez. Daí `GATE_LABELS` e `GateGroup`.
3. **O id vira nome.** O validador é puro e só fala `a regra "w8vmofv"` — foi o que apareceu na
   primeira vez que usei o gate no navegador, e é inútil para quem está consertando.
   `describeIssueLocation` traduz `targetId`/`questionId` para «Seção» e «exigência» **fora** do
   validador, que continua sem depender de texto de tela.
4. **O simulador não esconde nada.** Item fora por regra continua na lista, com o motivo. Esconder
   ali seria repetir exatamente o problema que a feature veio resolver.
5. **Item aposentado não entra na simulação.** O simulador responde "o que apareceria numa inspeção
   **nova**", e inspeção nova nunca vê item aposentado (`getEffectiveTemplate`, decisão 21).
6. **O simulador nasce fechado.** O editor já é longo; o painel abre no clique e o estado do cenário
   morre com a tela — simular não cria inspeção, não toca no rascunho e não publica.

**Ramo inalcançável, o que é.** Um par de condições sobre a mesma fonte que **cobre todos os
valores possíveis** num grupo QUALQUER (`= X` ou `≠ X`; `preenchido` ou `vazio`; booleano `= Sim` ou
`= Não`; `≥ a` ou `≤ b` com `a ≤ b`). A condição nunca é falsa, então um dos dois ramos nunca
acontece — e o alvo ou aparece sempre, ou **nunca aparece em nenhuma inspeção**. O segundo caso é o
grave: requisito sanitário que some sem ninguém perceber é o que o contrato § 6.7 proíbe. O espelho
disso num grupo TODAS contraditório com `branch: 'else'` também virou `unreachable_branch` — a
mensagem antiga (`impossible_condition`, "o alvo nunca seria aplicável") estava **errada** para o
ramo alternativo, onde o efeito é o oposto. Como em `detectImpossible`, o que se detecta são os
pares que aparecem de verdade num editor visual: **não é um SAT solver**, e está escrito no código.
`> 5 ou < 5` de propósito **não** acusa — o valor 5 escapa dos dois lados.

**Conferido no navegador**, com a Ester logada, sem gravar nada: a condição criada em memória
("Exibida quando Realiza procedimento invasivo? é igual a Sim") produziu *23 aplicáveis · 0 fora por
regra · 5 pendentes* sem resposta, virou *23 · 5 · 0* ao responder "Não", e a seção explicou
*"Não aplicável por regra porque «Realiza procedimento invasivo?» é igual a Sim (respondido: Não)"*;
os 5 itens herdaram com *"porque a seção «Instrumentos e materiais» não é aplicável"*. Apagando o
valor da condição, o botão de publicar ficou **desabilitado** com o título *"Publicação bloqueada: 1
problema(s) nas condições"* e a lista mostrou *Valor de comparação inválido · 1* seguido de
*↳ Seção «Instrumentos e materiais»*. Sem rolagem lateral em 375px nem no desktop. **Zero requisição
de escrita** — `checklist_template_revisions` continua vazia.

**Testes:** 55 casos novos (42 de domínio, 13 de componente). Suíte inteira **702 → 758, todos
verdes**, 0 regressão. `npx tsc -b` limpo · `npm run build` limpo · `npm run lint` limpo ·
`npm run check:contraste` sem reprovação.

**Achado fora do escopo, corrigido:** o bloco de aviso do COND-06 usava `text-amber-strong` sobre
`bg-amber-soft` — **2,87:1, reprova AA**. O par certo é `text-amber-soft-ink` (5,10:1), que é o que
o resto do app usa (76 ocorrências contra 9). O `check:contraste` não pegou porque confere uma lista
fixa de pares. Corrigido no bloco que este card reescreveu; **as outras 8 ocorrências continuam
lá** e valem uma varredura própria.

**Ficou deliberadamente de fora:** a execução consultar o motor (`COND-08`) — o simulador prevê o
que a inspeção mostraria, mas a inspeção ainda não consulta a revisão; salvar cenário de simulação
como caso de teste do roteiro (não pedido, e exigiria tabela nova); e o `impossible_condition` para
grupo QUALQUER (contradição ali não impede nada — o outro ramo resolve).

**Desbloqueia:** `COND-08`.

### COND-08 · 27/08/2026 · Opus 5

**Execução adaptativa.** O card mais arriscado da série, e o que faz a condição publicada finalmente
mudar o que a inspeção **mostra**. Até aqui publicar regra mudava o que a revisão guardava; agora a
`InspectionExecution` chama o motor.

**A regra que organizou o card:** o motor roda **local e puro**, na tela. Nenhuma consulta ao
Supabase decide mostrar ou esconder item — nem a primeira. É por isso que a revisão passou a viajar
**dentro da árvore congelada** (`reportTemplateSnapshot.rules` / `.routingQuestions`), que já mora no
Dexie: com ela lá, mudar resposta de roteamento no meio do mato recalcula a árvore na hora.

**Arquivos criados:**

| Arquivo | O que é |
|---|---|
| `src/domain/applicability/execution.ts` | puro: `resolveExecutionTree` (o que a tela mostra × o que saiu, com motivo e resposta preservada), `pendingBlockers` (o que impede fechar), `answerChangeImpact` (o que sai e o que volta), `mergeRoutingAnswers`/`stampRoutingAnswer` (convergência por pergunta), `executionQuestions` |
| `src/components/inspection/RoutingQuestionsBlock.tsx` | a pergunta de campo, com "não foi possível determinar" e a autoria da última resposta |
| `src/components/inspection/ExcludedByRulePanel.tsx` | "Fora do roteiro por condição (N)" — nasce fechado, lista o motivo e marca o que tem resposta preservada |
| `src/utils/routingAnswersSync.ts` | a ponte entre o merge por pergunta e o merge de registro do `RepositoryService` |
| `supabase/migrations/20260827100000_cond08_routing_answers_sync.sql` | três colunas JSONB em `inspections` + `sync_inspection_bundle` levando as quatro chaves |
| `supabase/tests/cond08_routing_answers_sync.test.sql` | 5 blocos de caso, fixture próprio |
| `src/__tests__/domain/applicabilityExecution.test.ts` | 27 casos |
| `src/__tests__/components/AdaptiveExecution.test.tsx` | 9 casos |
| `src/__tests__/services/cond08RoutingSync.test.ts` | 11 casos |

**Arquivos alterados:** `src/pages/InspectionExecution.tsx` (a árvore adaptativa, o lazy freeze da
revisão, o gravador de resposta com confirmação, os dois blocos novos e os dois avisos) ·
`src/pages/NewInspection.tsx` (a revisão publicada entra na árvore congelada na criação) ·
`src/types/index.ts` (`ChecklistTemplate.rules`/`.routingQuestions`/`.applicabilityRevisionId`;
`Inspection.routingAnswersMeta`) · `src/services/applicabilityRevisionService.ts`
(`getRevisionById`, `freezeRevisionIntoTemplate`, `needsRevisionFreeze`) ·
`src/services/inspectionService.ts` (as três colunas no mapeamento — enviadas só quando há valor, e nunca apagando o que é local) ·
`src/services/repositoryService.ts` (a reconciliação antes do merge de registro) ·
`src/components/inspection/InspectionFinishScreen.tsx` (pendência de condição bloqueia entregar) ·
`src/components/inspection/ExecutionSectionIndex.tsx` (a seção pendente se anuncia no índice) ·
este handoff · `docs/gherkin/aplicabilidade.feature` · `docs/migrations-status.md`.

**Decisões deste card:**

1. **A revisão viaja dentro da árvore congelada; o snapshot continua fora do servidor.** O
   `reportTemplateSnapshot` não é persistido no Supabase desde o COND-04 (payload do sync). O que
   sincroniza é o **vínculo** (`applicability_revision_id`) — e revisão publicada é imutável no
   banco, então dois aparelhos que a buscam **por id** leem exatamente a mesma coisa. Convergência
   sem duplicar o roteiro inteiro em cada inspeção.
2. **Item não aplicável sai da lista; seção não aplicável sai inteira.** Os itens da seção que saiu
   **não** são repetidos um a um na lista do que saiu — eles herdaram o estado dela, e 12 linhas
   dizendo a mesma coisa escondem a informação em vez de mostrá-la. Os que **têm resposta** entram,
   porque aí a consultora precisa saber que aquilo saiu do resultado.
3. **Pendente continua na tela, e continua respondível.** A pendência é do *roteiro*, não do
   requisito: travar o campo faria a consultora perder a visita esperando resposta que talvez só o
   dono do estabelecimento tenha. O que a pendência trava é o **encerramento**.
4. **Só item já respondido gera confirmação.** Tirar da tela um item em branco não perde nada e não
   merece diálogo — é a leitura literal do § 6.1 ("uma mudança que retira item já respondido").
   Seção que sai aparece na lista de consequências junto com os itens.
5. **Convergência é por pergunta, nunca pelo objeto.** O merge de registro é `{...local, ...remote}`:
   o lado que vence leva tudo. Para resposta de roteamento isso apagaria, em silêncio, a resposta que
   a colega deu offline a **outra** pergunta. Daí o carimbo (`routingAnswersMeta`: hora + autoria) e
   o merge por chave. Empate de relógio desempata pelo valor serializado — arbitrário, mas **igual
   nos dois aparelhos**, que é o que impede divergência permanente.
6. **Apagar resposta é uma escrita, não a ausência dela.** Limpar guarda `null` explícito com carimbo
   novo; apagar a chave faria o merge ressuscitar a resposta antiga do outro aparelho.
7. **Inspeção que nasceu sem regra não passa a ter regra.** O lazy freeze só busca revisão quando a
   inspeção declara `applicabilityRevisionId`. Sem vínculo, congela vazio — o roteiro-mestre ganhar
   condição amanhã não pode mudar inspeção que já está em campo (contrato § 6.2).
8. **Revisão que não chegou é aviso, não filtro.** Sem rede e sem revisão congelada, a tela mostra o
   roteiro **inteiro** e diz que as condições ainda não foram carregadas. Erro do motor nunca esconde
   requisito (regra inegociável 10) — o lado seguro do erro é sempre "aparece a mais".

**Testes:** 47 casos novos em JS (27 de domínio, 9 de componente, 11 de sync) e 5 blocos em SQL.
Suíte inteira **758 → 810, todos verdes**, 0 regressão (duas execuções seguidas limpas; uma execução
anterior teve 2 falhas por *timeout* de worker do vitest, não reproduzidas). Suítes SQL em Postgres
16 limpo, container recriado e `/work` apagado antes do `docker cp` → **22/22 OK**. `npx tsc -b`
limpo · `npm run build` limpo · `npm run lint` limpo · `npm run check:ui` P0/P1 = 0 ·
`npm run check:contraste` 47 pares nos dois temas.

**A migration ainda NÃO foi aplicada.** A Ester autorizou em 27/08, mas esta sessão **não tem o MCP
do Supabase** (só o `designmd` está no `.mcp.json`), e aplicar por fora do MCP sujaria o ledger —
exatamente o que o INFRA-02 reconciliou em 04/08. Fica para uma sessão com o MCP: `apply_migration`,
e depois **renomear o arquivo local para a versão que o ledger gravar**.

Nada trava por causa disso: o `mapToPostgres` só envia as três chaves **quando há valor**
(`applicabilityColumns`), e inspeção sem regra não tem nenhuma — então o app novo sincroniza contra
o banco de hoje sem erro. O que a migration habilita é a convergência entre aparelhos, necessária
**antes de publicar a primeira revisão** (COND-10).

**Ficou deliberadamente de fora:**

- **Score, progresso, resumo, PDF e plano de ação sobre o conjunto de aplicáveis** — é o `COND-09`, e
  o card manda não misturar. Hoje `calculateScore` ainda roda sobre a árvore completa: item fora por
  regra **com resposta** entraria na nota. Sem revisão publicada em produção isso é inerte, mas é a
  primeira coisa que o COND-09 tem de fechar, e está na lista de modos de falha da seção 9.
- **O `reportTemplateSnapshot` no Supabase.** Continua fora (decisão do COND-04).
- **A árvore de seções e itens entre aparelhos.** Quem abre a inspeção num aparelho que nunca a teve
  compõe do roteiro-mestre (comportamento do COND-03). Este card garantiu a convergência das
  **regras** (por revisão imutável) e das **respostas de roteamento**.
- **Publicar revisão de teste em produção para ver o efeito de ponta a ponta** — é o `COND-10`
  (piloto em Estética), e é escrita em produção.

**Riscos conhecidos, registrados:**

1. **A migration pendente.** Descrita acima; está no cabeçalho do arquivo e em
   `docs/migrations-status.md`. Publicar revisão de condições antes de aplicá-la faria a resposta de
   roteamento não sair do aparelho.
2. **A validação estrutural em SQL não conhece `routing_answers`.** As colunas são JSONB livre. Quem
   valida forma de resposta é o app (`parseRoutingAnswer`); o bundle só recusa o que não é objeto.
3. **Empate de relógio entre aparelhos dessincronizados.** O desempate é determinístico, mas é pelo
   valor, não por quem tem razão. Na prática o carimbo tem precisão de milissegundo.

**Desbloqueia:** `COND-09`.

## Relacionados

- [contrato-aplicabilidade.md](contrato-aplicabilidade.md) — o contrato normativo (COND-01).
- [mapa-roteiro-inspecao.md](mapa-roteiro-inspecao.md) — o caminho do roteiro e os 10 achados.
- [gherkin/aplicabilidade.feature](gherkin/aplicabilidade.feature) — os cenários.
- [HANDOFF-FRONTEND.md](HANDOFF-FRONTEND.md) — FE-23 (fluxo de inspeção) precede o COND-08.
- [mapa-paginas-admin.md](mapa-paginas-admin.md) — atualizar as linhas de `/new`, `/execute`,
  `/summary` e do editor de roteiro conforme os cards forem fechando.
- [AUDITORIA-2026-08.md](AUDITORIA-2026-08.md) — dívida de dados e RLS que este projeto vai
  encostar.
