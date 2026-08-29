# language: pt
Funcionalidade: Portal do cliente
  Como cliente (ou gestor de unidade)
  Quero acompanhar meu plano de ação, documentos e agenda
  Para agir sobre as pendências sanitárias sem atrito

  Cenário: Navegação por seção com URL própria
    Dado que entro no portal com email e código da conta
    Quando navego entre Visão geral, Plano de ação, Solicitações, Documentos, Agenda e Financeiro
    Então cada seção tem sua própria URL
    E o item ativo do menu reflete a seção aberta

  Cenário: Plano de ação agrupado por unidade numa conta multi-unidade
    Dado uma conta com 13 unidades
    Quando abro o Plano de ação em "Todas as unidades"
    Então as pendências vêm agrupadas por unidade, com contador por grupo
    E cada grupo mostra no máximo 3 pendências, abrindo a unidade inteira num clique
    E as unidades são ordenadas da que mais precisa de atenção para a que menos precisa

  Cenário: Acima de 6 unidades no celular os chips viram seletor
    Dado uma conta com mais de 6 unidades acessada no celular
    Quando abro o filtro de unidade
    Então os chips de unidade dão lugar a um seletor

  # PORT-06: o que o contrato inclui, não uma trava temporária da Central de acesso.
  Cenário: Plano de ação sem envio de evidência no contrato só de vistoria
    Dado uma unidade sem revisão de evidência contratada
    Quando o cliente abre o Plano de ação pela conta
    Então a pendência aparece inteira, sem o envio de arquivo
    E o aviso explica que o plano não inclui envio de evidências
    E declarar a situação e marcar os tópicos continuam disponíveis
    # Detalhado em plano-de-acao.feature; aqui fica o caminho pela navegação da conta.

  # PORT-02: qualquer token de visita da unidade serve como link permanente dela.
  Cenário: Link público por unidade, sem login
    Dado uma unidade com visita registrada
    Quando copio o "link do gestor" daquela unidade
    Então o link abre o plano de ação da unidade sem pedir senha
    E filtra pelo cliente da visita, não por um relatório específico

  # FE-10: nome e função do cliente deixam de ser obrigatórios.
  Cenário: Declarar a situação de um item sem preencher nome
    Dado um item de plano de ação aberto no portal
    Quando declaro a situação do item sem informar nome nem função
    Então a declaração é aceita
    Mas se declaro "não fiz" uma justificativa continua obrigatória

  Cenário: Enviar evidência de conclusão
    Dado um item de plano de ação aberto no portal
    Quando envio um arquivo como evidência
    Então a evidência fica pendente de revisão da consultora
    E o arquivo vai para um bucket privado, acessível só por URL assinada

  # Garantido por: src/components/client/*, PortalActionPlan.test.tsx,
  # PortalQuickActions.test.tsx, PortalAppointments.test.tsx.
