# language: pt
Funcionalidade: Execução de inspeção sanitária
  Como consultora sanitária
  Quero abrir, executar e finalizar uma inspeção
  Para gerar um laudo íntegro sem perder resposta, foto nem recorte profissional

  Contexto:
    Dado uma unidade com histórico de inspeções concluídas
    E um roteiro vigente compatível com o segmento da unidade

  Cenário: Semeadura respeita o recorte profissional escolhido
    Dado que abro uma inspeção de ILPI escolhendo o recorte "Saúde"
    Quando a inspeção é aberta
    Então os itens de Nutrição não são pré-carregados na execução
    E apenas os itens do recorte de Saúde aparecem

  Cenário: Pendências vêm do histórico sem criar seção artificial
    Dado que a unidade tem não-conformidades em inspeções anteriores
    Quando abro uma nova inspeção da mesma unidade
    Então as pendências aparecem nos itens e seções normais do roteiro
    E não é criada a seção artificial "Pendências de inspeções anteriores"
    E nenhum título de item é um UUID

  Cenário: Semeadura só preenche o que falta, sem sobrescrever
    Dado uma inspeção em andamento com respostas, textos e fotos
    Quando a inspeção é reaberta e a semeadura roda de novo
    Então apenas os itens ausentes são acrescentados
    E as respostas, textos e fotos já preenchidos são preservados

  Cenário: Item extra é editável enquanto a inspeção está em andamento
    Dado um item extra criado durante a inspeção
    Quando edito descrição, criticidade e peso
    Então o item mantém o mesmo ID e a mesma posição
    E a numeração dos demais itens não muda

  # Foto se vincula a response_id, não a item_id — recriar resposta deixaria a foto órfã.
  Cenário: Finalização congela o relatório sem perder evidência
    Dado uma inspeção pronta para finalizar
    Quando finalizo a inspeção
    Então o rascunho é sincronizado e as evidências reconciliadas numa RPC transacional
    E só então a inspeção é marcada como concluída e o relatório é congelado
    E as fotos continuam vinculadas às respostas

  Cenário: Relatório concluído não recebe backfill nem reescrita
    Dado um relatório já concluído e congelado
    Quando uma nova versão do roteiro é semeada em inspeções em andamento
    Então o relatório concluído não é alterado
    E nenhuma resposta histórica é reescrita

  # Garantido por: src/__tests__ (checklistIntegrity, appointment_domain.test.sql),
  # e pela RPC transacional de finalização (sync_inspection_bundle).
