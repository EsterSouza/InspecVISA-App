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

  # ── Onde o comportamento é garantido hoje ──────────────────────────────────
  # Em lugar nenhum: nada deste arquivo está implementado. É o alvo dos cards COND-02 a COND-10.
  # O que já existe e vira suíte de equivalência do motor novo (docs/mapa-roteiro-inspecao.md):
  #   src/data/templates.ts:383  getEffectiveTemplate — as 6 regras hardcoded
  #   src/utils/reportTemplate.ts:72  resolveReportTemplate — congelamento e o fallback do achado A2
  #   src/utils/scoring.ts:8  binaryScore — item sem resposta valendo conforme (achado A1)
  # Ao implementar cada card, trocar esta nota pela rastreabilidade real.
