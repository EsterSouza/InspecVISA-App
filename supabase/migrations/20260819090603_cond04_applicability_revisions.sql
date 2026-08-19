-- ============================================================================
-- COND-04 — Persistência, revisão, RLS e compatibilidade do motor de condicionais.
--
-- Normativo: docs/contrato-aplicabilidade.md · plano: docs/HANDOFF-CONDICIONAIS.md
-- Schema declarativo (o que entra em `rules` e `routing_questions`):
--   src/domain/applicability/schema.ts (COND-02)
--
-- ─── O formato físico escolhido, e por quê ──────────────────────────────────
--
-- Uma TABELA NOVA de revisões, com o conteúdo condicional em dois JSONB de forma
-- validada — e não colunas em `checklist_items`/`checklist_sections`, nem tabela
-- relacional de condição.
--
--   1. O editor de roteiro (TemplateService.updateFullTemplate) salva **apagando
--      todas as seções e itens do roteiro e reinserindo com os mesmos ids**. Regra
--      guardada dentro do item — ou em tabela filha com FK para item/seção — seria
--      apagada em CASCADE a cada salvamento do editor, em silêncio. Por isso a
--      regra referencia item e seção **por id, sem FK**, exatamente como
--      `responses.item_id` já faz (docs/mapa-roteiro-inspecao.md).
--   2. Regra é um documento inteiro por natureza: alvo + grupo + condições. O motor
--      canônico (COND-02) lê e escreve esse documento de uma vez; normalizar em três
--      tabelas só para reconstruí-lo a cada leitura não compra integridade nenhuma
--      que a validação estrutural daqui já não dê.
--   3. Revisão é a unidade de versionamento: rascunho editável, publicada imutável.
--      Isso é linha, não coluna.
--
-- ─── O que esta migration garante ───────────────────────────────────────────
--
--   * Isolamento por tenant — `tenant_id` obrigatório e RLS por
--     `private.my_tenant_ids()` + `private.is_tenant_staff()`. As três tabelas do
--     roteiro (`checklist_templates`, `_sections`, `_items`) são globais e liberadas
--     para qualquer `authenticated` (dívida registrada em docs/AUDITORIA-2026-08.md);
--     a tabela nova NÃO repete isso.
--   * Grants mínimos — nada para `anon`, nada para `public`.
--   * Rascunho × publicada — insert nasce sempre rascunho; publicar é transição
--     explícita; publicada é imutável (nem update, nem delete, nem por `postgres`).
--     Regra incompleta pode ser salva em rascunho; publicar exige forma válida.
--   * Compatibilidade — roteiro sem revisão continua exatamente como hoje: sem
--     revisão = sem regra = sempre aplicável. Nenhuma linha existente é lida,
--     alterada ou apagada. Zero backfill.
--
-- ─── Reversão ───────────────────────────────────────────────────────────────
--
--   drop trigger if exists inspections_applicability_revision_guard on public.inspections;
--   drop function if exists private.inspection_applicability_revision_guard();
--   alter table public.inspections drop column if exists applicability_revision_id;
--   drop table if exists public.checklist_template_revisions;
--   drop function if exists private.checklist_template_revision_guard();
--   drop function if exists private.applicability_payload_is_structural(jsonb, jsonb);
--
-- A reversão é segura por construção: a coluna nova é opcional e nada no app a lê
-- ou escreve ainda (a fiação do congelamento é do COND-05/COND-08).
--
-- Aplicada em produção (`pfjacmawaigndqclgvpn`) em 19/08/2026, com autorização
-- explícita da Ester ("aplique tudo que tiver pendente em produção").
-- ============================================================================

-- ─── 1. Validação estrutural mínima ─────────────────────────────────────────
--
-- O validador de verdade — ciclo, referência quebrada, operador incompatível, opção
-- inexistente — é `validateTemplateRules` (src/domain/applicability/validate.ts), e o
-- gate de publicação com explicação em tela é o COND-07. O que roda aqui é a última
-- linha: forma do documento, para que revisão publicada nunca seja lixo que o motor
-- não consiga sequer ler. Rascunho não passa por isto.

