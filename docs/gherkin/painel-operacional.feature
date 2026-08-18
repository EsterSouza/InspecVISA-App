# language: pt
Funcionalidade: Painel operacional das consultoras
  Como consultora
  Quero ver, num lugar só, o que exige minha ação hoje
  Para não vasculhar tela por tela — e que os números sejam verdadeiros

  # Seis blocos agregados no servidor; falha de um bloco não derruba os outros.
  Contexto:
    Dado compromissos, solicitações, evidências, planos de ação e contas do meu tenant

  Cenário: Contagem dos seis blocos numa chamada
    Quando abro o Painel
    Então vejo a contagem de compromissos próximos, solicitações novas, clientes aguardando,
      evidências pendentes, planos de ação vencidos e pendências financeiras

  Cenário: Falha isolada de um bloco não apaga a tela
    Dado que o bloco financeiro está indisponível
    Quando abro o Painel
    Então o bloco financeiro marca erro
    Mas os outros cinco blocos continuam contando normalmente

  # Bug #1 corrigido: consultora é atribuição da inspeção/agendamento, nunca o setor (`responsible`).
  Cenário: Filtrar por consultora usa a atribuição da inspeção, não o setor
    Dado planos de ação cujo campo "responsável" guarda setor (ex.: "Gerência / Administração")
    E que a inspeção de origem foi atribuída a "Ester Caiafa"
    Quando filtro o Painel pela consultora "Ester Caiafa"
    Então os planos de ação e evidências dessa inspeção aparecem
    E o filtro casa por consultant_names, nunca pelo setor

  # Bug #2 corrigido: o Painel não conta o que o cliente não vê.
  Cenário: Relatório oculto não é contado no Painel
    Dado um plano de ação vencido cujo relatório foi ocultado no portal
    Quando abro o Painel
    Então esse item não entra na contagem de planos vencidos
    E também não entra na lista paginada do bloco

  Cenário: Item resolvido ou oculto não conta como vencido
    Dado itens vencidos com status "hidden" e "resolved"
    Quando abro o Painel
    Então nenhum deles entra na contagem de planos vencidos

  # Bug #3: item indatável precisa ser visível, não silencioso.
  Cenário: Itens sem prazo têm sinal próprio
    Dado planos de ação publicados sem data de vencimento
    Quando abro o Painel
    Então eles aparecem como "sem prazo definido"
    E não se escondem por não terem data

  Cenário: Cada item leva ao seu destino (deep link)
    Dado a lista paginada de um bloco
    Quando clico num item
    Então vou direto ao registro correspondente, dentro do meu tenant

  # Escrito em 18/08/2026, depois de a Ester relatar que clicar numa evidência abria a ficha do
  # cliente. A regra acima existia, mas "registro correspondente" é vago demais para pegar isso:
  # a ficha do cliente também é *um* registro. Destino nomeado, bloco a bloco.
  Esquema do Cenário: O destino é o lugar onde a pendência se resolve
    Quando clico num item do bloco "<bloco>"
    Então abro <destino>

    Exemplos:
      | bloco                          | destino                                                  |
      | Compromissos próximos          | o compromisso na agenda                                  |
      | Pedidos de agendamento         | o pedido, na aba Solicitações de Agendamentos            |
      | Solicitações novas             | a solicitação                                            |
      | Clientes aguardando resposta   | a solicitação                                            |
      | Evidências aguardando revisão  | o item do plano de ação, com a evidência para aprovar    |
      | Planos de ação vencidos        | o item do plano de ação                                  |

  Cenário: A lista atrás do detalhe acompanha o item aberto por link
    Dado que o Plano de ação abre em "vencidas" por padrão
    E uma evidência de um item ainda no prazo
    Quando chego pelo link do Painel
    Então o detalhe abre e a lista atrás dele muda para o segmento daquele item
    E trocar de segmento depois disso continua sendo escolha minha

  # Garantido por: supabase/migrations/*_admin_operational_overview*.sql,
  # supabase/tests/admin_operational_overview.test.sql.
