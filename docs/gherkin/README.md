# Gherkin — comportamento do InspecVISA

**Documentação viva**, não teste executável. Estes `.feature` descrevem, em pt-br e em linguagem de
negócio, *o que o produto faz* — para que uma consultora, ou uma sessão nova de trabalho, entenda o
comportamento sem abrir código. Aberto em 15/08/2026 (ver `docs/AUDITORIA-2026-08.md`, seção 3.2).

## Por que não é executável (ainda)

A base de testes é `vitest` (unitário) + suítes SQL em Postgres 16. Ligar estes cenários a um runner
Cucumber é infra nova que só se justifica quando houver ganho claro — YAGNI por ora. Enquanto isso,
cada `.feature` aponta, no rodapé, **onde o comportamento é garantido de fato** (teste unitário,
suíte SQL, ou código), para não virar documentação que mente.

## Convenção

- Um arquivo por domínio. Palavras-chave em português (`Funcionalidade`, `Cenário`, `Dado`,
  `Quando`, `Então`, `E`, `Mas`, `Esquema do Cenário`, `Exemplos`).
- Cenário descreve **regra observável**, não implementação. Nada de nome de função no corpo do
  cenário; a rastreabilidade fica no rodapé.
- Quando o comportamento tem uma razão sanitária ou de integridade, ela vira comentário `#`.

## Índice

| Arquivo | Domínio |
|---|---|
| `inspecao.feature` | Abertura, semeadura por recorte, itens extras, finalização e congelamento |
| `plano-de-acao.feature` | Projeção da NC, prazo, dedup, resolução, relatório oculto |
| `portal-cliente.feature` | Navegação, unidades, link público, declaração de status, evidência |
| `agendamento.feature` | Calendário semana/lista, solicitação, confirmação |
| `referencias-relatorio.feature` | Referência curada, autoria, revogada/substituta, UF, só o citado |
| `painel-operacional.feature` | Os seis blocos, filtro por consultora, relatório oculto, sem prazo |
| `seguranca-multitenant.feature` | Isolamento por tenant, grants nos dois papéis, buckets privados |
| `aplicabilidade.feature` | **Alvo, não comportamento atual.** Motor de condicionais: três estados, preservação de resposta, congelamento, offline e colaboração (COND-01) |