create or replace function private.applicability_payload_is_structural(
  p_rules jsonb,
  p_questions jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select
    jsonb_typeof(p_rules) = 'array'
    and jsonb_typeof(p_questions) = 'array'
    -- toda pergunta: id não vazio, texto e tipo conhecido
    and not exists (
      select 1 from jsonb_array_elements(p_questions) q
      where jsonb_typeof(q.value) <> 'object'
         or coalesce(q.value->>'id', '') = ''
         or coalesce(q.value->>'text', '') = ''
         or coalesce(q.value->>'type', '') not in ('boolean', 'single_choice', 'multi_choice', 'number')
    )
    -- id de pergunta é único: regra referencia por id, e id repetido é referência ambígua
    and (
      select count(*) = count(distinct q.value->>'id')
      from jsonb_array_elements(p_questions) q
    )
    -- toda regra: id, alvo e um grupo com pelo menos uma condição
    and not exists (
      select 1 from jsonb_array_elements(p_rules) r
      where jsonb_typeof(r.value) <> 'object'
         or coalesce(r.value->>'id', '') = ''
         or coalesce(r.value->'target'->>'type', '') not in ('section', 'item')
         or coalesce(r.value->'target'->>'id', '') = ''
         or coalesce(r.value->>'branch', 'if') not in ('if', 'else')
         or coalesce(r.value->'expression'->>'combinator', '') not in ('all', 'any')
         or jsonb_typeof(r.value->'expression'->'conditions') is distinct from 'array'
         or jsonb_array_length(r.value->'expression'->'conditions') = 0
    )
    and (
      select count(*) = count(distinct r.value->>'id')
      from jsonb_array_elements(p_rules) r
    )
    -- toda condição: fonte, campo (por id, nunca texto de pergunta) e operador do catálogo
    and not exists (
      select 1
      from jsonb_array_elements(p_rules) r,
           jsonb_array_elements(r.value->'expression'->'conditions') c
      where jsonb_typeof(c.value) <> 'object'
         or coalesce(c.value->>'source', '') not in ('context', 'question')
         or coalesce(c.value->>'field', '') = ''
         or coalesce(c.value->>'operator', '') not in (
              'equals', 'not_equals', 'contains', 'not_contains',
              'greater', 'greater_or_equal', 'less', 'less_or_equal',
              'exists', 'not_exists', 'in_list', 'not_in_list'
            )
    )
    -- um alvo, uma regra por ramo (decisão 1 do COND-02: duas regras no mesmo alvo
    -- é ambiguidade, não composição)
    and (
      select count(*) = count(distinct (
        r.value->'target'->>'type',
        r.value->'target'->>'id',
        coalesce(r.value->>'branch', 'if')
      ))
      from jsonb_array_elements(p_rules) r
    );
$function$;

-- ─── 2. A tabela de revisões ────────────────────────────────────────────────

create table if not exists public.checklist_template_revisions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  -- `text`, e não uuid: `checklist_templates.id` é text em produção desde
  -- `20260426140859_convert_template_ids_to_text` — os roteiros estáticos de
  -- `src/data` têm id legível (`tpl-ilpi-v1`). Roteiro estático só ganha revisão
  -- depois de semeado (TemplateService.seedLegacyTemplates); sem revisão, funciona
  -- como sempre funcionou.
  template_id       text not null references public.checklist_templates(id) on delete cascade,
  -- Sequencial por (tenant, roteiro). Preenchido pelo gatilho quando vem nulo.
  revision          integer not null,
  status            text not null default 'draft',
  -- Perguntas de roteamento (COND-05) e regras (COND-06), no schema do COND-02.
  routing_questions jsonb not null default '[]'::jsonb,
  rules             jsonb not null default '[]'::jsonb,
  notes             text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz,
  published_by      uuid,
  constraint checklist_template_revisions_status_check
    check (status in ('draft', 'published')),
  constraint checklist_template_revisions_revision_check
    check (revision >= 1),
  constraint checklist_template_revisions_rules_array_check
    check (jsonb_typeof(rules) = 'array'),
  constraint checklist_template_revisions_questions_array_check
    check (jsonb_typeof(routing_questions) = 'array'),
  -- Publicada tem carimbo; rascunho não tem. Sem isto, "publicada" viraria adjetivo.
  constraint checklist_template_revisions_published_stamp_check
    check (
      (status = 'published' and published_at is not null)
      or (status = 'draft' and published_at is null)
    )
);

comment on table public.checklist_template_revisions is
  'COND-04 - regras de aplicabilidade e perguntas de roteamento de um roteiro, versionadas. '
  'Rascunho editavel, publicada imutavel. So revisao publicada entra em inspecao. '
  'rules[].target.id aponta para checklist_items/checklist_sections POR ID, sem FK: o editor '
  'apaga e reinsere secoes e itens a cada salvamento, e uma FK apagaria as regras junto.';

create unique index if not exists checklist_template_revisions_seq_uniq
  on public.checklist_template_revisions (tenant_id, template_id, revision);

-- Um rascunho por roteiro e tenant: a "regra incompleta salva" do card é uma só,
-- senão publicar vira escolha entre rascunhos.
create unique index if not exists checklist_template_revisions_single_draft_uniq
  on public.checklist_template_revisions (tenant_id, template_id)
  where status = 'draft';

-- Achar a revisão publicada corrente é a leitura quente (uma por criação de inspeção).
create index if not exists checklist_template_revisions_current_idx
  on public.checklist_template_revisions (tenant_id, template_id, status, revision desc);

