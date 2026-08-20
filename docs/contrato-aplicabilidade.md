# Contrato de aplicabilidade — o que o motor de condicionais promete

> Entregue pelo **COND-01** em 16/08/2026. Base factual:
> [mapa-roteiro-inspecao.md](mapa-roteiro-inspecao.md). Plano:
> [HANDOFF-CONDICIONAIS.md](HANDOFF-CONDICIONAIS.md).
> **Este documento é normativo.** Onde o código divergir dele, o código está errado — ou o
> documento muda primeiro, por decisão registrada.
> Cenários executáveis: [gherkin/aplicabilidade.feature](gherkin/aplicabilidade.feature).

## 1. Vocabulário

| Termo | Definição |
|---|---|
| **Aplicabilidade** | se um item/seção **pertence** ao roteiro daquela inspeção. Decidida pelo motor, antes de qualquer resposta |
| **Resultado** | o juízo sanitário sobre um item aplicável: `complies`, `not_complies`, `not_applicable`, `not_observed` — o que já existe em `InspectionResponse.result` |
| **Requisito sanitário** | o item de hoje: pesa, é ou não crítico, cita norma, gera plano de ação |
| **Pergunta de roteamento** | item novo, existe só para decidir aplicabilidade. Nunca pesa, nunca é NC, nunca gera pendência |
| **Contexto congelado** | os dados da inspeção usados como fonte de condição, fixados na criação |
| **Revisão congelada** | roteiro + regras + opções vigentes no momento da criação da inspeção |

## 2. Os três estados de aplicabilidade

Todo item de um roteiro, numa inspeção, está em **exatamente um**:

| Estado | Significado | Entra no denominador da nota? | Aparece na tela? | Aparece no PDF? |
|---|---|---|---|---|
| `aplicavel` | pertence à realidade avaliada | **sim** | sim | sim |
| `nao_aplicavel_por_regra` | uma condição configurada o excluiu | **não** | não (contado no resumo da seção) | não, exceto na contagem do rodapé |
| `pendente_de_condicao` | falta responder algo para decidir | **não** | **sim, marcado** | sim, na lista de pendências |

**Regra de ouro:** aplicabilidade se resolve **antes** de interpretar resultado. Um item
`nao_aplicavel_por_regra` não tem resultado — não é "N/A", não é "conforme", não é "não
respondido".

### 2.1 Fronteira com o `not_applicable` que já existe

`not_applicable` é **resultado**, dado pela consultora: *"eu olhei, e aqui isso não se aplica"*.
Hoje ele entra no cálculo como nota neutra e é contado à parte (`scoring.ts:13` e `:110`).

`nao_aplicavel_por_regra` é **aplicabilidade**, decidida pelo motor: *"o sistema sabe que isso não
pertence a este estabelecimento"*.

**Proibido gravar aplicabilidade como resultado.** Um item excluído por regra **não** pode virar
uma `InspectionResponse` com `result = 'not_applicable'` — seria fabricar resposta que ninguém deu,
e ela apareceria no relatório como avaliação da consultora.

### 2.2 Item sem resposta **não** é item aplicável resolvido

Achado A1 do mapa: `binaryScore` devolve 3 (conforme) para item sem resposta. Isso hoje **não**
contamina o percentual nem a classificação (que só contam item respondido) — chega apenas aos
índices MARP `ic`/`inc`/`cr`/`rp`, que são calculados e não exibidos. Ainda assim, o contrato é:

- O conjunto avaliado passado ao `calculateScore` é **só o `aplicavel`**.
- `pendente_de_condicao` **nunca** entra nesse conjunto — nem no percentual, nem no MARP.
- **Quando os índices MARP forem exibidos**, o item sem resposta sai do cálculo em vez de valer 3.
  Enquanto ninguém os exibe, isso é dívida registrada, não bug no ar.
- Fechar inspeção com pendência é tratado no item 6.4.

## 3. Os dois tipos de item

| | Requisito sanitário | Pergunta de roteamento |
|---|---|---|
| resultado sanitário | sim | **não** |
| peso / criticidade | sim | **não** |
| cita legislação | sim | não |
| gera plano de ação | sim | **nunca** |
| entra na nota | sim | **nunca** |
| aparece como exigência infringida | sim | **nunca** |
| controla aplicabilidade | não | é a razão de existir |
| tipos de valor | resultado sanitário | booleano · escolha única · múltipla escolha · número |

Texto livre **não** é fonte de condição nesta versão.

Uma pergunta de roteamento aparece no relatório **apenas** como contexto declarado
("Processamento de artigos: terceirizado"), nunca na contagem de conformidade.

