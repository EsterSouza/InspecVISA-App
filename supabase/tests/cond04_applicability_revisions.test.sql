\set ON_ERROR_STOP on

-- ============================================================================
-- COND-04 — persistência das regras de aplicabilidade.
-- Migration: supabase/migrations/20260819090603_cond04_applicability_revisions.sql
--
-- Fixture próprio (Postgres puro, sem o schema do Supabase), no padrão das demais
-- suítes: cria os papéis, o schema `private` com os dois helpers de tenant e as
-- tabelas do roteiro que a migration referencia.
--
-- Tenants: A = aaaa… (o `private.my_tenant_ids()` do fixture só enxerga este)
--          B = bbbb… (consultoria vizinha)
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

create schema auth;
create schema private;

-- O Supabase concede ALL em tabela nova de `public` para anon e authenticated por
-- default privilege. Postgres puro não faz isso, e sem reproduzir aqui o teste de
-- grants passaria de graça — foi assim que o risco apareceu no PROD-01.
alter default privileges in schema public grant all on tables to anon, authenticated;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select '10000000-0000-4000-8000-000000000001'::uuid;
$$;

create function private.my_tenant_ids()
returns setof uuid
language sql
stable
as $$
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
$$;

create function private.is_tenant_staff(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select p_tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
$$;

grant usage on schema private to authenticated;
grant execute on function private.my_tenant_ids() to authenticated;
grant execute on function private.is_tenant_staff(uuid) to authenticated;

create table public.tenants (
  id uuid primary key
);

insert into public.tenants (id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- As três tabelas do roteiro, como estão hoje em produção: sem tenant_id, globais, e
-- com `checklist_templates.id` em TEXT desde `20260426140859_convert_template_ids_to_text`
-- (roteiro estático de `src/data` tem id legível). Conferido no schema real antes de
-- escrever a migration — fixture com uuid aqui esconderia FK incompatível.
create table public.checklist_templates (
  id       text primary key,
  name     text not null,
  category text,
  version  text
);

create table public.checklist_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id text not null references public.checklist_templates(id) on delete cascade,
  title       text not null,
  "order"     integer not null default 1
);

create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.checklist_sections(id) on delete cascade,
  description text not null,
  weight      integer not null default 1,
  is_critical boolean not null default false,
  retired_at  timestamptz,
  "order"     integer not null default 1
);

