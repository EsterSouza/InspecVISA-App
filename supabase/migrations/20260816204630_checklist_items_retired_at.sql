-- FE-17b — decisão 21: no editor de roteiro não existe "Excluir item", existe "Aposentar".
-- Aposentar tira o item das PRÓXIMAS inspeções; inspeções em andamento continuam vendo o item
-- (grandfather por inspections.created_at) e relatórios concluídos nunca são afetados (usam
-- snapshot). Nunca apagar checklist_items com resposta — responses.item_id não tem FK.
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS retired_at timestamptz;
