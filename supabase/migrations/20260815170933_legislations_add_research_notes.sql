alter table public.legislations add column if not exists research_notes text;

comment on column public.legislations.research_notes is
  'Cache de pesquisa: artigos ja lidos, o que dizem, e em que curadoria (REF-04/05/07) foram '
  'usados. Existe para nao repetir a mesma leitura de norma numa consulta futura.';