create table public.inspections (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid,
  client_id    uuid,
  template_id  text,
  status       text not null default 'in_progress',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

grant select, insert, update, delete on table public.inspections to authenticated;

insert into public.checklist_templates (id, name, category, version) values
  ('tpl-estetica-v1', 'Estetica - Roteiro base', 'estetica', '2026'),
  ('tpl-ilpi-v1', 'ILPI - Base Federal', 'ilpi', '2026');

insert into public.checklist_sections (id, template_id, title, "order") values
  ('31000000-0000-4000-8000-000000000001', 'tpl-estetica-v1', 'Processamento de artigos', 1);

insert into public.checklist_items (id, section_id, description, "order") values
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Autoclave com registro de ciclo', 1),
  ('32000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'Contrato com a empresa terceirizada', 2);

\ir ../migrations/20260819090603_cond04_applicability_revisions.sql

-- ─── Payloads usados nos casos ───────────────────────────────────────────────

create temporary table fixture_payloads (chave text primary key, valor jsonb);

insert into fixture_payloads values
  ('perguntas', $json$[
    {
      "id": "q-processamento",
      "text": "Realiza processamento de artigos reutilizaveis?",
      "type": "single_choice",
      "sectionId": "31000000-0000-4000-8000-000000000001",
      "options": [
        {"value": "proprio", "label": "Sim, proprio"},
        {"value": "terceirizado", "label": "Sim, terceirizado"},
        {"value": "nao", "label": "Nao realiza"}
      ]
    }
  ]$json$::jsonb),
  ('regras', $json$[
    {
      "id": "rule-autoclave",
      "target": {"type": "item", "id": "32000000-0000-4000-8000-000000000001"},
      "expression": {
        "combinator": "all",
        "conditions": [
          {"source": "question", "field": "q-processamento", "operator": "equals", "value": "proprio"}
        ]
      }
    },
    {
      "id": "rule-secao-rj",
      "target": {"type": "section", "id": "31000000-0000-4000-8000-000000000001"},
      "expression": {
        "combinator": "any",
        "conditions": [
          {"source": "context", "field": "uf", "operator": "in_list", "value": ["RJ", "SP"]}
        ]
      }
    }
  ]$json$::jsonb),
  -- Regra pela metade, do jeito que a consultora deixa no meio do trabalho: sem
  -- operador e sem alvo. Rascunho aceita; publicar, não.
  ('regras_incompletas', $json$[
    {
      "id": "rule-em-construcao",
      "target": {"type": "item", "id": ""},
      "expression": {"combinator": "all", "conditions": []}
    }
  ]$json$::jsonb);

-- ─── 1. Rascunho aceita regra incompleta ─────────────────────────────────────
do $$
declare
  v_id uuid;
  v_revision integer;
begin
  insert into public.checklist_template_revisions (tenant_id, template_id, rules, routing_questions)
  values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'tpl-estetica-v1',
    (select valor from fixture_payloads where chave = 'regras_incompletas'),
    '[]'::jsonb
  )
  returning id, revision into v_id, v_revision;

  if v_revision <> 1 then
    raise exception 'primeira revisao deveria ser 1, veio %', v_revision;
  end if;

  if (select status from public.checklist_template_revisions where id = v_id) <> 'draft' then
    raise exception 'revisao nova deveria nascer rascunho';
  end if;

  if (select published_at from public.checklist_template_revisions where id = v_id) is not null then
    raise exception 'rascunho nao pode nascer carimbado';
  end if;
end;
$$;

-- ─── 2. Publicar rascunho incompleto é bloqueado ─────────────────────────────
do $$
declare
  v_erro text := 'nenhum';
begin
  begin
    update public.checklist_template_revisions
    set status = 'published'
    where template_id = 'tpl-estetica-v1'
      and status = 'draft';
  exception when others then
    v_erro := sqlerrm;
  end;

  if v_erro not like '%estrutura invalida%' then
    raise exception 'regra incompleta foi publicada (erro: %)', v_erro;
  end if;
end;
$$;

-- ─── 3. Um rascunho por roteiro e tenant ─────────────────────────────────────
do $$
declare
  v_erro text := 'nenhum';
begin
  begin
    insert into public.checklist_template_revisions (tenant_id, template_id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'tpl-estetica-v1');
  exception when unique_violation then
    v_erro := 'unique';
  end;

  if v_erro <> 'unique' then
    raise exception 'dois rascunhos no mesmo roteiro';
  end if;

  -- Outro roteiro do mesmo tenant tem rascunho próprio, e sua numeração recomeça.
  insert into public.checklist_template_revisions (tenant_id, template_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'tpl-ilpi-v1');

  if (select revision from public.checklist_template_revisions
      where template_id = 'tpl-ilpi-v1') <> 1 then
    raise exception 'numeracao nao e por roteiro';
  end if;
end;
$$;

-- ─── 4. Publicar rascunho completo carimba e congela ─────────────────────────
do $$
declare
  v_id uuid;
  v_erro text;
begin
  update public.checklist_template_revisions
  set rules = (select valor from fixture_payloads where chave = 'regras'),
      routing_questions = (select valor from fixture_payloads where chave = 'perguntas'),
      status = 'published'
  where template_id = 'tpl-estetica-v1'
    and status = 'draft'
  returning id into v_id;

  if (select published_at from public.checklist_template_revisions where id = v_id) is null then
    raise exception 'publicada sem carimbo de publicacao';
  end if;

  -- Imutabilidade: nem o conteúdo, nem o status, nem apagar.
  v_erro := 'nenhum';
  begin
    update public.checklist_template_revisions set rules = '[]'::jsonb where id = v_id;
  exception when others then
    v_erro := sqlerrm;
  end;
  if v_erro not like '%imutavel%' then
    raise exception 'revisao publicada foi alterada (erro: %)', v_erro;
  end if;

  v_erro := 'nenhum';
  begin
    delete from public.checklist_template_revisions where id = v_id;
  exception when others then
    v_erro := sqlerrm;
  end;
  if v_erro not like '%nao pode ser apagada%' then
    raise exception 'revisao publicada foi apagada (erro: %)', v_erro;
  end if;
end;
$$;

-- ─── 5. Revisão seguinte não mexe na publicada ───────────────────────────────
do $$
declare
  v_nova uuid;
begin
  insert into public.checklist_template_revisions (tenant_id, template_id, rules, routing_questions)
  values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'tpl-estetica-v1',
    '[]'::jsonb,
    '[]'::jsonb
  )
  returning id into v_nova;

  if (select revision from public.checklist_template_revisions where id = v_nova) <> 2 then
    raise exception 'a revisao seguinte nao continuou a numeracao';
  end if;

  if (select jsonb_array_length(rules) from public.checklist_template_revisions
      where template_id = 'tpl-estetica-v1' and status = 'published') <> 2 then
    raise exception 'a revisao publicada mudou quando a seguinte foi criada';
  end if;
