# language: pt
# COND-01 — comportamento contratado do motor de aplicabilidade.
# Normativo: docs/contrato-aplicabilidade.md · Fatos: docs/mapa-roteiro-inspecao.md
# Nada aqui está implementado ainda: é o alvo dos cards COND-02 em diante.
Funcionalidade: Aplicabilidade condicional do roteiro
  Como consultora sanitária
  Quero que o roteiro pergunte só o que se aplica àquele estabelecimento
  Para não avaliar exigência que não existe ali, sem nunca perder o que já respondi

  Contexto:
    Dado um roteiro com a pergunta de roteamento "Realiza processamento de artigos?"
    E uma seção "Processamento próprio" exibida quando a resposta for "Sim"

  # ── Os três estados ────────────────────────────────────────────────────────
  Cenário: Condição satisfeita torna a seção aplicável
    Dado que respondi "Sim" para "Realiza processamento de artigos?"
    Então a seção "Processamento próprio" fica aplicável
    E seus itens entram no denominador da nota

  Cenário: Condição não satisfeita exclui a seção por regra
    Dado que respondi "Não" para "Realiza processamento de artigos?"
    Então a seção "Processamento próprio" fica não aplicável por regra
    E seus itens não entram no denominador da nota
    E nenhum item dela recebe resultado "não se aplica" automaticamente
    E o resumo da inspeção informa quantos itens saíram por regra

  Cenário: Condição sem resposta deixa a seção pendente, nunca falsa
    Dado que ainda não respondi "Realiza processamento de artigos?"
    Então a seção "Processamento próprio" fica pendente de condição
    E seus itens aparecem na tela marcados como pendentes
    E seus itens não entram no denominador da nota

  # ── Aplicabilidade não é resultado ─────────────────────────────────────────
  Cenário: Item excluído por regra não vira "não se aplica"
    Dado um item excluído por regra
    Então não existe resposta gravada para ele
    E o relatório não o apresenta como avaliado pela consultora

  Cenário: Item pendente não pontua como conforme
    Dado um item pendente de condição e sem resposta
    Quando a nota é calculada
    Então ele fica fora do conjunto avaliado
    E não soma pontuação máxima por ausência de resposta

  # ── Preservação de dado ────────────────────────────────────────────────────
  Cenário: Trocar a resposta controladora preserva as respostas do ramo
    Dado que respondi "Sim" e avaliei 6 itens da seção "Processamento próprio"
    Quando altero a resposta para "Não"
    Então vejo uma confirmação dizendo que 6 requisitos deixarão de ser aplicáveis
    E ao confirmar as 6 respostas continuam gravadas
    E as 6 respostas não participam do resultado
    E as fotos e evidências dessas respostas continuam guardadas

  Cenário: Voltar a condição traz as respostas de volta
    Dado que os 6 itens saíram da árvore ao responder "Não"
    Quando volto a resposta para "Sim"
    Então os 6 itens voltam a ser aplicáveis
    E reaparecem com as respostas que eu já tinha dado
    E voltam a participar do resultado

  # ── Lógica ─────────────────────────────────────────────────────────────────
  Cenário: Grupo TODAS com uma condição falsa
    Dado uma regra com duas condições combinadas por "TODAS"
    E a primeira condição é falsa
    E a segunda ainda não foi respondida
    Então o alvo fica não aplicável por regra
    Porque uma condição falsa derruba o grupo mesmo com dúvida ao lado

  Cenário: Grupo QUALQUER com uma condição verdadeira
    Dado uma regra com duas condições combinadas por "QUALQUER"
    E a primeira condição é verdadeira
    E a segunda ainda não foi respondida
    Então o alvo fica aplicável

  Cenário: Caminho alternativo não é assumido enquanto a fonte é desconhecida
    Dado uma regra "se próprio mostra A, caso contrário mostra B"
    E a pergunta "próprio ou terceirizado?" ainda não foi respondida
    Então nem A nem B ficam aplicáveis
    E as duas seções ficam pendentes de condição

  Cenário: Seção não aplicável arrasta seus itens
    Dado uma seção não aplicável por regra
    E um item dela com regra própria satisfeita
    Então o item continua não aplicável
    Porque a aplicabilidade da seção é herdada

  # ── Item crítico e nota ────────────────────────────────────────────────────
  Cenário: Item crítico que perde aplicabilidade sai do índice crítico
    Dado um roteiro com 4 itens críticos aplicáveis
    Quando 1 deles deixa de ser aplicável por regra
    Então o índice crítico passa a ser calculado sobre 3 itens
    E o item retirado não entra no cálculo como valor neutro

  # ── Plano de ação ──────────────────────────────────────────────────────────
  Cenário: Não conformidade em ramo desativado não gera pendência nova
    Dado um item não conforme cujo ramo deixou de ser aplicável
    Quando publico o relatório
    Então nenhuma pendência nova é criada para esse item
    E pendências publicadas em fechamentos anteriores continuam existindo

  # ── Congelamento ───────────────────────────────────────────────────────────
  Cenário: Editar o roteiro não mexe em inspeção já iniciada
    Dado uma inspeção iniciada com a revisão vigente do roteiro
    Quando alguém edita as condições do roteiro-mestre
    Então a árvore daquela inspeção continua idêntica
    E ela segue usando a revisão congelada na criação

  Cenário: Editar o roteiro não mexe em relatório concluído
    Dado um relatório já concluído e publicado
    Quando alguém edita as condições do roteiro-mestre
    Então o relatório, o PDF e a nota histórica permanecem idênticos

  Cenário: Snapshot ausente ou incompleto é erro visível
    Dado um relatório concluído cujo snapshot não cobre todas as respostas
    Quando abro o relatório
    Então vejo um aviso de que o roteiro congelado está incompleto
    Mas o sistema não reconstrói a árvore a partir do roteiro vivo

  Cenário: Mudar o cadastro do cliente não muda inspeção antiga
    Dado uma inspeção criada quando o cliente estava em "Rio de Janeiro"
    Quando o cadastro do cliente passa a "Niterói"
    Então a árvore da inspeção antiga continua a mesma
    Porque o contexto foi congelado na criação

  # ── Campo ──────────────────────────────────────────────────────────────────
  Cenário: Offline decide a árvore sem rede
    Dado que estou em campo sem internet
    Quando respondo uma pergunta de roteamento
    Então a árvore é recalculada localmente
    E nenhuma chamada de rede é necessária para mostrar ou esconder item

  Cenário: O recorte por papel esconde na tela, não muda o relatório
    Dado uma inspeção de ILPI respondida por mim (saúde) e pela nutricionista
    E que meu perfil está como "saúde"
    Então as seções de nutrição ficam escondidas na minha tela
    Mas continuam na árvore da inspeção
    E consigo pedir "ver tudo" antes de concluir
    E a nota, o roteiro congelado e o relatório usam a árvore completa

  Cenário: Trocar o perfil não muda nota nem relatório
    Dado uma inspeção concluída
    Quando troco meu perfil de "saúde" para "ambos"
    Então a nota permanece a mesma
    E o relatório congelado permanece o mesmo
    Porque o perfil é preferência de exibição, não faz parte do congelamento

  Cenário: Duas consultoras convergem para a mesma árvore
    Dado que eu e outra consultora estamos na mesma inspeção
    Quando a resposta controladora dela sincroniza para o meu dispositivo
    Então as duas árvores ficam idênticas
    E a autoria da resposta controladora fica registrada

  Cenário: Informação indisponível em campo não some do relatório
    Dado que não consegui determinar "Realiza processamento de artigos?"
    Quando marco "não foi possível determinar" com justificativa
    Então consigo concluir a inspeção
    E os itens dependentes aparecem no relatório como não avaliados por informação indisponível
    E eles não entram no denominador da nota
    E eles não geram pendência no plano de ação

  Cenário: Erro do motor nunca esconde requisito
    Dado uma regra corrompida numa inspeção já criada
    Quando abro a execução
    Então os itens afetados aparecem marcados como indeterminados
    E vejo um aviso na tela
    Mas nenhum requisito é escondido em silêncio

  # ── Autoria e ciclo de vida ────────────────────────────────────────────────
  Cenário: Roteiro com dependência circular não publica
    Dado que a seção A depende da seção B e a seção B depende da seção A
    Quando tento publicar o roteiro
    Então a publicação é bloqueada
    E vejo qual é o ciclo

  Cenário: Aposentar pergunta controladora com dependentes é bloqueado
    Dado uma pergunta de roteamento com 10 regras dependentes
    Quando tento aposentá-la
    Então a operação é bloqueada
    E vejo a lista de quem depende dela

  Cenário: Alterar a redação da pergunta não quebra a regra
    Dado uma regra que depende de "Realiza processamento de artigos?"
    Quando altero a redação para "O estabelecimento processa artigos reutilizáveis?"
    Então a regra continua funcionando
    Porque ela referencia o identificador da pergunta, nunca o texto

  Cenário: Duplicar roteiro não aponta para o original
    Dado um roteiro com condicionais
    Quando o duplico
    Então as regras da cópia referenciam os itens da cópia
    E nenhuma regra aponta para item do roteiro original

  # ── Compatibilidade ────────────────────────────────────────────────────────
  Cenário: Roteiro sem condicional funciona como sempre funcionou
    Dado um roteiro sem nenhuma regra configurada
    Quando crio e executo uma inspeção com ele
    Então todos os itens são aplicáveis
    E a nota, o relatório e o plano de ação saem como antes do motor existir

  Cenário: Pergunta de roteamento não é exigência sanitária
    Dado uma inspeção com perguntas de roteamento respondidas
    Quando gero o relatório
    Então nenhuma pergunta de roteamento aparece como não conformidade
    E nenhuma delas entra na nota
    E nenhuma delas gera item no plano de ação

  # ── Onde a pergunta é feita e o que ela guarda (COND-05) ───────────────────
  Cenário: Pergunta conhecida antes da visita é feita na criação da inspeção
    Dado uma pergunta de roteamento marcada para o wizard
    Quando crio uma inspeção com esse roteiro
    Então ela aparece num bloco próprio, antes de começar
    E o bloco diz que aquilo não é exigência sanitária

  Cenário: Pergunta que só se sabe em campo não aparece no wizard
    Dado uma pergunta de roteamento marcada para a execução
    Quando crio uma inspeção com esse roteiro
    Então ela não é perguntada na criação
    E ela continua pendente até ser respondida em campo

  Cenário: Pergunta obrigatória segura o início, sem esconder nada
    Dado uma pergunta de roteamento obrigatória sem resposta
    Quando tento iniciar a inspeção
    Então o botão de iniciar fica indisponível, com o motivo em texto
    E nenhum requisito é escondido por causa disso

  Cenário: Renomear o rótulo de uma opção não muda resposta nem regra
    Dado uma resposta guardada na opção "terceirizado"
    Quando mudo o rótulo dessa opção para "Terceirizado (contrato)"
    Então a resposta continua a mesma
    E a condição que depende dela continua valendo

  Cenário: Não perguntar o que já está no cadastro
    Dado uma pergunta de roteamento que repete um dado do contexto congelado
    Quando o roteiro é validado
    Então aparece um aviso indicando o dado de contexto equivalente
    E o aviso não reprova a publicação

  Cenário: O contexto da inspeção é congelado na criação
    Dado uma inspeção criada para um cliente do Rio de Janeiro
    Quando o cadastro do cliente passa a dizer São Paulo
    Então a inspeção continua avaliando pelo Rio de Janeiro
    E o relatório dela não muda

  # ── Rascunho e revisão publicada (COND-04) ─────────────────────────────────
  Cenário: Regra pela metade pode ser salva
    Dado que comecei a montar uma condição e ainda não escolhi o operador
    Quando salvo o trabalho
    Então a regra fica guardada como rascunho
    E nenhuma inspeção nova enxerga essa regra

  Cenário: Só revisão publicada entra em inspeção
    Dado um roteiro com rascunho de condições e uma revisão publicada anterior
    Quando crio uma inspeção com esse roteiro
    Então a inspeção congela a revisão publicada
    E o rascunho não participa de nada

  Cenário: Publicar uma revisão nova não altera inspeção já criada
    Dado uma inspeção criada com a revisão publicada 1
    Quando publico a revisão 2 do mesmo roteiro
    Então a inspeção continua avaliando pela revisão 1
    E a revisão 1 continua existindo, sem ter sido alterada

  Cenário: Salvar o roteiro no editor não apaga as regras
    Dado um roteiro com regras publicadas
    Quando edito o roteiro e salvo (o editor reinsere seções e itens com os mesmos ids)
    Então as regras continuam de pé, apontando para os mesmos itens

  Cenário: Consultoria não enxerga revisão de outra consultoria
    Dado duas consultorias com revisões do mesmo roteiro
    Quando uma delas lista as revisões
    Então só aparecem as do próprio tenant
    E gravar no tenant da outra é recusado

  # ── A execução adaptativa (COND-08) ────────────────────────────────────────
  Cenário: A pergunta de campo aparece na execução, com vocabulário próprio
    Dado uma pergunta de roteamento marcada para a execução
    Quando abro a inspeção no roteiro
    Então ela aparece num bloco que diz "Perguntas que definem o roteiro"
    E o bloco diz que aquilo não entra na nota nem no plano de ação
    E ela não tem conforme, não conforme, peso, foto nem prazo

  Cenário: Responder a pergunta esconde a seção que deixou de se aplicar
    Dado uma seção condicionada a "Realiza processamento de artigos?"
    Quando respondo "Não"
    Então a seção sai do roteiro na tela
    E ela aparece em "Fora do roteiro por condição", com o motivo escrito
    E nenhuma resposta é apagada

  Cenário: Retirar item já respondido pede confirmação com número
    Dado 6 exigências respondidas numa seção condicional
    Quando mudo a resposta controladora para o valor que retira a seção
    Então a tela avisa que 6 requisitos deixam de ser aplicáveis
    E diz que as respostas são preservadas no histórico
    E nada muda enquanto eu não confirmar

  Cenário: O caminho de volta devolve o item e a resposta
    Dado uma seção retirada por condição, com respostas preservadas
    Quando respondo a pergunta controladora do outro jeito
    Então a seção volta ao roteiro
    E as respostas que já existiam voltam a valer

  Cenário: Pergunta sem resposta deixa pendente e visível, nunca oculto
    Dado uma seção condicionada a uma pergunta ainda sem resposta
    Quando abro o roteiro
    Então a seção aparece marcada como "Pendente de condição"
    E o índice de seções também a marca
    E a explicação diz qual pergunta falta resolver

  Cenário: Pendência de condição impede encerrar a inspeção
    Dado uma exigência pendente de condição esperando resposta
    Quando abro a etapa de encerramento
    Então o botão de encerrar fica indisponível, com o motivo em texto
    E a lista mostra o que precisa ser resolvido

  Cenário: "Não foi possível determinar" libera o encerramento
    Dado uma pergunta de campo que não pôde ser apurada
    Quando a marco como "não foi possível determinar", com justificativa
    Então o que dependia dela continua pendente e visível
    E o encerramento deixa de estar bloqueado

  Cenário: Mostrar e esconder item nunca depende de rede
    Dado uma inspeção aberta sem conexão
    Quando respondo uma pergunta de roteamento
    Então a árvore é recalculada na hora, sem nenhuma chamada ao servidor
    E o resultado é idêntico ao que apareceria com conexão

  Cenário: Duas consultoras convergem para a mesma árvore
    Dado que eu respondo a pergunta 1 e a minha colega responde a pergunta 2, as duas offline
    Quando os dois aparelhos sincronizam
    Então as duas respostas existem nos dois aparelhos
    E as duas telas mostram exatamente as mesmas seções e exigências

  Cenário: Mesma pergunta respondida nos dois aparelhos
    Dado que as duas responderam a MESMA pergunta, com valores diferentes
    Quando os dois aparelhos sincronizam
    Então vence a resposta mais recente, com a autoria registrada
    E as duas árvores ficam iguais

  Cenário: Condição que não pôde ser lida não esconde requisito
    Dado uma inspeção cuja revisão de condições ainda não chegou a este aparelho
    Quando abro o roteiro
    Então ele aparece por inteiro, sem esconder nada
    E a tela avisa que as condições ainda não foram carregadas

  Cenário: Inspeção que nasceu sem regra não passa a ter regra depois
    Dado uma inspeção em andamento criada antes de o roteiro ter condições
    Quando publico uma revisão de condições nesse roteiro
    E abro a inspeção de novo
    Então ela continua com todas as exigências aplicáveis

  # ── Onde o comportamento é garantido hoje ──────────────────────────────────
  # COND-02 (16/08/2026) entregou o motor puro; COND-03 (18/08) a árvore única congelada na criação
  # da inspeção; COND-04 (19/08) a persistência das regras; COND-05 (20/08) as perguntas de
  # roteamento e o contexto congelado; COND-06 e COND-07 (27/08) o editor, o simulador e o gate;
  # COND-08 (27/08) a execução consultando o motor. A tabela de revisões continua **vazia em
  # produção** — enquanto nenhum roteiro tiver revisão publicada, o app se comporta como antes:
  # sem regra = sempre aplicável.
  #
  # Garantido por teste, no motor (src/domain/applicability/):
  #   os três estados · null/indeterminado · TODAS/QUALQUER · else · herança seção→item ·
  #   erro de regra que não esconde requisito · "não foi possível determinar" · roteiro sem regra ·
  #   ciclo, referência quebrada, opção inexistente, pergunta aposentada, condição impossível
  #     → src/__tests__/domain/applicability.test.ts
  #     → src/__tests__/domain/applicabilityValidation.test.ts
  #   as regras hardcoded de hoje reproduzidas pelo motor
  #     → src/__tests__/domain/applicabilityEquivalence.test.ts
  #
  # Garantido por teste, no banco (supabase/tests/cond04_applicability_revisions.test.sql):
  #   rascunho aceita regra incompleta · publicar exige forma válida · publicada é imutável ·
  #   um rascunho por roteiro · inspeção só congela revisão publicada · isolamento por tenant ·
  #   grants sem anon · regras sobrevivem ao salvamento do editor
  # E na leitura/escrita (src/__tests__/services/applicabilityRevision.test.ts):
  #   roteiro sem revisão = sem regra · rascunho não é validado · publicação recusa referência quebrada
  #
  # Garantido por teste, nas perguntas de roteamento e no contexto (COND-05):
  #   momento da pergunta (wizard × campo) · resposta guarda o valor da opção, nunca o rótulo ·
  #   obrigatória segura o início e "não foi possível determinar" libera · contexto congelado
  #   normalizado, e cadastro que muda depois não mexe na inspeção · pergunta de roteamento fora da
  #   nota, do relatório e do plano de ação, mesmo com resposta forjada com o id dela
  #     → src/__tests__/domain/routingQuestions.test.ts
  #     → src/__tests__/services/cond05FrozenContext.test.ts
  #     → src/__tests__/components/RoutingQuestionField.test.tsx
  #
  # Garantido por teste, no editor e no simulador (COND-06 e COND-07):
  #   travas do ciclo de vida · duplicação que não herda id · resumo em linguagem humana ·
  #   simulação de cenário · gate de publicação, inclusive ramo inalcançável
  #     → src/__tests__/domain/applicabilityAuthoring.test.ts
  #     → src/__tests__/domain/applicabilitySimulate.test.ts
  #     → src/__tests__/components/ApplicabilityEditor.test.tsx
  #
  # Garantido por teste, na execução adaptativa (COND-08):
  #   árvore da tela (aplicável + pendente; o que saiu vai para a lista, com resposta preservada) ·
  #   impacto da mudança de resposta, com o caminho de volta · bloqueio do encerramento por
  #   pendência de condição, e "não foi possível determinar" liberando · merge por pergunta entre
  #   dois aparelhos, idempotente e convergente · o mapeamento que não apaga o que é local
  #     → src/__tests__/domain/applicabilityExecution.test.ts
  #     → src/__tests__/components/AdaptiveExecution.test.tsx
  #     → src/__tests__/services/cond08RoutingSync.test.ts
  #     → supabase/tests/cond08_routing_answers_sync.test.sql (o bundle levando as quatro colunas)
  #
  # Ainda sem implementação (cards COND-09 e COND-10): score, progresso, resumo, PDF, referências
  # de legislação e plano de ação sobre o conjunto de aplicáveis; e o piloto em Estética.
  #
  # O que já existia e virou a suíte de equivalência (docs/mapa-roteiro-inspecao.md):
  #   src/data/templates.ts:383  getEffectiveTemplate — as 6 regras hardcoded
  #   src/utils/reportTemplate.ts:72  resolveReportTemplate — congelamento e o fallback do achado A2
  #   src/utils/scoring.ts:8  binaryScore — item sem resposta valendo conforme (achado A1)
