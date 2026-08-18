-- Base unificada de legislação (@visa/legislacao) — colunas que vieram do PastaVISA.
--
-- `abnt`: referência NBR 6023 completa, escrita à mão (com data do ato, local de
-- publicação e "Disponível em"). O PastaVISA já mantinha uma para cada norma que
-- cita; o InspecVISA montava só a forma curta a partir de authority + name +
-- summary. Com a coluna, a citação do PDF passa a usar a referência pronta quando
-- ela existe e cai na forma curta quando não existe.
--
-- `municipio`: alcance municipal do ato. Antes só havia `uf`, então o Decreto Rio
-- nº 23.915/2004 (Rio de Janeiro capital) era sugerido para qualquer cliente do
-- estado do RJ, incluindo Niterói ou Petrópolis, onde não vale.
--
-- As linhas novas não vêm daqui: a biblioteca do pacote é semeada pela tela
-- Admin → Legislações ("semear normas padrão"), que insere o que falta por nome.

alter table public.legislations
  add column if not exists abnt text,
  add column if not exists municipio text;

comment on column public.legislations.abnt is
  'Referência ABNT NBR 6023 completa. Vazio = a citação é montada de authority + name + summary.';
comment on column public.legislations.municipio is
  'Município de abrangência do ato; exige uf preenchida. Vazio = alcança a UF inteira.';
comment on column public.legislations.status is
  'vigente | vigente_com_alteracoes | revogada | nao_verificado. NULL = ainda não verificado.';