end;
$$;

-- ─── 6. Descartar rascunho é permitido ───────────────────────────────────────
delete from public.checklist_template_revisions
where template_id = 'tpl-estetica-v1' and status = 'draft';

-- ─── 7. Referência por id sobrevive ao salvamento do editor ──────────────────
--
-- `TemplateService.updateFullTemplate` apaga TODAS as seções e itens do roteiro e
-- reinsere com os mesmos ids. É o caso que uma FK teria transformado em perda
-- silenciosa das regras.
do $$
declare
  v_alvos integer;
begin
  delete from public.checklist_items
  where section_id in (
    select id from public.checklist_sections where template_id = 'tpl-estetica-v1'
  );
  delete from public.checklist_sections where template_id = 'tpl-estetica-v1';

  insert into public.checklist_sections (id, template_id, title, "order") values
    ('31000000-0000-4000-8000-000000000001', 'tpl-estetica-v1', 'Processamento de artigos (texto revisado)', 1);
  insert into public.checklist_items (id, section_id, description, "order") values
    ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Autoclave com registro de ciclo', 1),
    ('32000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'Contrato com a empresa terceirizada', 2);

  select count(*) into v_alvos
  from public.checklist_template_revisions r,
       jsonb_array_elements(r.rules) x
  where r.status = 'published'
    and r.template_id = 'tpl-estetica-v1';

  if v_alvos <> 2 then
    raise exception 'as regras nao sobreviveram ao salvamento do editor (% alvos)', v_alvos;
  end if;

  -- E os alvos continuam resolvendo para os itens e seções reinseridos.
  if not exists (
    select 1
    from public.checklist_template_revisions r,
         jsonb_array_elements(r.rules) x
    join public.checklist_items i on i.id::text = x.value->'target'->>'id'
    where r.status = 'published' and x.value->'target'->>'type' = 'item'
  ) then
    raise exception 'a regra de item ficou orfa depois do salvamento do editor';
  end if;
end;
$$;

-- ─── 8. Inspeção só congela revisão publicada ────────────────────────────────
do $$
declare
  v_publicada uuid;
  v_rascunho uuid;
  v_erro text;
begin
  select id into v_publicada from public.checklist_template_revisions
  where template_id = 'tpl-estetica-v1' and status = 'published';

  select id into v_rascunho from public.checklist_template_revisions
  where template_id = 'tpl-ilpi-v1' and status = 'draft';

  -- Sem revisão: o caminho de hoje, sem regra nenhuma.
  insert into public.inspections (id, tenant_id, template_id)
  values ('40000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'tpl-estetica-v1');

  -- Com revisão publicada: aceito.
  insert into public.inspections (id, tenant_id, template_id, applicability_revision_id)
  values ('40000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'tpl-estetica-v1', v_publicada);

  -- Com rascunho: negado — "regra incompleta nao pode afetar inspecao nova".
  v_erro := 'nenhum';
  begin
    insert into public.inspections (id, tenant_id, template_id, applicability_revision_id)
    values ('40000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'tpl-ilpi-v1', v_rascunho);
  exception when others then
    v_erro := sqlerrm;
  end;
  if v_erro not like '%so congela revisao publicada%' then
    raise exception 'inspecao congelou um rascunho (erro: %)', v_erro;
  end if;

  -- Revisão de outro tenant: negada.
  v_erro := 'nenhum';
  begin
    update public.inspections
    set tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        applicability_revision_id = v_publicada
    where id = '40000000-0000-4000-8000-000000000001';
  exception when others then
    v_erro := sqlerrm;
  end;
  if v_erro not like '%outro tenant%' then
    raise exception 'inspecao congelou revisao de outro tenant (erro: %)', v_erro;
  end if;

  -- E a revisão usada por inspeção não desaparece nem quando o roteiro é apagado.
  v_erro := 'nenhum';
  begin
    delete from public.checklist_templates where id = 'tpl-estetica-v1';
  exception when others then
    v_erro := sqlerrm;
  end;
  if v_erro = 'nenhum' then
    raise exception 'apagar o roteiro levou junto a revisao congelada de uma inspecao';
  end if;
end;
$$;

-- ─── 9. Isolamento por tenant e grants ───────────────────────────────────────
--
-- A vizinha (tenant B) existe só no fixture: `private.my_tenant_ids()` devolve
-- apenas o tenant A, então tudo que for de B tem de ficar invisível e inescrevível.
insert into public.checklist_template_revisions (tenant_id, template_id, rules, routing_questions)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'tpl-ilpi-v1',
  '[]'::jsonb,
  '[]'::jsonb
);

do $$
begin
  if has_table_privilege('anon', 'public.checklist_template_revisions', 'select')
     or has_table_privilege('anon', 'public.checklist_template_revisions', 'insert')
     or has_table_privilege('anon', 'public.checklist_template_revisions', 'update')
     or has_table_privilege('anon', 'public.checklist_template_revisions', 'delete') then
    raise exception 'anon tem grant na tabela de revisoes';
  end if;

  if not has_table_privilege('authenticated', 'public.checklist_template_revisions', 'select') then
    raise exception 'a consultora perdeu a leitura das revisoes';
  end if;

  if has_table_privilege('authenticated', 'public.checklist_template_revisions', 'truncate') then
    raise exception 'authenticated pode truncar a tabela de revisoes';
  end if;

  if not (
    select relrowsecurity from pg_class
    where oid = 'public.checklist_template_revisions'::regclass
  ) then
    raise exception 'RLS desligada na tabela de revisoes';
  end if;
end;
$$;

set role authenticated;

do $$
declare
  v_visiveis integer;
  v_erro text;
begin
  select count(*) into v_visiveis from public.checklist_template_revisions;
  if exists (
    select 1 from public.checklist_template_revisions
    where tenant_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) then
    raise exception 'a consultora enxerga revisao de outra consultoria';
  end if;
  if v_visiveis = 0 then
    raise exception 'a consultora nao enxerga as proprias revisoes';
  end if;

  -- Escrever no tenant vizinho: negado.
  v_erro := 'nenhum';
  begin
    insert into public.checklist_template_revisions (tenant_id, template_id)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'tpl-estetica-v1');
  exception when others then
    v_erro := sqlerrm;
  end;
  if v_erro = 'nenhum' then
    raise exception 'a consultora gravou revisao no tenant vizinho';
  end if;

  -- Nascer publicada: negado pela policy de insert.
  v_erro := 'nenhum';
  begin
    insert into public.checklist_template_revisions (tenant_id, template_id, status, published_at)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'tpl-estetica-v1',
            'published', now());
  exception when others then
    v_erro := sqlerrm;
  end;
  if v_erro = 'nenhum' then
    raise exception 'revisao nasceu publicada, sem passar por rascunho';
  end if;

  -- Rascunho próprio: permitido, e a publicação é uma transição.
  insert into public.checklist_template_revisions (tenant_id, template_id, rules, routing_questions)
  values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'tpl-estetica-v1',
    '[]'::jsonb,
    '[]'::jsonb
  );

  update public.checklist_template_revisions
  set status = 'published'
  where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and template_id = 'tpl-estetica-v1'
    and status = 'draft';

  -- Publicada some do alcance do update: a policy não a enxerga, e o gatilho
  -- tampouco a deixaria passar.
  if exists (
    select 1 from public.checklist_template_revisions
    where template_id = 'tpl-estetica-v1'
      and status = 'draft'
  ) then
    raise exception 'a transicao para publicada nao aconteceu';
  end if;
