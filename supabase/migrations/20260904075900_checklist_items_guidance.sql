-- Campo de ORIENTAÇÃO do item do roteiro.
--
-- Por que uma coluna nova, e não reescrever a pergunta:
--
--   1. Reescrever `description` no lugar troca a pergunta de respostas JÁ
--      gravadas — foi o que aconteceu no REF-05, quando 18 respostas passaram a
--      responder outra coisa.
--   2. E, no caso concreto que originou este campo, reescrever também
--      ESTREITARIA a pergunta. `sau-031` ("área e dimensão mínima compatíveis
--      com a atividade") cobre consultório indiferenciado (7,5 m² / 2,2 m),
--      diferenciado (7,5 ou 6,0 m² com área de exames comum) e sala de exames e
--      procedimentos (9,0 m² sem área de limpeza, 12,0 m² com). Cravar "7,50 m²"
--      na pergunta a faria deixar de servir para metade dos casos.
--
-- A orientação é o que a consultora precisa saber para RESPONDER a pergunta —
-- números de dimensionamento, endereço exato na norma, CNAEs aplicáveis — e não
-- a pergunta em si. Por isso fica ao lado, e não dentro.
--
-- Aditiva e sem default: item sem orientação continua exatamente como está, e o
-- score não olha para esta coluna (o MARP usa só `weight` e `is_critical`).

ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS guidance text;

COMMENT ON COLUMN public.checklist_items.guidance IS
  'Orientação de campo: dimensionamento, endereço na norma, CNAEs. Não altera a pergunta nem o score.';