-- ─── 3. Ciclo de vida: numeração, publicação e imutabilidade ────────────────

create or replace function private.checklist_template_revision_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.revision is null then
      select coalesce(max(r.revision), 0) + 1 into new.revision
      from public.checklist_template_revisions r
      where r.tenant_id = new.tenant_id
        and r.template_id = new.template_id;
    end if;

    -- Nascer publicada só é possível por caminho privilegiado (a policy de insert
    -- exige rascunho); ainda assim a forma é conferida e o carimbo é do banco.
    if new.status = 'published' then
      if not private.applicability_payload_is_structural(new.rules, new.routing_questions) then
        raise exception 'revisao publicada com estrutura invalida';
      end if;
      new.published_at := coalesce(new.published_at, now());
    end if;

    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'published' then
      raise exception 'revisao publicada nao pode ser apagada';
    end if;
    return old;
  end if;

  -- UPDATE
  if old.status = 'published' then
    raise exception 'revisao publicada e imutavel';
  end if;

  if new.tenant_id is distinct from old.tenant_id
     or new.template_id is distinct from old.template_id
     or new.revision is distinct from old.revision then
    raise exception 'identidade da revisao nao muda';
  end if;

  if new.status = 'published' then
    if not private.applicability_payload_is_structural(new.rules, new.routing_questions) then
      raise exception 'revisao publicada com estrutura invalida';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists checklist_template_revisions_guard on public.checklist_template_revisions;
create trigger checklist_template_revisions_guard
  before insert or update or delete on public.checklist_template_revisions
  for each row execute function private.checklist_template_revision_guard();

-- ─── 4. RLS e grants ────────────────────────────────────────────────────────

alter table public.checklist_template_revisions enable row level security;

-- Tabela nova no `public` nasce com ALL para anon/authenticated pelos default
-- privileges do Supabase; o revoke é explícito (ver SEC-01 / PROD-01).
revoke all on table public.checklist_template_revisions from public;
revoke all on table public.checklist_template_revisions from anon;
revoke all on table public.checklist_template_revisions from authenticated;
grant select, insert, update, delete on table public.checklist_template_revisions to authenticated;

drop policy if exists "staff reads template revisions" on public.checklist_template_revisions;
create policy "staff reads template revisions"
  on public.checklist_template_revisions for select to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- Insert só de rascunho: publicar é transição, nunca estado inicial.
drop policy if exists "staff creates draft revisions" on public.checklist_template_revisions;
create policy "staff creates draft revisions"
  on public.checklist_template_revisions for insert to authenticated
  with check (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
    and status = 'draft'
  );

-- Update só alcança rascunho (o `using` não enxerga publicada), e pode levá-lo a
-- publicada. O gatilho repete a regra para quem não passa por RLS.
drop policy if exists "staff edits draft revisions" on public.checklist_template_revisions;
create policy "staff edits draft revisions"
  on public.checklist_template_revisions for update to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
    and status = 'draft'
  )
  with check (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- Descartar rascunho é operação normal do editor. Publicada, nunca.
drop policy if exists "staff discards draft revisions" on public.checklist_template_revisions;
create policy "staff discards draft revisions"
  on public.checklist_template_revisions for delete to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
    and status = 'draft'
  );

-- ─── 5. A inspeção guarda a revisão que congelou ────────────────────────────
--
-- Nullable de propósito: inspeção sem revisão é inspeção de roteiro sem regra, que é
-- o comportamento de hoje e continua idêntico. Nenhum backfill.
-- A gravação na criação da inspeção é do COND-05; a convergência entre dispositivos
-- (sync) é do COND-08. Aqui ficam o vínculo e a garantia de que ele só aponta para
-- revisão PUBLICADA — "só revisão publicada entra em inspeção", no banco.

alter table public.inspections
  add column if not exists applicability_revision_id uuid
    references public.checklist_template_revisions(id) on delete restrict;

comment on column public.inspections.applicability_revision_id is
  'COND-04 - revisao publicada congelada na criacao da inspecao. Nula = roteiro sem regra.';

create or replace function private.inspection_applicability_revision_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
  v_tenant uuid;
begin
  if new.applicability_revision_id is null then
    return new;
  end if;

  select r.status, r.tenant_id into v_status, v_tenant
  from public.checklist_template_revisions r
  where r.id = new.applicability_revision_id;

  if v_status is distinct from 'published' then
    raise exception 'inspecao so congela revisao publicada';
  end if;

  if new.tenant_id is not null and v_tenant is distinct from new.tenant_id then
    raise exception 'revisao de outro tenant';
  end if;

  return new;
end;
$function$;

drop trigger if exists inspections_applicability_revision_guard on public.inspections;
create trigger inspections_applicability_revision_guard
  before insert or update of applicability_revision_id on public.inspections
  for each row execute function private.inspection_applicability_revision_guard();