end;
$$;

reset role;

-- ─── 10. Roteiro sem revisão: comportamento idêntico ao de hoje ──────────────
do $$
begin
  -- Nenhuma revisão foi criada para roteiros que ninguém tocou, e consultar isso
  -- devolve vazio — nunca erro. É a compatibilidade do card: sem revisao = sem regra.
  if exists (
    select 1 from public.checklist_templates t
    where not exists (
      select 1 from public.checklist_template_revisions r where r.template_id = t.id
    )
    and t.id = 'tpl-inexistente'
  ) then
    raise exception 'fixture inconsistente';
  end if;

  if (
    select count(*) from public.checklist_template_revisions r
    where r.template_id = 'tpl-ilpi-v1'
      and r.tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and r.status = 'published'
  ) <> 0 then
    raise exception 'roteiro sem publicacao apareceu como publicado';
  end if;
end;
$$;

-- ─── 11. Estrutura: o que a publicação recusa ────────────────────────────────
do $$
declare
  v_casos jsonb[] := array[
    -- condição com operador fora do catálogo
    $json$[{"id":"r1","target":{"type":"item","id":"32000000-0000-4000-8000-000000000001"},"expression":{"combinator":"all","conditions":[{"source":"question","field":"q","operator":"parece_com","value":"x"}]}}]$json$::jsonb,
    -- condição sem campo: regra referenciaria texto, não id
    $json$[{"id":"r1","target":{"type":"item","id":"32000000-0000-4000-8000-000000000001"},"expression":{"combinator":"all","conditions":[{"source":"question","field":"","operator":"equals","value":"x"}]}}]$json$::jsonb,
    -- grupo vazio
    $json$[{"id":"r1","target":{"type":"section","id":"31000000-0000-4000-8000-000000000001"},"expression":{"combinator":"all","conditions":[]}}]$json$::jsonb,
    -- combinador desconhecido
    $json$[{"id":"r1","target":{"type":"section","id":"31000000-0000-4000-8000-000000000001"},"expression":{"combinator":"talvez","conditions":[{"source":"context","field":"uf","operator":"equals","value":"RJ"}]}}]$json$::jsonb,
    -- duas regras no mesmo alvo e no mesmo ramo (COND-02, decisão 1)
    $json$[
      {"id":"r1","target":{"type":"item","id":"32000000-0000-4000-8000-000000000001"},"expression":{"combinator":"all","conditions":[{"source":"context","field":"uf","operator":"equals","value":"RJ"}]}},
      {"id":"r2","target":{"type":"item","id":"32000000-0000-4000-8000-000000000001"},"expression":{"combinator":"all","conditions":[{"source":"context","field":"uf","operator":"equals","value":"SP"}]}}
    ]$json$::jsonb
  ];
  v_caso jsonb;
  v_indice integer := 0;
