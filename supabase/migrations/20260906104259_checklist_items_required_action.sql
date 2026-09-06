-- Ação corretiva pela norma, no item do roteiro.
--
-- Em vistoria pré-obra praticamente todo item sai não conforme pelo mesmo
-- motivo — a obra ainda não foi feita —, e a consultora reescreve à mão, item a
-- item, o que a norma exige. Este campo guarda esse texto uma vez, em tópicos
-- (um traço por tarefa, lidos por `parseCheckpoints`), e a tela de execução o
-- traz com um clique no botão "Pela norma".
--
-- Não substitui a situação encontrada, que é sempre do local, nem `guidance`,
-- que é o que ela precisa saber para RESPONDER. Não entra no score.
alter table public.checklist_items
  add column if not exists required_action text;

comment on column public.checklist_items.required_action is
  'Ação corretiva que a norma exige, já escrita em tópicos (um traço por tarefa). Preenche o campo "O que precisa ser feito" da execução com um clique; a consultora edita depois. Não é a situação encontrada, que é sempre do local.';
