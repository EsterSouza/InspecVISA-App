# language: pt
Funcionalidade: Plano de ação projetado para o cliente
  Como sistema
  Quero projetar as não-conformidades da inspeção como plano de ação
  Para o cliente acompanhar as pendências sem nunca tocar nas respostas do laudo

  # O cliente nunca lê `responses`; vê uma cópia enxuta deduplicada por source_item_id.
  Contexto:
    Dado um relatório publicado com não-conformidades

  Cenário: Cada não-conformidade vira um item de plano de ação
    Quando o relatório é publicado
    Então cada NC gera um item com título, situação e ação recomendada
    E a prioridade é "urgente" se o item é crítico, "importante" se peso >= 5, senão "recomendação"

  Cenário: Republicar o mesmo relatório é idempotente
    Dado um item de plano de ação já projetado
    Quando o relatório é publicado de novo
    Então o item não é duplicado
    E um item já resolvido não é sobrescrito

  Esquema do Cenário: Prazo em texto livre vira data corrida a partir da visita
    Dado uma NC com prazo "<prazo>"
    Quando o item é projetado
    Então o prazo em dias é "<dias>"

    Exemplos:
      | prazo          | dias  |
      | Imediato       | 0     |
      | 24 horas       | 1     |
      | 30 dias        | 30    |
      | 2 semanas      | 14    |
      | assim que possível | sem prazo |

  # Bug #3 desta base: prazo indatável não pode virar silêncio.
  Cenário: Item sem prazo datável não some — fica visível como "sem prazo"
    Dado uma NC com prazo "assim que possível"
    Quando o item é projetado
    Então o item vai ao portal sem data de vencimento
    E o item é sinalizado como "sem prazo definido", não omitido

  Cenário: Relatório oculto não vaza item nenhum ao cliente
    Dado um relatório marcado como oculto no portal
    Quando o cliente abre o plano de ação
    Então nenhum item daquela visita aparece
    E a regra é reaplicada em tempo real na leitura

  # Garantido por: src/utils/clientActionPlan.ts (+ .test.ts),
  # supabase/migrations/20260807102311_client_action_items.sql (RPC de leitura).