begin
  foreach v_caso in array v_casos loop
    v_indice := v_indice + 1;
    if private.applicability_payload_is_structural(v_caso, '[]'::jsonb) then
      raise exception 'a validacao estrutural aceitou o caso invalido %', v_indice;
    end if;
  end loop;

  -- Pergunta com tipo desconhecido e id repetido também são recusadas.
  if private.applicability_payload_is_structural(
    '[]'::jsonb,
    $json$[{"id":"q1","text":"Texto livre?","type":"text"}]$json$::jsonb
  ) then
    raise exception 'a validacao estrutural aceitou pergunta de texto livre';
  end if;

  if private.applicability_payload_is_structural(
    '[]'::jsonb,
    $json$[{"id":"q1","text":"A?","type":"boolean"},{"id":"q1","text":"B?","type":"boolean"}]$json$::jsonb
  ) then
    raise exception 'a validacao estrutural aceitou id de pergunta repetido';
  end if;

  -- E o payload bom passa, inclusive vazio (roteiro sem regra).
  if not private.applicability_payload_is_structural('[]'::jsonb, '[]'::jsonb) then
    raise exception 'roteiro sem regra foi recusado';
  end if;

  if not private.applicability_payload_is_structural(
    (select valor from fixture_payloads where chave = 'regras'),
    (select valor from fixture_payloads where chave = 'perguntas')
  ) then
    raise exception 'o payload valido do fixture foi recusado';
  end if;

  -- `else` é ramo do mesmo alvo, e convive com o `if` (COND-02, decisão 2).
  if not private.applicability_payload_is_structural(
    $json$[
      {"id":"r1","branch":"if","target":{"type":"item","id":"32000000-0000-4000-8000-000000000001"},"expression":{"combinator":"all","conditions":[{"source":"context","field":"uf","operator":"equals","value":"RJ"}]}},
      {"id":"r2","branch":"else","target":{"type":"item","id":"32000000-0000-4000-8000-000000000001"},"expression":{"combinator":"all","conditions":[{"source":"context","field":"uf","operator":"equals","value":"RJ"}]}}
    ]$json$::jsonb,
    '[]'::jsonb
  ) then
    raise exception 'o ramo else foi recusado';
  end if;
end;
$$;

\echo 'cond04_applicability_revisions.test.sql OK'