**Detalhado no COND-05 (20/08/2026):** cada pergunta declara **onde é respondida** — no wizard de
criação, quando o dado é conhecido antes, ou na execução, quando só em campo se sabe (ausente vale
execução, que é o lado conservador) — e pode ser **obrigatória**, caso em que segura o começo da
inspeção e a liberação do bloco, sem nunca esconder requisito. A opção tem `value` (id estável, que
é o que resposta e regra guardam) e `label` (o que aparece na tela): renomear o rótulo não muda
resposta nem quebra condição. Id de pergunta **não pode** ser id de item ou seção — é o que impede
resposta de roteamento e resposta sanitária de se confundirem.

## 4. Fontes de condição

1. **Contexto congelado** — UF, município, categoria, tipos de alimento, capacidade da ILPI,
   modalidade e o que mais o wizard coletar. **Já é congelado hoje** (achado A3): a inspeção guarda
   cópia e execução/relatório leem dela, não do cadastro vivo. O motor mantém isso.
2. **Respostas de perguntas de roteamento** — dadas no wizard ou em campo.

**Nenhuma outra fonte.** Nada de consultar cliente vivo, data de hoje, contagem de inspeções
anteriores ou qualquer coisa que mude sem a consultora saber.

### 4.1 Não perguntar o que o sistema já sabe

Decisão de produto: **pergunta de roteamento só existe para o que não dá para derivar do contexto
congelado.** UF, município, categoria e tipo de alimento **nunca** viram pergunta — já estão no
cadastro e no contexto. Se a consultora tiver que redigitar meia dúzia de coisas conhecidas a cada
inspeção, a feature morre por atrito.

Quando o dado existe no cadastro mas está vazio, o comportamento é o do item 5.2 (indeterminado),
nunca "assume não". **Desde o COND-05 isto é checado por máquina**: pergunta cujo enunciado repete
um dado do contexto vira aviso (`question_duplicates_context`) apontando o campo equivalente. É
aviso, não erro — informa no editor e não reprova publicação, porque a lista de equivalências é
curada e pode não cobrir um caso legítimo.

## 5. Semântica

### 5.1 Operadores

`igual` · `diferente` · `contém` · `não contém` · `maior` · `maior ou igual` · `menor` ·
`menor ou igual` · `existe` · `não existe` · `pertence a lista` · `não pertence a lista`.

Grupos: **TODAS** (`AND`) e **QUALQUER** (`OR`). Um grupo vazio é erro de validação, não
"verdadeiro".

### 5.2 `null` / desconhecido — a tabela que decide tudo

Ausência de valor é **indeterminado**, e indeterminado **não é falso**:

| Situação | Resultado da condição | Estado do alvo |
|---|---|---|
| fonte respondida, condição satisfeita | verdadeiro | `aplicavel` |
| fonte respondida, condição não satisfeita | falso | `nao_aplicavel_por_regra` |
| fonte **ainda não respondida** | **indeterminado** | `pendente_de_condicao` |
| operador `existe` / `não existe` sobre fonte vazia | verdadeiro/falso (nunca indeterminado) | resolvido |

Propagação em grupo:

- `TODAS`: um falso → falso (mesmo com indeterminados). Nenhum falso e algum indeterminado →
  indeterminado.
- `QUALQUER`: um verdadeiro → verdadeiro. Nenhum verdadeiro e algum indeterminado →
  indeterminado.

Ou seja: **curto-circuito resolve; a dúvida só sobrevive quando faz diferença.**

### 5.3 `else`

`else` é caminho alternativo, exibido como tal na tela. Internamente vira condição complementar.
Se a fonte do `if` estiver indeterminada, **todos** os ramos ficam `pendente_de_condicao` — nunca
"cai no else por padrão".

### 5.4 Herança

Item herda a aplicabilidade da seção. Seção `nao_aplicavel_por_regra` torna todos os seus itens
`nao_aplicavel_por_regra`, independentemente da regra própria do item. Seção
`pendente_de_condicao` torna os itens pendentes.

Item com regra própria dentro de seção aplicável resolve pela sua própria regra.

## 6. Comportamento

### 6.1 Mudar resposta controladora nunca apaga dado

Resposta de item que perdeu aplicabilidade **fica gravada**, sai do resultado enquanto o item
estiver fora da árvore, e **volta a valer** se a condição voltar. Foto, link e evidência idem.

No banco isso já é o comportamento natural — `responses.item_id` não tem FK para
`checklist_items` — mas aqui deixa de ser acidente e passa a ser garantia testada.

Antes de aplicar uma mudança que retira item já respondido, a tela confirma, com número:

> Esta alteração fará com que **6 requisitos** deixem de ser aplicáveis. As respostas existentes
> serão preservadas no histórico, mas não participarão do resultado enquanto esta condição
> permanecer.

### 6.2 Inspeção em andamento não segue o roteiro vivo

Editar o roteiro-mestre não altera árvore de inspeção já criada. A inspeção carrega revisão
congelada (roteiro, regras, opções) e contexto congelado.

### 6.3 Relatório concluído é imutável

Editar condicional depois não altera relatório entregue, PDF, nota histórica nem o plano de ação
daquela publicação. O relatório usa **o snapshot**, e nunca reconstrói do vivo — o caminho de
reconstrução do achado A2 deixa de existir como fallback silencioso: se o snapshot faltar ou estiver
incompleto, é **erro visível**, não improviso.

### 6.4 Pendência no fechamento

Inspeção **não fecha** com item `pendente_de_condicao` — a árvore real não é conhecida.

Exceção obrigatória, porque campo é campo: a consultora pode marcar a pergunta de roteamento como
**"não foi possível determinar"**, com justificativa. Nesse caso:

- os itens que dependiam dela ficam `pendente_de_condicao` **declarado**;
- entram no relatório numa lista própria — *"não avaliados por informação indisponível"*, com a
  justificativa;
- **não** entram no denominador da nota;
- **não** geram pendência no plano de ação;
- o relatório diz, em texto, que o escopo daquela visita ficou incompleto.

Item pendente nunca desaparece em silêncio. Sumir sem registro é o pior desfecho possível.

### 6.5 Offline e colaboração

O motor é local e puro: mostrar/esconder item **nunca** depende de rede. As duas consultoras
convergem porque avaliam a mesma revisão congelada com as mesmas respostas de roteamento —
a resposta controladora é uma resposta como outra qualquer e usa a mesma resolução de conflito
(última escrita vence, com autoria registrada).

Enquanto a resposta controladora de uma não chegou na outra, cada dispositivo mostra a árvore
coerente com o que tem. **Divergência temporária é aceitável; divergência permanente não.** Após a
sincronização, as duas árvores têm de ser idênticas — é teste do `COND-08`.

### 6.6 Uma árvore só; papel é exibição

**Decisão da Ester, 16/08/2026.** Existe **uma** árvore por inspeção: a completa, calculada pelo
motor sobre a revisão congelada. O recorte por papel (saúde / nutrição) **não monta uma segunda
árvore** — ele esconde seções na exibição, e a consultora sempre pode pedir "ver tudo".

Consequências normativas:

- Nota, progresso, resumo, snapshot, PDF e plano de ação usam **sempre** a árvore completa. Nunca
  existiu razão para a nota ser calculada sobre um recorte de quem está logada.
- Ao concluir, a consultora **vê o que vai sair no relatório**, inclusive a parte da colega —
  hoje ela assina um relatório com seções que nunca apareceram na tela dela.
- O `snapshotCoversResponses()` do achado A2 perde a razão de existir: se o snapshot é sempre a
  árvore completa, ele cobre todas as respostas por construção. O fallback que reconstrói do
  roteiro vivo **é removido** no `COND-03`, não mantido.
- O filtro de exibição é preferência de tela, **não** entra no congelamento. Trocar o papel nas
  Configurações nunca pode mudar nota, relatório ou o que já foi congelado.

### 6.7 Erro do motor nunca esconde requisito

Se a avaliação falhar (regra corrompida, referência quebrada em inspeção já criada), o
comportamento é **conservador e visível**: o item aparece, marcado como indeterminado, com aviso na
tela. Hoje o `catch` já devolve o roteiro sem filtro (achado A6) — a direção está certa, falta a
visibilidade.

**Nunca** transformar erro técnico em conclusão sanitária.

## 7. Consequências nos resultados

| Superfície | Conjunto que ela usa |
|---|---|
| Execução | `aplicavel` + `pendente_de_condicao` (marcado) |
| Nota (`calculateScore`) | **só `aplicavel` com resultado** |
| Progresso | "respondidos de aplicáveis", nunca "de cadastrados" |
| Resumo | cadastrados · aplicáveis · excluídos por regra · pendentes · respondidos |
| PDF | mesma árvore do snapshot; excluídos por regra só na contagem |
| Referências de legislação | normas dos itens **aplicáveis** — seção excluída não cita norma |
| Plano de ação | só `not_complies` de item `aplicavel` |
| Portal do cliente | nada muda de vocabulário: o cliente nunca lê "não aplicável por regra" |

**Invariante que reprova card:**

