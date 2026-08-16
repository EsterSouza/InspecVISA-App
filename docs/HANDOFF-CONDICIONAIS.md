# HANDOFF — Motor de condicionais, aplicabilidade e roteiros adaptativos

> Aberto em 16/08/2026. Cards com prefixo `COND-`.
> **Origem:** plano de 13 cards escrito pelo ChatGPT, revisado contra o código em 16/08/2026. A
> estrutura e a ordem dele foram mantidas; o que mudou está registrado em
> [O que mudou do plano original](#o-que-mudou-do-plano-original), com a evidência de cada correção.
> **Natureza:** domínio + banco + motor + editor + execução + relatório. Não é feature de formulário.

---

## Onde estamos

**Nenhum card iniciado.** O projeto não começa antes da Ester aprovar o escopo e a ordem.

| Card | O que é | Modelo | Esforço | Depois de |
|---|---|---|---|---|
| **COND-01** | Auditoria + contrato de domínio e invariantes | Opus 5 | alto | — |
| **COND-02** | Schema declarativo + motor puro + validador | Opus 5 | alto | COND-01 |
| **COND-03** | `EffectiveTemplate` canônico + **congelamento na criação da inspeção** | Opus 5 | alto | COND-02 |
| **COND-04** | Persistência, revisão, RLS e compatibilidade | Opus 5 | alto | COND-03 |
| **COND-05** | Perguntas de roteamento e contexto congelado | Opus 5 | médio-alto | COND-04 |
| **COND-06** | Editor visual **com o ciclo de vida junto** | Opus 5 | alto | COND-05 |
| **COND-07** | Simulador e gate de publicação | Sonnet 5 | médio-alto | COND-06 |
| **COND-08** | Execução adaptativa offline e colaborativa | Opus 5 | **muito alto** | COND-03 · COND-05 · COND-07 |
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
| 6 | `ChecklistItem.isRJOnly` | `types/index.ts:132` | **regra morta**: 15 ocorrências nos dados (`Roteiro_ILPI_RJ.ts`, `templates_alimentos_segmentos.ts`) e **zero leitores** no `src/` |

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
6. **`isRJOnly` é decisão pendente no COND-01:** ou vira regra de verdade (e alguém precisa
   conferir se aqueles 15 itens deveriam ter sumido para não-RJ esse tempo todo), ou é removida do
   tipo e dos dados. Hoje ela mente: parece que existe filtro e não existe.

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

## Relacionados

- [HANDOFF-FRONTEND.md](HANDOFF-FRONTEND.md) — FE-23 (fluxo de inspeção) precede o COND-08.
- [mapa-paginas-admin.md](mapa-paginas-admin.md) — atualizar as linhas de `/new`, `/execute`,
  `/summary` e do editor de roteiro conforme os cards forem fechando.
- [AUDITORIA-2026-08.md](AUDITORIA-2026-08.md) — dívida de dados e RLS que este projeto vai
  encostar.
