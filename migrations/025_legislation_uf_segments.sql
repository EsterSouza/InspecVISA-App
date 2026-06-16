-- 025_legislation_uf_segments.sql
-- Permite filtrar legislações aplicáveis por UF e por segmento do estabelecimento.
--   uf       : sigla do estado (ex.: 'RJ', 'MG', 'SP'); NULL = federal/abrangência nacional.
--   segments : segmentos aplicáveis (ex.: {ilpi,saude,estetica,alimentos}); NULL/vazio = todos.
alter table public.legislations
  add column if not exists uf text,
  add column if not exists segments text[];

comment on column public.legislations.uf is 'Sigla da UF de abrangência; NULL = federal/nacional.';
comment on column public.legislations.segments is 'Segmentos aplicáveis (ilpi/saude/estetica/alimentos); NULL ou vazio = todos.';

-- Tag inicial das legislações existentes por padrão de nome (estado/município e segmento).
update public.legislations set uf='RJ' where uf is null and (
  name ilike '%(RJ%' or name ilike '%Rio de Janeiro%' or name ilike '%RJ Capital%'
  or name ilike '% RJ %' or name ilike '%RJ nº%' or name ilike '%8.049/2018%' or name = 'Lei 8.049/2018'
);
update public.legislations set uf='MG' where uf is null and (
  name ilike '%Belo Horizonte%' or name ilike '%SES/MG%' or name ilike '%(MG%' or name ilike '%/MG%'
);
update public.legislations set uf='SP' where uf is null and (
  name ilike '%(SP%' or name ilike '%CVS%' or name ilike '%SP Capital%'
);

update public.legislations set segments = array['ilpi'] where (segments is null or cardinality(segments)=0) and (
  name ilike '%ILPI%' or name ilike '%idoso%' or name ilike '%502/2021%' or name ilike '%509/2021%'
  or name ilike '%8.049%' or name ilike '%10.741%' or name ilike '%14.423%' or name ilike '%8.842%'
  or name ilike '%CNDI%' or name ilike '%Cuidador%' or name ilike '%COFEN%' or name ilike '%7.930%'
  or name ilike '%12/2015%'
);
update public.legislations set segments = array['alimentos'] where (segments is null or cardinality(segments)=0) and (
  name ilike '%216/2004%' or name ilike '%CVS%'
);
update public.legislations set segments = array['ilpi','saude','estetica'] where (segments is null or cardinality(segments)=0) and (
  name ilike '%222/2018%' or name ilike '%NR%32%' or name ilike '%9050%'
);
update public.legislations set segments = array['saude','estetica'] where (segments is null or cardinality(segments)=0) and (
  name ilike '%63/2011%' or name ilike '%50/2002%' or name ilike '%15/2012%' or name ilike '%36/2013%' or name ilike '%751/2022%'
);