```
itens da execução = itens do score = itens do summary = itens do PDF = itens elegíveis ao plano
```

## 8. Os 15 casos obrigatórios — resolvidos

| # | Caso | Comportamento contratado |
|---|---|---|
| 1 | Condição simples | fonte satisfeita → `aplicavel`; não satisfeita → `nao_aplicavel_por_regra` |
| 2 | Duas condições `TODAS` | um falso derruba; indeterminado sem falso → pendente |
| 3 | Duas condições `QUALQUER` | um verdadeiro basta; sem verdadeiro e com indeterminado → pendente |
| 4 | `else` | ramo complementar; fonte indeterminada deixa **todos** os ramos pendentes |
| 5 | Condição não respondida | `pendente_de_condicao`, nunca falso |
| 6 | Mudança de resposta | recalcula na hora; confirma antes se retirar item respondido |
| 7 | Descendente já preenchido | resposta preservada, fora do resultado, volta se a condição voltar |
| 8 | Item **crítico** perde aplicabilidade | sai do conjunto crítico; a média geométrica passa a ter n−1. Não vira 3 neutro dentro do cálculo |
| 9 | NC perde aplicabilidade | não gera pendência nova; pendência já publicada em fechamento anterior **não** é apagada |
| 10 | Offline | idêntico ao online; zero chamada de rede para decidir árvore |
| 11 | Duas consultoras | convergem após sync; divergência só enquanto a resposta não chegou |
| 12 | Roteiro alterado depois da inspeção iniciada | inspeção não muda (revisão congelada) |
| 13 | Relatório concluído | imutável; snapshot ausente/incompleto é erro visível, não reconstrução |
| 14 | Pergunta controladora aposentada | bloqueada enquanto houver dependente; inspeções em andamento seguem com a revisão congelada |
| 15 | Ciclo entre regras | erro impeditivo, direto e indireto; roteiro com ciclo não publica |

## 9. Decisões de limpeza que este contrato exige

1. **`isRJOnly` (achado do mapa):** funciona, mas só dentro de `getExtraSections` — filtra 2 itens
   de alimentos (canudo biodegradável e ovo cru), e é **redundante** nos 9 itens do suplemento ILPI
   RJ, que já só entra para clientes do RJ. **Decisão: não remover.** É a única regra de
   aplicabilidade **por item** que existe hoje, e por isso é o melhor caso de migração do
   `COND-03`: vira regra declarativa `contexto.uf pertence a ['RJ']` com alvo no item. Os 9
   redundantes do ILPI perdem a flag, sem mudar comportamento.
2. **Casamento por texto (achado A5):** título de seção decidindo suplemento e recorte por papel
   vira regra por id no `COND-03`. Enquanto não migrar, renomear seção continua alterando roteiro
   em silêncio — **fica registrado como risco conhecido**.
3. **Divergência aposentado execução × resumo (achado A9):** ✅ **fechado no COND-03** — `resolveReportTemplate`
   e a execução aplicam o mesmo corte por `createdAt` (`composeCanonicalTemplate`).
4. **Duas árvores na execução (achado A4):** ✅ **fechado no COND-03** — a canônica é a completa
   (`composeCanonicalTemplate`), e o recorte por papel virou **filtro de exibição**
   (`filterSectionsByRoleForDisplay`), nunca outra árvore.

## 10. Decisões da Ester

**Decidido em 16/08/2026:**

1. **"Não foi possível determinar" pode fechar a inspeção.** ✅ Sim — com justificativa, lista
   própria no relatório ("não avaliados por informação indisponível"), fora do denominador da nota
   e fora do plano de ação. É o item 6.4 deste contrato, agora normativo.
2. **Pergunta de roteamento aparece no relatório.** ✅ Sim — como **contexto declarado**
   ("Processamento de artigos: terceirizado"), nunca na contagem de conformidade, nunca como NC.
   É o item 3 deste contrato, agora normativo.
3. **`isRJOnly`** — a pergunta perdeu o objeto: a flag funciona (ver 9.1). Nenhum item deixou de
   ser avaliado por engano. Fica como caso de migração do `COND-03`.

4. **Uma árvore só; o papel é filtro de exibição.** ✅ Decidido em 16/08/2026. Hoje a execução monta
   **duas** árvores simultâneas — a filtrada pelo papel de quem está logada e a completa, que é a
   que vira snapshot e a que a nota usa. Passa a existir **uma**: a completa. O papel deixa de
   montar lista e passa a **esconder na exibição**, com "ver tudo" disponível. Detalhe normativo em
   6.6.

**Nada em aberto.** Todos os cards estão liberados do ponto de vista de decisão de produto.
